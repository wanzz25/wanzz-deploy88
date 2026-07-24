// GET  /api/vercel  -> status konfigurasi
// POST /api/vercel  -> memicu deploy ASLI lewat Vercel Deployments API,
//                      pakai VERCEL_TOKEN (API key) langsung — bukan
//                      Deploy Hook.
//
// Body POST mendukung 2 mode:
//   1) mode:"files"  — untuk project yang di-upload di panel Upload
//      Project. body: { mode:"files", projectName, files:[{path,content}] }
//   2) mode:"git"    — untuk repo asli dari GitHub (pilih di panel
//      Pilih Repository). body: { mode:"git", projectName, repoFullName,
//      ref }  → Vercel sendiri yang menarik source dari GitHub.
module.exports = async function handler(req, res) {
  const config = require("./_lib/config");
  const token = config.VERCEL_TOKEN;

  if (req.method === "GET") {
    return res.status(200).json({ configured: Boolean(token) });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed, gunakan POST." });
  }
  if (!token) {
    return res.status(400).json({ ok: false, error: "VERCEL_TOKEN belum diatur di environment variable server." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const projectName = (body.projectName || "wanzz-deploy-project")
    .toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 52) || "wanzz-deploy-project";
  const teamQuery = config.VERCEL_TEAM_ID ? `?teamId=${config.VERCEL_TEAM_ID}` : "";

  try {
    let payload;

    if (body.mode === "git" && body.repoFullName) {
      const [org, repoName] = body.repoFullName.split("/");
      if (!org || !repoName) {
        return res.status(400).json({ ok: false, error: "repoFullName harus berformat owner/repo." });
      }
      payload = {
        name: projectName,
        target: "production",
        gitSource: { type: "github", org, repo: repoName, ref: body.ref || "main" },
      };
    } else if (Array.isArray(body.files) && body.files.length) {
      payload = {
        name: projectName,
        target: "production",
        files: body.files.map((f) => ({
          file: f.path,
          data: f.content,
          ...(f.encoding === "base64" ? { encoding: "base64" } : {}),
        })),
        projectSettings: { framework: null },
      };
    } else {
      return res.status(400).json({
        ok: false,
        error: "Body butuh 'files' (mode upload) atau 'repoFullName' (mode git).",
      });
    }

    const depRes = await fetch(`https://api.vercel.com/v13/deployments${teamQuery}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await depRes.json();

    if (!depRes.ok) {
      return res.status(502).json({
        ok: false,
        error: (data.error && data.error.message) || `Vercel API error ${depRes.status}`,
        detail: data,
      });
    }

    const result = {
      ok: true,
      // URL produksi bersih — Vercel otomatis mengarahkan domain ini ke
      // deployment production terbaru. Ini yang seharusnya kamu pakai/bagikan.
      url: `https://${projectName}.vercel.app`,
      // URL spesifik untuk deployment ini (ada hash-nya) — berguna untuk
      // debug/lihat log build deployment yang ini persis, biasanya BUKAN
      // yang kamu mau bagikan ke orang lain.
      deploymentUrl: `https://${data.url}`,
      id: data.id,
      readyState: data.readyState,
    };

    // ---- pasang domain custom (opsional) ----
    // Domain harus SUDAH terdaftar/terverifikasi di akun/project Vercel
    // kamu (lewat dashboard Vercel → Domains). Ini cuma memasangkan
    // deployment yang baru dibuat ke domain itu (alias), bukan membeli
    // atau mendaftarkan domain baru.
    if (body.domain) {
      try {
        const aliasRes = await fetch(`https://api.vercel.com/v2/deployments/${data.id}/aliases${teamQuery}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ alias: body.domain }),
        });
        const aliasData = await aliasRes.json();
        result.domain = {
          ok: aliasRes.ok,
          error: aliasRes.ok ? undefined : (aliasData.error && aliasData.error.message) || `status ${aliasRes.status}`,
        };
      } catch (err) {
        result.domain = { ok: false, error: String(err) };
      }
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: "Gagal memanggil Vercel API.", detail: String(err) });
  }
};
