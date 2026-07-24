// GET  /api/github  -> status koneksi + daftar repo asli
// POST /api/github  -> membuat repo (kalau belum ada) & push file ke
//                      dalamnya lewat GitHub Contents API — real, pakai
//                      GITHUB_TOKEN (API key) langsung, bukan webhook.
//
// Body POST: { repoName, files: [{ path, content, encoding }] }
// encoding: "utf8" (default) atau "base64" (untuk file biner: gambar,
// font, dll — sudah dibaca sebagai base64 di browser).
module.exports = async function handler(req, res) {
  const config = require("./_lib/config");
  const token = config.GITHUB_TOKEN;

  if (!token) {
    if (req.method === "GET") {
      return res.status(200).json({ configured: false, user: null, repos: [] });
    }
    return res.status(400).json({ ok: false, error: "GITHUB_TOKEN belum diisi di api/_lib/config.js." });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "wanzz-deploy",
    Accept: "application/vnd.github+json",
  };

  if (req.method === "GET") {
    try {
      const [userRes, reposRes] = await Promise.all([
        fetch("https://api.github.com/user", { headers }),
        fetch("https://api.github.com/user/repos?sort=updated&per_page=20", { headers }),
      ]);

      if (!userRes.ok || !reposRes.ok) {
        return res.status(502).json({
          configured: true,
          error: `GitHub API error (user:${userRes.status}, repos:${reposRes.status})`,
        });
      }

      const user = await userRes.json();
      const reposData = await reposRes.json();
      const repos = reposData.map((r) => ({
        fullName: r.full_name,
        name: r.name,
        branch: r.default_branch,
        language: r.language || "—",
        private: r.private,
        updatedAt: r.updated_at,
      }));

      return res.status(200).json({ configured: true, user: user.login, repos });
    } catch (err) {
      return res.status(500).json({
        configured: true,
        error: "Gagal menghubungi GitHub API dari server.",
        detail: String(err),
      });
    }
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    const repoName = (body.repoName || "wanzz-project")
      .toLowerCase().replace(/[^a-z0-9-_.]/g, "-").slice(0, 90) || "wanzz-project";
    const files = Array.isArray(body.files) ? body.files : [];

    if (files.length === 0) {
      return res.status(400).json({ ok: false, error: "Body butuh 'files' (minimal 1 file)." });
    }

    try {
      // ambil username pemilik token
      const userRes = await fetch("https://api.github.com/user", { headers });
      if (!userRes.ok) {
        return res.status(502).json({ ok: false, error: `Gagal ambil profil GitHub (${userRes.status})` });
      }
      const user = await userRes.json();
      const owner = user.login;

      // cek apakah repo sudah ada
      const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
      const repoExists = checkRes.ok;

      if (!repoExists) {
        const createRes = await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name: repoName, auto_init: true }),
        });
        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          return res.status(502).json({
            ok: false,
            error: errData.message || `Gagal membuat repo (${createRes.status})`,
            detail: errData,
          });
        }
        // GitHub butuh sedikit waktu untuk selesai init repo baru
        await new Promise((r) => setTimeout(r, 1500));
      }

      const results = [];
      for (const f of files) {
        const path = String(f.path || "").replace(/^\/+/, "");
        if (!path) { results.push({ path: f.path, ok: false, status: 0, error: "path kosong" }); continue; }

        // cek sha kalau file sudah ada (perlu buat update)
        let sha;
        const existingRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(path)}`,
          { headers }
        );
        if (existingRes.ok) {
          const existingData = await existingRes.json();
          sha = existingData.sha;
        }

        const contentBase64 = f.encoding === "base64"
          ? f.content
          : Buffer.from(String(f.content || ""), "utf8").toString("base64");

        const putRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(path)}`,
          {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: sha ? `Update ${path} via Wanzz Deploy` : `Add ${path} via Wanzz Deploy`,
              content: contentBase64,
              ...(sha ? { sha } : {}),
            }),
          }
        );
        results.push({ path, ok: putRes.ok, status: putRes.status });
      }

      const failed = results.filter((r) => !r.ok);
      return res.status(200).json({
        ok: failed.length === 0,
        repoFullName: `${owner}/${repoName}`,
        htmlUrl: `https://github.com/${owner}/${repoName}`,
        results,
        error: failed.length ? `${failed.length} dari ${results.length} file gagal diupload.` : undefined,
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: "Gagal push ke GitHub.", detail: String(err) });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed." });
};
