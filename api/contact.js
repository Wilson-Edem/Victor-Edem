const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function clean(value, max) {
  return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20000) reject(new Error("too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function buildHtml({ name, email, message }) {
  const body = esc(message).replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#07080d;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07080d;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#11141e;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(120deg,#6366f1,#8b5cf6 55%,#38d6f5);padding:24px 28px;color:#ffffff;">
<div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.9;">New message</div>
<div style="font-size:22px;font-weight:700;margin-top:6px;">From your portfolio contact form</div>
</td></tr>
<tr><td style="padding:28px;color:#e5e7eb;font-size:15px;line-height:1.6;">
<p style="margin:0 0 14px;"><strong style="color:#a5b4fc;">Name:</strong> ${esc(name)}</p>
<p style="margin:0 0 14px;"><strong style="color:#a5b4fc;">Email:</strong> <a href="mailto:${esc(email)}" style="color:#c4b5fd;">${esc(email)}</a></p>
<div style="margin-top:20px;padding:18px;background:#07080d;border-radius:12px;border:1px solid #232a3f;">
<div style="font-size:13px;color:#9ca3af;margin-bottom:8px;">Message</div>
<div style="color:#f3f4f6;">${body}</div>
</div>
</td></tr>
<tr><td style="padding:18px 28px;color:#6b7280;font-size:12px;border-top:1px solid #232a3f;">Reply within 24 hours.</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Method not allowed" });

  let data;
  try {
    data = await readBody(req);
  } catch (e) {
    return send(res, 400, { ok: false, error: "Invalid request" });
  }

  if (data.company) return send(res, 200, { ok: true });

  const name = clean(data.name, 80);
  const email = clean(data.email, 120);
  const message = clean(data.message, 2000);

  if (name.length < 2) return send(res, 400, { ok: false, error: "Please enter your name." });
  if (!EMAIL_RE.test(email)) return send(res, 400, { ok: false, error: "Please enter a valid email address." });
  if (message.length < 10) return send(res, 400, { ok: false, error: "Your message is too short." });

  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.SENDER_EMAIL;
  const receiver = process.env.RECEIVER_EMAIL;
  if (!apiKey || !sender || !receiver) return send(res, 500, { ok: false, error: "Contact service is not configured yet." });

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Portfolio Contact", email: sender },
        to: [{ email: receiver, name: "Victor Edem" }],
        replyTo: { email, name },
        subject: `New message from ${name}`,
        htmlContent: buildHtml({ name, email, message })
      })
    });
    if (!response.ok) return send(res, 502, { ok: false, error: "Could not send your message. Please try again." });
  } catch (e) {
    return send(res, 502, { ok: false, error: "Could not send your message. Please try again." });
  }

  return send(res, 200, { ok: true });
};
