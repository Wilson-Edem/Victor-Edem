const TZ = "Africa/Lagos";

function lagosParts(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  const day = `${map.year}-${map.month}-${map.day}`;
  const time = `${day} ${map.hour}:${map.minute}:${map.second}`;
  const secondsSinceMidnight = Number(map.hour) * 3600 + Number(map.minute) * 60 + Number(map.second);
  return { day, time, secondsUntilMidnight: 86400 - secondsSinceMidnight };
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function visitHtml(info) {
  const rows = [
    ["Date and time (Lagos, WAT)", info.time],
    ["Visitor", "Guest"],
    ["Page", info.page],
    ["IP address", info.ip],
    ["Browser and device", info.ua],
    ["Referrer", info.ref]
  ].map(([k, v]) => `<tr><td style="padding:10px 14px;color:#a5b4fc;font-size:14px;border-bottom:1px solid #232a3f;width:38%;">${esc(k)}</td><td style="padding:10px 14px;color:#e5e7eb;font-size:14px;border-bottom:1px solid #232a3f;word-break:break-all;">${esc(v)}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#07080d;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07080d;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#11141e;border-radius:16px;overflow:hidden;">
<tr><td style="background:linear-gradient(120deg,#6366f1,#8b5cf6 55%,#38d6f5);padding:22px 28px;color:#ffffff;">
<div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.9;">Daily visit</div>
<div style="font-size:20px;font-weight:700;margin-top:6px;">Someone visited your portfolio today</div>
</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td style="padding:16px 28px;color:#6b7280;font-size:12px;">Sent once per visitor per day (Lagos time).</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

module.exports = async function handler(req, res) {
  const now = new Date();
  const lagos = lagosParts(now);

  const cookie = req.headers.cookie || "";
  const match = /(?:^|;\s*)pv_day=([^;]+)/.exec(cookie);

  if (match && match[1] === lagos.day) {
    res.statusCode = 204;
    return res.end();
  }

  const vercelIp = String(req.headers["x-vercel-forwarded-for"] || "").split(",")[0].trim();
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const info = {
    time: lagos.time,
    page: String(new URL(req.url, "https://site.local").searchParams.get("page") || "/").slice(0, 200),
    ip: vercelIp || forwarded || (req.socket && req.socket.remoteAddress) || "unknown",
    ua: String(req.headers["user-agent"] || "unknown").slice(0, 300),
    ref: String(req.headers.referer || "direct").slice(0, 300)
  };

  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.SENDER_EMAIL;
  const receiver = process.env.RECEIVER_EMAIL;

  if (apiKey && sender && receiver) {
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "Portfolio Visits", email: sender },
          to: [{ email: receiver, name: "Victor Edem" }],
          subject: `Portfolio visit: ${info.time} WAT`,
          htmlContent: visitHtml(info)
        })
      });
    } catch (e) {}
  }

  const maxAge = Math.max(60, lagos.secondsUntilMidnight);
  res.setHeader("Set-Cookie", `pv_day=${lagos.day}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure; HttpOnly`);
  res.statusCode = 204;
  res.end();
};
