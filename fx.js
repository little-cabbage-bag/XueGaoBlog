/* XueGao's Blog · 视觉特效：海面画布（盐粒/光点/涟漪）、光标、景深视差、磁吸按钮、卡片倾斜 */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fine = matchMedia("(pointer: fine)").matches;
  const ptr = { x: innerWidth / 2, y: innerHeight / 2, active: false };

  /* ---------- 海面画布 ---------- */
  const cv = $(".sea-canvas");
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1, parts = [], rings = [];
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(150, (W * H) / 11000));
    while (parts.length < n) parts.push(spawn(true));
    parts.length = n;
  };
  const spawn = (anywhere) => ({
    x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10,
    vx: 0, vy: 0, z: 0.4 + Math.random() * 0.9,           // z：景深，越大越近、越亮、越快
    r: 0.6 + Math.random() * 1.6, sparkle: Math.random() < 0.12,
    ph: Math.random() * Math.PI * 2,
  });
  const ring = (x, y, big) => rings.push({ x, y, r: big ? 4 : 2, max: big ? 160 : 46, life: 1, w: big ? 1.2 : 0.8 });
  addEventListener("resize", resize);
  resize();

  let lastRing = 0, lastScroll = scrollY, t = 0, running = true;
  addEventListener("pointermove", (e) => {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.active = true;
    const now = performance.now();
    if (e.pointerType === "mouse" && now - lastRing > 90) { ring(ptr.x, ptr.y, false); lastRing = now; }
  }, { passive: true });
  addEventListener("pointerleave", () => (ptr.active = false));
  addEventListener("pointerdown", (e) => { ring(e.clientX, e.clientY, true); setTimeout(() => ring(e.clientX, e.clientY, true), 140); }, { passive: true });
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) requestAnimationFrame(frame); });

  function frame() {
    if (!running) return;
    t += 0.006;
    const dy = scrollY - lastScroll; lastScroll = scrollY;
    ctx.clearRect(0, 0, W, H);

    for (const p of parts) {
      // 缓慢的洋流 + 上浮
      const flowX = Math.sin(p.y * 0.004 + t * 2 + p.ph) * 0.18;
      const flowY = -0.12 - Math.cos(p.x * 0.003 + t) * 0.06;
      // 指针附近：被轻轻推开，并带一点旋涡
      if (ptr.active) {
        const dx = p.x - ptr.x, dyp = p.y - ptr.y, d2 = dx * dx + dyp * dyp;
        if (d2 < 22000) {
          const d = Math.sqrt(d2) || 1, f = (1 - d / 148) * 0.9;
          p.vx += (dx / d) * f + (-dyp / d) * f * 0.35;
          p.vy += (dyp / d) * f + (dx / d) * f * 0.35;
        }
      }
      p.vx = p.vx * 0.92 + flowX * 0.08 * p.z;
      p.vy = p.vy * 0.92 + flowY * 0.08 * p.z;
      p.x += p.vx + flowX * p.z;
      p.y += p.vy + flowY * p.z - dy * 0.15 * p.z; // 滚动时近处的颗粒移动得更多
      if (p.y < -12) Object.assign(p, spawn(false));
      if (p.y > H + 14) p.y = -10;
      if (p.x < -12) p.x = W + 10; else if (p.x > W + 12) p.x = -10;

      const tw = 0.55 + Math.sin(t * 6 + p.ph) * 0.45;
      if (p.sparkle) {
        const s = p.r * 2.6 * p.z;
        ctx.strokeStyle = `rgba(184,152,92,${(0.35 + tw * 0.45) * p.z})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(74,128,138,${(0.16 + tw * 0.2) * p.z})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.z, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 指针附近的细线：像水面下连起来的光
    if (ptr.active) {
      ctx.lineWidth = 0.6;
      for (const p of parts) {
        const dx = p.x - ptr.x, dyp = p.y - ptr.y, d2 = dx * dx + dyp * dyp;
        if (d2 < 30000) {
          ctx.strokeStyle = `rgba(74,128,138,${0.22 * (1 - Math.sqrt(d2) / 173)})`;
          ctx.beginPath(); ctx.moveTo(ptr.x, ptr.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
      }
    }

    // 涟漪
    for (let i = rings.length - 1; i >= 0; i--) {
      const g = rings[i];
      g.r += (g.max - g.r) * 0.06 + 0.4; g.life -= 0.016;
      if (g.life <= 0) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(74,128,138,${g.life * 0.45})`;
      ctx.lineWidth = g.w;
      ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r, g.r * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- 自定义光标 ---------- */
  if (fine) {
    const dot = $(".cursor-dot"), ringEl = $(".cursor-ring"), label = ringEl.firstElementChild;
    const LABEL = { flip: "flip", draw: "draw", copy: "copy" };
    let rx = ptr.x, ry = ptr.y;
    document.documentElement.classList.add("has-cursor");
    const sense = (node) => {
      const target = node?.closest?.("a, button, [role='button'], summary, [data-cursor]");
      const key = target?.dataset.cursor || (target?.matches("[data-copy]") ? "copy" : "");
      ringEl.classList.toggle("is-hover", !!target && !key);
      ringEl.classList.toggle("has-label", !!key);
      if (key) label.textContent = LABEL[key] || key;
    };
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      dot.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
      sense(e.target);
    }, { passive: true });
    // 滚动时鼠标没动，但底下的元素变了，需要重新判断
    addEventListener("scroll", () => sense(document.elementFromPoint(ptr.x, ptr.y)), { passive: true });
    addEventListener("pointerdown", () => ringEl.classList.add("is-down"));
    addEventListener("pointerup", () => ringEl.classList.remove("is-down"));
    const root = document.documentElement;
    root.addEventListener("mouseleave", () => root.classList.remove("has-cursor"));
    root.addEventListener("mouseenter", () => root.classList.add("has-cursor"));
    const follow = () => {
      rx += (ptr.x - rx) * 0.18; ry += (ptr.y - ry) * 0.18;
      ringEl.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }

  /* ---------- 首屏：景深视差 + 跟随指针的日光 ---------- */
  const hero = $(".hero");
  const layers = $$("[data-depth]", hero).map((el) => ({ el, d: +el.dataset.depth }));
  if (fine) {
    hero.addEventListener("pointermove", (e) => {
      const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
      layers.forEach(({ el, d }) => (el.style.translate = `${(x * d * 22).toFixed(1)}px ${(y * d * 16).toFixed(1)}px`));
      hero.style.setProperty("--sx", `${(e.clientX / innerWidth) * 100}%`);
      hero.style.setProperty("--sy", `${(e.clientY / innerHeight) * 100}%`);
    });
    hero.addEventListener("pointerleave", () => layers.forEach(({ el }) => (el.style.translate = "")));
  }

  /* ---------- 滚动视差：大号编号与日期轻轻错位 ---------- */
  const para = $$(".sec-head .num, .post-date b, .portrait .ghost");
  let pt = false;
  const onPara = () => {
    pt = false;
    para.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const off = (r.top + r.height / 2 - innerHeight / 2) * -0.12;
      el.style.translate = `0 ${off.toFixed(1)}px`;
    });
  };
  addEventListener("scroll", () => { if (!pt) { pt = true; requestAnimationFrame(onPara); } }, { passive: true });
  onPara();

  if (!fine) return;

  /* ---------- 磁吸按钮 ---------- */
  $$(".btn, .filters button, .chips button").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1)}px`;
    });
    b.addEventListener("pointerleave", () => (b.style.translate = ""));
  });

  /* ---------- 卡片：3D 倾斜 + 光斑 ---------- */
  $$(".card, .scene, .post-body, .console-frame, .cmd").forEach((c) => {
    c.setAttribute("data-tilt", "");
    const max = c.matches(".post-body") ? 3 : c.matches(".cmd") ? 8 : 6;
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      c.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      c.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      c.style.transform = `perspective(900px) rotateX(${((0.5 - py) * max).toFixed(2)}deg) rotateY(${((px - 0.5) * max).toFixed(2)}deg) translateY(-4px)`;
    });
    c.addEventListener("pointerleave", () => (c.style.transform = ""));
  });
})();
