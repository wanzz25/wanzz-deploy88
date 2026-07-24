// POST /api/build-apk   body: { repoFullName, workflowFile, ref }
//
// Memicu GitHub Actions workflow (workflow_dispatch) yang MEMBANGUN APK
// Flutter di runner GitHub sendiri — bukan di server Wanzz Deploy.
// Runner GitHub Actions punya waktu & resource cukup untuk install
// Flutter SDK + Android SDK dan build APK — sesuatu yang TIDAK MUNGKIN
// dilakukan di serverless function Vercel (limit waktu eksekusi, tidak
// ada SDK terpasang, tidak ada disk permanen).
//
// OTOMATIS: kalau repo target BELUM punya file workflow-nya
// (.github/workflows/{workflowFile}), endpoint ini akan membuatnya
// sendiri dulu (isi diambil dari flutter-apk-workflow-template.yml di
// root project ini), baru kemudian memicu build — jadi kamu tidak perlu
// klik tombol terpisah lagi.
//
// SYARAT: GITHUB_TOKEN di api/_lib/config.js scope-nya harus mencakup
// "repo" DAN "workflow". Tanpa scope "workflow", GitHub menolak baik
// pembuatan file workflow maupun trigger-nya dengan 403.
const fs = require("fs");
const path = require("path");

function readWorkflowTemplate() {
  const templatePath = path.join(__dirname, "..", "flutter-apk-workflow-template.yml");
  return fs.readFileSync(templatePath, "utf8");
}

module.exports = async function handler(req, res) {
  const config = require("./_lib/config");
  const token = config.GITHUB_TOKEN;

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed, gunakan POST.", step: "method-check" });
  }
  if (!token) {
    return res.status(400).json({ ok: false, error: "GITHUB_TOKEN belum diisi di api/_lib/config.js.", step: "config-check" });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const repoFullName = body.repoFullName;
  const workflowFile = (body.workflowFile || "build-apk.yml").trim();
  const ref = body.ref || "main";
  const workflowPath = `.github/workflows/${workflowFile}`;

  if (!repoFullName || !repoFullName.includes("/")) {
    return res.status(400).json({ ok: false, error: "repoFullName harus berformat owner/repo.", step: "input-validation" });
  }
  const [owner, repo] = repoFullName.split("/");

  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "wanzz-deploy",
    Accept: "application/vnd.github+json",
  };

  // helper: bikin objek error lengkap dengan lokasi persis kegagalannya
  function fail(status, step, message, extra) {
    return res.status(status).json({
      ok: false,
      step,                 // langkah mana yang gagal, mis. "check-workflow-file"
      error: message,       // pesan human-readable
      location: {           // lokasi persis: repo, path, branch, endpoint
        repoFullName,
        workflowPath,
        ref,
        endpoint: extra?.endpoint,
        githubStatus: extra?.githubStatus,
      },
      detail: extra?.detail, // respons mentah dari GitHub API (kalau ada)
      hint: extra?.hint,
    });
  }

  try {
    // ---- LANGKAH 1: cek apakah file workflow sudah ada di repo ----
    const checkUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(workflowPath)}?ref=${encodeURIComponent(ref)}`;
    const checkRes = await fetch(checkUrl, { headers });

    if (checkRes.status !== 200 && checkRes.status !== 404) {
      const errData = await checkRes.json().catch(() => ({}));
      return fail(502, "check-workflow-file", errData.message || `GitHub API error ${checkRes.status} saat cek file workflow`, {
        endpoint: checkUrl, githubStatus: checkRes.status, detail: errData,
      });
    }

    // ---- LANGKAH 2: kalau BELUM ada, otomatis buat filenya ----
    if (checkRes.status === 404) {
      let templateContent;
      try {
        templateContent = readWorkflowTemplate();
      } catch (err) {
        return fail(500, "read-template", "Gagal membaca flutter-apk-workflow-template.yml di server.", { detail: String(err) });
      }

      const createUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(workflowPath)}`;
      const createRes = await fetch(createUrl, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Tambah workflow build APK (otomatis oleh Wanzz Deploy)",
          content: Buffer.from(templateContent, "utf8").toString("base64"),
          branch: ref,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        let hint;
        if (createRes.status === 404) {
          hint = `Branch "${ref}" atau repo ${repoFullName} tidak ditemukan. Cek nama branch-nya benar.`;
        } else if (createRes.status === 403) {
          hint = "Token GITHUB_TOKEN tidak punya izin menulis ke repo ini (butuh scope 'repo').";
        } else if (createRes.status === 422) {
          hint = "Kemungkinan file sudah ada tapi bentrok sha, atau branch belum punya commit sama sekali (repo kosong).";
        }
        return fail(502, "create-workflow-file", errData.message || `Gagal membuat file workflow (${createRes.status})`, {
          endpoint: createUrl, githubStatus: createRes.status, detail: errData, hint,
        });
      }

      // beri jeda supaya GitHub selesai mendaftarkan workflow baru sebelum di-dispatch
      await new Promise((r) => setTimeout(r, 2500));
    }

    // ---- LANGKAH 3: trigger workflow_dispatch ----
    const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
    const dispatchRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
    });

    if (dispatchRes.status !== 204) {
      const errData = await dispatchRes.json().catch(() => ({}));
      let hint;
      if (dispatchRes.status === 404) {
        hint = `File ${workflowPath} baru saja dibuat tapi GitHub belum sempat mendaftarkannya sebagai workflow. Tunggu 10-15 detik lalu klik Build lagi.`;
      } else if (dispatchRes.status === 403) {
        hint = "Token GITHUB_TOKEN kemungkinan tidak punya scope 'workflow'. Generate token baru dengan scope repo + workflow, lalu update api/_lib/config.js.";
      } else if (dispatchRes.status === 422) {
        hint = `File workflow ada, tapi isinya mungkin tidak valid atau tidak punya trigger "workflow_dispatch". Cek isi ${workflowPath} di GitHub.`;
      }
      return fail(502, "dispatch-workflow", errData.message || `GitHub API error ${dispatchRes.status} saat memicu workflow`, {
        endpoint: dispatchUrl, githubStatus: dispatchRes.status, detail: errData, hint,
      });
    }

    // ---- LANGKAH 4: cari run ID dari run yang baru saja dipicu ----
    let runId = null;
    for (let attempt = 0; attempt < 3 && !runId; attempt++) {
      await new Promise((r) => setTimeout(r, 1200));
      const runsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=1`,
        { headers }
      );
      if (runsRes.ok) {
        const runsData = await runsRes.json();
        if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
          runId = runsData.workflow_runs[0].id;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      message: "Workflow build APK berhasil dipicu di GitHub Actions.",
      actionsUrl: `https://github.com/${owner}/${repo}/actions`,
      runId,
      repoFullName,
    });
  } catch (err) {
    return fail(500, "unexpected-error", "Gagal menghubungi GitHub API dari server.", { detail: String(err) });
  }
};
