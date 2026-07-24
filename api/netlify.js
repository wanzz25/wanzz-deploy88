// GET  /api/netlify -> status konfigurasi
// POST /api/netlify -> memicu deploy ASLI lewat Netlify API, pakai
//                      NETLIFY_TOKEN (API key) langsung — bukan Build
//                      Hook. File di-zip di server lalu dikirim sebagai
//                      "zip deploy" ke Netlify.
//
// Body POST mendukung 2 mode:
//   1) mode:"files" — project yang di-upload di panel Upload Project.
//      body: { mode:"files", siteName, files:[{path,content}] }
//   2) mode:"repo"  — repo asli dari GitHub. Server akan mengambil isi
//      filenya lewat GITHUB_TOKEN, lalu di-zip & di-deploy.
//      body: { mode:"repo", siteName, repoFullName, ref }
const JSZip = require("jszip");
const { fetchRepoFiles } = require("./_lib/github-tree");

module.exports = async function handler(req, res) {
  const config = require("./_lib/config");
  const token = config.NETLIFY_TOKEN;

  if (req.method === "GET") {
    return res.status(200).json({ configured: Boolean(token) });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed, gunakan POST." });
  }
  if (!token) {
    return res.status(400).json({ ok: false, error: "NETLIFY_TOKEN belum diatur di environment variable server." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const siteName = (body.siteName || "wanzz-deploy-site")
    .toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60) || "wanzz-deploy-site";

  try {
    const zip = new JSZip();

    if (body.mode === "repo" && body.repoFullName) {
      const ghToken = config.GITHUB_TOKEN;
      if (!ghToken) {
        return res.status(400).json({ ok: false, error: "GITHUB_TOKEN belum diatur — perlu untuk mengambil isi repo." });
      }
      const [owner, repo] = body.repoFullName.split("/");
      if (!owner || !repo) {
        return res.status(400).json({ ok: false, error: "repoFullName harus berformat owner/repo." });
      }
      const files = await fetchRepoFiles(ghToken, owner, repo, body.ref);
      if (files.length === 0) {
        return res.status(400).json({ ok: false, error: "Tidak ada file yang berhasil diambil dari repo tersebut." });
      }
      files.forEach((f) => zip.file(f.path, f.buffer));
    } else if (Array.isArray(body.files) && body.files.length) {
      body.files.forEach((f) => {
        if (f.encoding === "base64") {
          zip.file(f.path, f.content, { base64: true });
        } else {
          zip.file(f.path, f.content);
        }
      });
    } else {
      return res.status(400).json({
        ok: false,
        error: "Body butuh 'files' (mode upload) atau 'repoFullName' (mode repo).",
      });
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const headers = { Authorization: `Bearer ${token}` };

    // cari site dengan nama yang sama, atau buat baru
    let siteId = null;
    const listRes = await fetch("https://api.netlify.com/api/v1/sites", { headers });
    if (listRes.ok) {
      const sites = await listRes.json();
      const found = sites.find((s) => s.name === siteName);
      if (found) siteId = found.id;
    }
    if (!siteId) {
      const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: siteName }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        return res.status(502).json({
          ok: false,
          error: createData.message || `Gagal membuat site Netlify (${createRes.status})`,
          detail: createData,
        });
      }
      siteId = createData.id;
    }

    const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/zip" },
      body: zipBuffer,
    });
    const deployData = await deployRes.json();
    if (!deployRes.ok) {
      return res.status(502).json({
        ok: false,
        error: deployData.message || `Netlify API error ${deployRes.status}`,
        detail: deployData,
      });
    }

    const result = {
      ok: true,
      url: deployData.ssl_url || deployData.deploy_ssl_url || deployData.url,
      id: deployData.id,
      state: deployData.state,
    };

    // ---- pasang domain custom (opsional) ----
    // Domain harus SUDAH terdaftar/terverifikasi di akun Netlify kamu
    // (lewat dashboard Netlify → Domain settings). Ini cuma
    // memasangkan domain itu ke site yang baru dideploy, bukan
    // membeli/mendaftarkan domain baru.
    if (body.domain) {
      try {
        const domainRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ custom_domain: body.domain }),
        });
        const domainData = await domainRes.json().catch(() => ({}));
        result.domain = {
          ok: domainRes.ok,
          error: domainRes.ok ? undefined : (domainData.message || `status ${domainRes.status}`),
        };
      } catch (err) {
        result.domain = { ok: false, error: String(err) };
      }
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: "Gagal deploy ke Netlify.", detail: String(err) });
  }
};
