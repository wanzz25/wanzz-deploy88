// GET /api/status
// Ringkasan status ketiga koneksi sekaligus (dipakai 3 kartu di
// dashboard). Detail per-platform ada di file terpisah:
// api/github.js, api/vercel.js, api/netlify.js — semua pakai API key
// langsung (GITHUB_TOKEN, VERCEL_TOKEN, NETLIFY_TOKEN), bukan webhook.
module.exports = async function handler(req, res) {
  const config = require("./_lib/config");
  const githubConfigured  = Boolean(config.GITHUB_TOKEN);
  const vercelConfigured  = Boolean(config.VERCEL_TOKEN);
  const netlifyConfigured = Boolean(config.NETLIFY_TOKEN);

  let githubUser = null;
  if (githubConfigured) {
    try {
      const r = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${config.GITHUB_TOKEN}`,
          "User-Agent": "wanzz-deploy",
        },
      });
      if (r.ok) {
        const u = await r.json();
        githubUser = u.login;
      }
    } catch (err) {
      // biarkan githubUser null kalau gagal, status tetap dilaporkan
    }
  }

  res.status(200).json({
    github:  { configured: githubConfigured,  status: githubConfigured  ? "CONNECTED"    : "NOT CONFIGURED" },
    vercel:  { configured: vercelConfigured,  status: vercelConfigured  ? "READY TO USE" : "NOT CONFIGURED" },
    netlify: { configured: netlifyConfigured, status: netlifyConfigured ? "CONNECTED"    : "NOT CONFIGURED" },
    githubUser,
  });
};
