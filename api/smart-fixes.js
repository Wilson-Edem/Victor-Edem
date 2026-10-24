const { createHash } = require("crypto");

const MAX_FIXES_PER_DAY = 300;
const MAX_CODE_CHARS = 12000;
const MAX_FINDINGS = 30;
const WINDOW_SECONDS = 86400;

function visitorKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || String(req.headers["x-real-ip"] || "unknown");
  const day = new Date().toISOString().slice(0, 10);
  return "vhite-fix:" + createHash("sha256").update(ip + day).digest("hex").slice(0, 32);
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
  const { code, findings, language } = body;
  if (typeof code !== "string" || code.length === 0) return "code is required";
  if (code.length > MAX_CODE_CHARS) return `code is too long (max ${MAX_CODE_CHARS} characters)`;
  if (language !== undefined && (typeof language !== "string" || language.length > 20)) return "language is invalid";
  if (!Array.isArray(findings) || findings.length === 0 || findings.length > MAX_FINDINGS) {
    return `findings must be a list of 1 to ${MAX_FINDINGS} items`;
  }
  for (const item of findings) {
    if (!item || !Number.isInteger(item.line) || item.line < 1) return "each finding needs a line number";
    if (typeof item.rule !== "string" || item.rule.length > 60) return "each finding needs a rule";
    if (typeof item.message !== "string" || item.message.length > 300) return "each finding needs a message";
  }
  return null;
}

function buildPrompt({ code, findings }) {
  const numbered = code
    .split("\n")
    .map((text, index) => `${index + 1}: ${text}`)
    .join("\n");
  const list = findings.map((item) => `- line ${item.line}: [${item.rule}] ${item.message}`).join("\n");
  return [
    "You fix code-quality findings in one JavaScript file.",
    "Return ONLY a JSON array. Each item has: line (number), original (the exact current text of that line, copied without its line number), replacement (the fixed line as one line of text, or an empty string to delete the line).",
    "Fix only the listed lines. Keep each change minimal. Do not add comments.",
    "For a hardcoded secret, replace the value with a read from an environment variable, such as process.env.NAME.",
    "For a debugger statement or a console.log left for debugging, delete the line.",
    "If you are not sure how to fix a line, leave it out of the array.",
    "Findings:",
    list,
    "Code:",
    numbered,
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
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(body) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
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

  let edits;
  try {
    edits = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("answer was not valid JSON");
  }
  if (!Array.isArray(edits)) throw new Error("answer was not a list");
  return edits.map((edit) => ({
    line: edit?.line,
    original: typeof edit?.original === "string" ? edit.original : "",
    replacement: typeof edit?.replacement === "string" ? edit.replacement : "",
  }));
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
    if (used > MAX_FIXES_PER_DAY) {
      return res.status(429).json({
        error: `Daily smart fix limit reached (${MAX_FIXES_PER_DAY} files per day). Try again tomorrow.`,
        remaining: 0,
      });
    }

    const edits = await askModel(body);
    return res.status(200).json({ edits, remaining: MAX_FIXES_PER_DAY - used });
  } catch (error) {
    console.error("smart fixes failed", error.status ?? "", error.detail ?? error.message);
    return res.status(502).json({ error: "Smart service is unavailable right now" });
  }
};
