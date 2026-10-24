const { createHash } = require("crypto");

const MAX_PER_DAY = 20;
const MAX_SNIPPET_CHARS = 4000;
const WINDOW_SECONDS = 86400;

function visitorKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || String(req.headers["x-real-ip"] || "unknown");
  const day = new Date().toISOString().slice(0, 10);
  return "vhite:" + createHash("sha256").update(ip + day).digest("hex").slice(0, 32);
}

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_KV_REST_API_TOKEN;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error("usage store unavailable");
  return (await response.json()).result;
}

async function countUse(key) {
  const count = await redis(["INCR", key]);
  if (count === 1) await redis(["EXPIRE", key, WINDOW_SECONDS]);
  return count;
}

function readBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body && typeof req.body === "object" ? req.body : null;
}

function validate(body) {
  if (!body) return "Request body must be JSON";
  const { rule, message, snippet, language } = body;
  if (typeof rule !== "string" || rule.length > 60) return "rule is required (max 60 characters)";
  if (typeof message !== "string" || message.length > 300) return "message is required (max 300 characters)";
  if (typeof snippet !== "string" || snippet.length === 0) return "snippet is required";
  if (snippet.length > MAX_SNIPPET_CHARS) return `snippet is too long (max ${MAX_SNIPPET_CHARS} characters)`;
  if (language !== undefined && (typeof language !== "string" || language.length > 20)) return "language is invalid";
  return null;
}

function buildPrompt({ rule, message, snippet }) {
  return [
    "You explain one code-quality finding to a developer in 2 to 4 plain-English sentences.",
    "Say why it matters and what to do. Do not restate the whole code.",
    `Rule: ${rule}`,
    `Finding: ${message}`,
    "Code around the finding:",
    snippet,
  ].join("\n");
}

async function callModel(model, body) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(body) }] }] }),
    }
  );

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`status ${response.status}`);
    error.status = response.status;
    error.detail = raw.slice(0, 300);
    throw error;
  }

  const data = JSON.parse(raw);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("no text returned");
  return text.trim();
}

async function askModel(body) {
  const primary = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest";
  try {
    return await callModel(primary, body);
  } catch (error) {
    const retryable = error.status === 404 || error.status === 429 || error.status === 503;
    if (!retryable || fallback === primary) throw error;
    return await callModel(fallback, body);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const body = readBody(req);
  const problem = validate(body);
  if (problem) {
    return res.status(400).json({ error: problem });
  }

  try {
    const used = await countUse(visitorKey(req));
    if (used > MAX_PER_DAY) {
      return res.status(429).json({
        error: `Daily smart notes limit reached (${MAX_PER_DAY} per day). Try again tomorrow.`,
        remaining: 0,
      });
    }

    const explanation = await askModel(body);
    return res.status(200).json({ explanation, remaining: MAX_PER_DAY - used });
  } catch (error) {
    console.error("smart notes failed", error.status ?? "", error.detail ?? error.message);
    return res.status(502).json({ error: "Smart service is unavailable right now" });
  }
};
