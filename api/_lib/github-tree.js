// Helper internal — folder diawali underscore supaya Vercel TIDAK
// membuatnya jadi route publik. Dipakai oleh api/netlify.js untuk
// mengambil isi file dari repo GitHub memakai GITHUB_TOKEN (API key),
// bukan webhook.
async function fetchRepoFiles(token, owner, repo, ref, maxFiles = 80, maxBytes = 4 * 1024 * 1024) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "wanzz-deploy",
    Accept: "application/vnd.github+json",
  };

  if (!ref) {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) throw new Error(`Gagal ambil info repo (${repoRes.status})`);
    const repoInfo = await repoRes.json();
    ref = repoInfo.default_branch;
  }

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
    { headers }
  );
  if (!treeRes.ok) throw new Error(`Gagal ambil tree repo (${treeRes.status})`);
  const treeData = await treeRes.json();
  const blobs = (treeData.tree || []).filter((t) => t.type === "blob").slice(0, maxFiles);

  const files = [];
  let totalBytes = 0;
  for (const blob of blobs) {
    if (totalBytes > maxBytes) break;
    const blobRes = await fetch(blob.url, { headers });
    if (!blobRes.ok) continue;
    const blobData = await blobRes.json();
    const buffer = Buffer.from(blobData.content, blobData.encoding || "base64");
    totalBytes += buffer.length;
    files.push({ path: blob.path, buffer });
  }
  return files;
}

module.exports = { fetchRepoFiles };
