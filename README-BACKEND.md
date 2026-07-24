# Wanzz Deploy — Menghubungkan ke Backend Asli (API Key Langsung)

Folder `/api` berisi 4 file, masing-masing berdiri sendiri per platform:

```
/api/github.js           → GET & POST  → status + daftar repo asli, DAN membuat/push repo (GITHUB_TOKEN)
/api/vercel.js           → GET & POST  → status + deploy ASLI via Vercel REST API
/api/netlify.js          → GET & POST  → status + deploy ASLI via Netlify REST API
/api/status.js           → GET         → ringkasan status ketiganya (dipakai 3 kartu di dashboard)
/api/_lib/config.js      → SATU tempat isi semua token (GITHUB_TOKEN, VERCEL_TOKEN, VERCEL_TEAM_ID, NETLIFY_TOKEN)
/api/_lib/github-tree.js → helper internal, bukan route (dipakai netlify.js untuk ambil isi repo)
```

Semua pakai **API key (Personal Access Token) langsung** — bukan Deploy
Hook / Build Hook. Token diisi di satu file (`api/_lib/config.js`), atau
lewat environment variable di dashboard Vercel — tidak pernah ada di
kode frontend.

**PENTING:** Karena ini serverless function, seluruh project (root folder
ini) harus di-deploy sebagai **1 project Vercel**. Endpoint `/api/...`
tidak jalan kalau `index.html` cuma dibuka sebagai file lokal.

---

## Langkah 1 — Push project ini ke GitHub

```bash
git init
git add .
git commit -m "wanzz deploy - api key backend"
git branch -M main
git remote add origin https://github.com/USERNAME/wanzz-deploy.git
git push -u origin main
```

## Langkah 2 — Import ke Vercel

1. Buka https://vercel.com/new
2. Pilih repo GitHub yang tadi kamu push
3. Klik **Deploy** — Vercel otomatis mengenali `/api` sebagai serverless
   functions dan membaca `package.json` untuk install dependency
   (`jszip`, dipakai oleh `netlify.js`)

## Langkah 3 — Buat 3 API key

### GitHub Token
1. https://github.com/settings/tokens → **Generate new token (classic)**
2. Scope: centang **repo**
3. Generate, copy tokennya (`ghp_...`)

### Vercel Token
1. https://vercel.com/account/tokens → **Create Token**
2. Kasih nama bebas, scope default sudah cukup
3. Copy tokennya (hanya muncul sekali, simpan baik-baik)
4. (Opsional, kalau akun kamu pakai Team) — catat juga **Team ID** dari
   Vercel dashboard → Settings → General

### Netlify Token
1. https://app.netlify.com/user/applications → **Personal access tokens**
   → **New access token**
2. Kasih nama bebas, Generate
3. Copy tokennya

## Langkah 4 — Isi token di `api/_lib/config.js`

Buka file `api/_lib/config.js`, isi 4 baris di bagian `CONFIG`:

```js
const CONFIG = {
  GITHUB_TOKEN: "ghp_xxxxxxxxxxxx",
  VERCEL_TOKEN: "xxxxxxxxxxxxxxxx",
  VERCEL_TEAM_ID: "",
  NETLIFY_TOKEN: "xxxxxxxxxxxxxxxx",
};
```

Simpan, commit, push, redeploy (atau Vercel auto-redeploy kalau kamu
sudah menghubungkan repo GitHub-nya). Selesai — `api/github.js`,
`api/vercel.js`, `api/netlify.js`, `api/status.js` semuanya baca dari
file ini secara otomatis.

**Alternatif (disarankan kalau repo ini publik):** isi Environment
Variables dengan nama yang sama (`GITHUB_TOKEN`, `VERCEL_TOKEN`,
`VERCEL_TEAM_ID`, `NETLIFY_TOKEN`) di Vercel → Settings → Environment
Variables, dan biarkan `CONFIG` di file tetap kosong. `config.js`
otomatis memprioritaskan Environment Variable kalau ada isinya duluan.

⚠️ Kalau kamu isi token asli langsung di `config.js` **dan** repo ini
publik di GitHub, buka `.gitignore` di root project dan hapus tanda `#`
di depan baris `api/_lib/config.js` SEBELUM commit pertama, supaya
tokennya tidak ikut ter-push.


## Langkah 5 — Selesai

Buka URL project Wanzz Deploy kamu, tekan Quick Access. Panel API Status
akan menunjukkan status asli, panel Pilih Repository berisi repo asli
dari GitHub kamu, dan tombol Deploy benar-benar membuat deployment lewat
REST API Vercel/Netlify.

---

## Fitur panel Upload Project

- **Input Raw HTML** — paste kode HTML langsung, otomatis jadi `index.html`.
- **Multi-file select** — pilih beberapa file/gambar/ZIP sekaligus, atau
  drag & drop.
- **Rename path** — klik kolom nama file untuk ganti nama/path-nya
  sebelum di-deploy atau di-push.
- **Push ke GitHub** — tombol terpisah dari Deploy. Membuat repo baru
  (kalau belum ada) di akun GitHub kamu dan meng-upload semua file lewat
  Contents API asli (`PUT /repos/{owner}/{repo}/contents/{path}`) —
  bukan simulasi. Setelah berhasil, repo itu otomatis jadi pilihan di
  panel "Pilih Repository".

## Domain custom saat deploy

Di panel "Deployment Target" ada kolom **Domain deploy (opsional)**.
Kalau diisi (misal `situs-saya.com`), server akan memasangkan domain
itu ke deployment yang baru dibuat:

- **Vercel**: lewat endpoint alias (`POST /v2/deployments/{id}/aliases`)
- **Netlify**: lewat update site (`PATCH /sites/{id}` dengan `custom_domain`)

⚠️ Domain itu **harus sudah kamu tambahkan & verifikasi** di akun
Vercel/Netlify kamu lebih dulu (lewat dashboard mereka → Domains). Wanzz
Deploy tidak membeli atau mendaftarkan domain baru — hanya
memasangkan/mengalihkan domain yang sudah terverifikasi ke deployment
terbaru. Kalau dikosongkan, dipakai subdomain otomatis dari nama project
(`nama-project.vercel.app` / `.netlify.app`) seperti biasa.

---

## Build APK (Flutter) lewat GitHub Actions

Wanzz Deploy **tidak** membangun APK Flutter di server sendiri — itu
tidak mungkin dilakukan di serverless function (butuh Flutter SDK,
Android SDK, waktu build panjang, yang semuanya tidak tersedia/tidak
diizinkan di Vercel functions). Sebagai gantinya, Wanzz Deploy memicu
**GitHub Actions** di repo Flutter kamu — build sungguhan berjalan di
server GitHub.

### Setup (sekali saja per repo Flutter)

1. Buka file `flutter-apk-workflow-template.yml` di root project ini.
2. Copy isinya ke repo Flutter kamu (repo lain, bukan repo Wanzz Deploy
   ini), simpan sebagai `.github/workflows/build-apk.yml`.
3. Commit & push.
4. Pastikan `GITHUB_TOKEN` di `api/_lib/config.js` scope-nya mencakup
   **repo** DAN **workflow** (kalau bikin token classic di
   github.com/settings/tokens, centang kedua scope itu). Tanpa scope
   `workflow`, GitHub akan menolak permintaan trigger dengan error 403.

### Cara pakai

1. Di navbar dashboard, klik tombol "📱 Build APK (Flutter)" untuk
   pindah ke halaman khusus (`apk.html`).
2. Pilih repo Flutter itu di panel "Pilih Repository Flutter".
3. Klik "Build APK dari Repo Terpilih". **Kalau repo itu belum punya
   file workflow-nya, sistem otomatis membuatkannya dulu** (isi diambil
   dari `flutter-apk-workflow-template.yml`), tunggu beberapa detik
   supaya GitHub selesai mendaftarkannya, baru memicu build — semua
   dalam satu klik, tidak perlu langkah manual tambahan.
4. Halaman ini otomatis memantau progres build (cek berkala tiap 15
   detik) — begitu build sukses, tombol **Download** akan muncul dan
   APK-nya langsung terunduh ke perangkat kamu lewat Wanzz Deploy
   sendiri, tidak perlu buka/login GitHub.

Tombol "📄 Tambahkan Workflow ke Repo Ini" tetap ada kalau kamu mau
menambahkan/memperbarui file workflow secara manual duluan, tapi
sekarang bukan langkah wajib.

### Kalau repo kamu SUDAH punya workflow versi lama

Kalau sebelumnya kamu sempat pakai versi awal template ini (yang
nge-pin `flutter-version: '3.24.0'`), kamu mungkin kena error
`version solving failed` karena project kamu butuh Dart SDK lebih baru
dari itu. Klik lagi tombol **"📄 Tambahkan Workflow ke Repo Ini"** —
ini akan **menimpa** file lama dengan versi terbaru template (yang
sudah tidak mengunci versi Flutter, otomatis pakai stable terbaru).

⚠️ Kalau APK-nya besar, proses download lewat Wanzz Deploy bisa gagal
karena batas ukuran respons serverless function. Kalau itu terjadi,
dashboard tetap menyediakan link cadangan langsung ke halaman GitHub
Actions untuk download manual.

### Download log build sebagai .txt (langsung dari situs, bukan GitHub)

Setiap build selesai (sukses ATAUPUN gagal), muncul tombol **"📄
Download Log Lengkap (.txt)"** di hasil build. Ini mengunduh log mentah
persis seperti yang tampil di tab Actions GitHub — semua output
`flutter pub get`, `flutter build apk`, error lengkap dengan stack
trace — sebagai file `.txt` langsung dari Wanzz Deploy. Kamu tidak
perlu login/buka GitHub sama sekali untuk baca error build-nya.

### Kalau build tetap gagal — cara baca error-nya

Setiap kegagalan sekarang dilaporkan lengkap di console log, bukan cuma
"gagal":
- **step** — langkah mana yang gagal (`check-workflow-file`,
  `create-workflow-file`, `dispatch-workflow`, dll)
- **location** — repo, path file workflow, branch, dan endpoint GitHub
  API yang dipanggil
- **detail** — pesan mentah asli dari GitHub API
- **hint** — saran perbaikan spesifik sesuai kode error-nya

Contoh: kalau errornya di step `dispatch-workflow` dengan status 404
tepat setelah file baru dibuat, itu tandanya GitHub belum sempat
mendaftarkan workflow barunya — tunggu 10-15 detik lalu klik Build lagi.
4. Buka link Actions yang muncul di console log untuk memantau progres.
   Build Flutter biasanya makan waktu beberapa menit.
5. Setelah selesai, unduh APK dari bagian **Artifacts** di halaman run
   tersebut (nama artifact: `app-release-apk`).

---

## Cara kerja tombol Deploy

**Kalau repo yang dipilih hasil upload lokal** (lewat panel Upload
Project → "Jadikan Repository"):
- Isi file (yang sudah kamu edit di editor full-screen) dikirim langsung
  dari browser ke `/api/vercel` atau `/api/netlify`.
- Vercel: dibuat deployment lewat `POST /v13/deployments` dengan file
  inline.
- Netlify: file di-zip di server (pakai `jszip`), lalu di-deploy lewat
  `PUT /sites/{id}/deploys` (zip deploy).

**Kalau repo yang dipilih adalah repo GitHub asli:**
- Vercel: pakai `gitSource` — Vercel sendiri yang menarik source langsung
  dari GitHub (butuh akun Vercel kamu sudah terhubung ke GitHub App,
  biasanya otomatis kalau kamu sign-in Vercel pakai GitHub).
- Netlify: server mengambil seluruh isi file repo lewat GitHub API
  (`GITHUB_TOKEN`), zip di server, lalu deploy dengan cara yang sama
  seperti mode upload.

---

## Batasan yang perlu kamu tahu

- **Ukuran repo dibatasi** (default: maks 80 file / ~4MB per deploy)
  supaya tidak timeout di serverless function. Untuk repo besar, deploy
  langsung dari dashboard Vercel/Netlify tetap lebih andal.
- **File biner di project upload** (gambar, font, dll) sekarang IKUT
  ter-deploy — dikirim sebagai base64. Karena base64 membuat ukuran data
  ~33% lebih besar dari file aslinya, project dengan banyak gambar besar
  bisa lebih cepat menyentuh limit ukuran payload serverless function
  (biasanya beberapa MB). Kalau project kamu berisi banyak gambar
  resolusi tinggi, pertimbangkan kompres dulu sebelum upload, atau
  deploy langsung lewat dashboard Vercel/Netlify untuk project besar.
- **Tidak ada live build log** di dashboard ini. Setelah deployment
  dibuat, cek progres build & URL final langsung di dashboard
  Vercel/Netlify masing-masing (link `url` yang muncul di console log
  bisa langsung dibuka).
- **Vercel `gitSource`** butuh akun Vercel yang tokennya sudah punya
  akses GitHub App ke repo tersebut. Kalau gagal dengan error terkait
  akses repo, hubungkan dulu repo itu manual sekali lewat dashboard
  Vercel (Import Project), setelah itu API biasanya lancar.
