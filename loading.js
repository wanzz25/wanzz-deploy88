/* =========================================================
   WANZZ DEPLOY — loading.js (halaman transisi setelah login)
   ========================================================= */
(() => {
  "use strict";

  /* ---------- particle background canvas ---------- */
  const canvas = document.getElementById("bg-canvas");
  const ctx = canvas.getContext("2d");
  let particles = [];

  function resizeCanvas(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  function initParticles(count){
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      a: Math.random() * 0.5 + 0.15,
    }));
  }
  function tickParticles(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150,149,156,${p.a * 0.5})`;
      ctx.fill();
    });
    requestAnimationFrame(tickParticles);
  }
  resizeCanvas();
  initParticles(Math.min(90, Math.floor((window.innerWidth * window.innerHeight) / 14000)));
  tickParticles();
  window.addEventListener("resize", () => { resizeCanvas(); initParticles(particles.length); });

  /* ---------- kalau halaman ini diakses langsung tanpa lewat landing ---------- */
  if (!document.referrer || !document.referrer.includes(location.host)) {
    // tetap boleh diakses langsung, cuma tidak masalah — animasi tetap jalan
  }

  /* ---------- animasi loading, lalu pindah ke dashboard ---------- */
  const percentNum   = document.getElementById("percent-num");
  const barFill       = document.getElementById("loading-bar-fill");
  const loadingStatus = document.getElementById("loading-status");
  const bootLog        = document.getElementById("boot-log");

  const LOADING_STEPS = [
    { at: 0,  msg: "INITIALIZING SECURE CHANNEL...",     log: "[core] booting wanzz-deploy runtime" },
    { at: 18, msg: "MENGHUBUNGI SERVER BACKEND...",       log: "[api] GET /api/status" },
    { at: 45, msg: "MEMVERIFIKASI KREDENSIAL SERVER...",  log: "[env] reading server environment variables" },
    { at: 70, msg: "MENGAMBIL REPOSITORY...",             log: "[api] GET /api/github" },
    { at: 88, msg: "MENYIAPKAN DASHBOARD...",             log: "[ui] compiling dashboard modules" },
    { at: 100,msg: "AKSES DIBERIKAN. SELAMAT DATANG.",    log: "[core] ready" },
  ];

  let pct = 0;
  let stepIndex = 0;

  const interval = setInterval(() => {
    pct += Math.random() * 4 + 2;
    if (pct >= 100) pct = 100;

    percentNum.textContent = Math.floor(pct);
    barFill.style.width = pct + "%";

    while (stepIndex < LOADING_STEPS.length && pct >= LOADING_STEPS[stepIndex].at){
      const step = LOADING_STEPS[stepIndex];
      loadingStatus.textContent = step.msg;
      const line = document.createElement("div");
      line.textContent = "> " + step.log;
      bootLog.appendChild(line);
      bootLog.scrollTop = bootLog.scrollHeight;
      stepIndex++;
    }

    if (pct >= 100){
      clearInterval(interval);
      setTimeout(() => { window.location.href = "dashboard.html"; }, 450);
    }
  }, 110);

})();
