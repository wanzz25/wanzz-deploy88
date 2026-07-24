// GET /api/build-apk-download?repoFullName=owner/repo&artifactId=456
//
// Mengunduh artifact (hasil build APK) dari GitHub Actions lewat API
// resmi (butuh Authorization header — makanya tidak bisa langsung buka
// link GitHub-nya di browser tanpa login GitHub), lalu meneruskannya
// sebagai file download langsung ke browser kamu. Jadi kamu TIDAK perlu
// login ke GitHub atau ke tab Actions untuk mengambil filenya.
//
// CATATAN UKURAN: GitHub Actions selalu membungkus artifact dalam .zip
// (walau isinya cuma 1 file .apk). Serverless function Vercel punya
// batas ukuran respons (biasanya sekitar beberapa MB tergantung plan).
// Kalau APK kamu besar dan gagal terunduh lewat sini, pakai link
// "Buka di GitHub Actions" sebagai cadangan (masih tersedia di UI).
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
  const artifactId = req.query.artifactId;

  if (!repoFullName || !repoFullName.includes("/") || !artifactId) {
    return res.status(400).json({ ok: false, error: "Butuh query 'repoFullName' (owner/repo) dan 'artifactId'." });
  }
  const [owner, repo] = repoFullName.split("/");

  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "wanzz-deploy",
    Accept: "application/vnd.github+json",
  };

  try {
    const artifactRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
      { headers, redirect: "follow" }
    );

    if (!artifactRes.ok) {
      return res.status(502).json({ ok: false, error: `Gagal mengambil artifact dari GitHub (${artifactRes.status})` });
    }

    const arrayBuffer = await artifactRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="wanzz-deploy-apk-${artifactId}.zip"`);
    res.setHeader("Content-Length", buffer.length);
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).json({ ok: false, error: "Gagal mengunduh artifact.", detail: String(err) });
  }
};
