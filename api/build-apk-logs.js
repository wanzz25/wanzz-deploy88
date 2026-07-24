// GET /api/build-apk-logs?repoFullName=owner/repo&jobId=123
//
// Mengunduh log build MENTAH (persis seperti yang muncul di tab Actions
// GitHub) langsung sebagai file .txt dari situs ini — kamu TIDAK perlu
// buka/login GitHub untuk baca error lengkapnya. Berguna terutama saat
// build gagal: log lengkapnya (semua output flutter/gradle/dart) bisa
// langsung didownload dan dibaca atau dikirim ke siapa pun untuk debug.
module.exports = async function handler(req, res) {
  const config = require("./_lib/config");
  const token = config.GITHUB_TOKEN;

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed, gunakan GET." });
  }
  if (!token) {
    return res.status(400).json({ ok: false, error: "GITHUB_TOKEN belum diisi di api/_lib/config.js." });
  }

  const repoFullName = req.query.repoFullName;
  const jobId = req.query.jobId;

  if (!repoFullName || !repoFullName.includes("/") || !jobId) {
    return res.status(400).json({ ok: false, error: "Butuh query 'repoFullName' (owner/repo) dan 'jobId'." });
  }
  const [owner, repo] = repoFullName.split("/");

  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "wanzz-deploy",
    Accept: "application/vnd.github+json",
  };

  try {
    const logRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
      { headers, redirect: "follow" }
    );

    if (!logRes.ok) {
      return res.status(502).json({ ok: false, error: `Gagal mengambil log dari GitHub (${logRes.status})` });
    }

    const text = await logRes.text();
    const safeRepo = repoFullName.replace(/[^a-z0-9-_.]/gi, "-");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="wanzz-deploy-build-log-${safeRepo}-${jobId}.txt"`);
    res.status(200).send(text);
  } catch (err) {
    res.status(500).json({ ok: false, error: "Gagal mengunduh log.", detail: String(err) });
  }
};
