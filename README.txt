WANZZ DEPLOY — Cara Pakai
==========================

Frontend sekarang terpisah jadi 4 halaman:

  index.html + landing.js       — halaman awal / login (Quick Access)
  loading.html + loading.js     — halaman transisi setelah klik Quick Access
  dashboard.html + dashboard.js — dashboard utama (status, repo, deploy, upload)
  apk.html + apk.js             — halaman khusus Build APK (Flutter)

Backend project ini terpisah per platform, pakai API key langsung
(bukan webhook), semua token diisi di SATU file:

  api/_lib/config.js — isi GITHUB_TOKEN, VERCEL_TOKEN, VERCEL_TEAM_ID,
                        NETLIFY_TOKEN di sini

  /api/github.js    — status + daftar repo asli
  /api/vercel.js    — status + deploy asli
  /api/netlify.js   — status + deploy asli
  /api/status.js    — ringkasan status ketiganya

Supaya nyambung ke akun asli, project ini HARUS di-deploy sebagai
project Vercel (bukan dibuka sebagai file index.html lokal), karena
/api adalah serverless function.

Langkah lengkap ada di file: README-BACKEND.md

Ringkasnya:
1. Push folder ini ke repo GitHub.
2. Import repo itu ke https://vercel.com/new lalu Deploy.
3. Buat GITHUB_TOKEN, VERCEL_TOKEN, NETLIFY_TOKEN (caranya ada di
   README-BACKEND.md).
4. Isi keempatnya langsung di api/_lib/config.js (atau lewat
   Environment Variables di dashboard Vercel kalau repo ini publik).
5. Buka URL project-nya — status API, daftar repo, dan tombol Deploy
   sekarang beneran nyambung lewat REST API resmi masing-masing.

Kalau token belum diisi, dashboard akan menunjukkan status
"NOT CONFIGURED" apa adanya — bukan pura-pura connected.
