/* XueGao's Blog · 交互：撕纸边缘、海浪泡沫、滚动显现、群聊演示、筛选、复制 */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 撕纸：用固定种子生成锯齿 polygon，每次刷新形状一致 ---------- */
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  // 纸片：在底边（或上下两边）撕出不规则边缘，深度按像素换算成百分比
  function tearPaper(el, i) {
    const r = rng(97 + i * 131);
    const h = el.offsetHeight || 1;
    const depth = (px) => (px / h) * 100;
    const steps = Math.max(18, Math.round(el.offsetWidth / 14));
    const edge = (base, dir) => {
      const pts = [];
      for (let k = 0; k <= steps; k++) {
        const x = (k / steps) * 100;
        const d = depth(2 + r() * 7 + (k % 3 === 0 ? r() * 4 : 0));
        pts.push(`${x.toFixed(2)}% ${(base + dir * d).toFixed(2)}%`);
      }
      return pts;
    };
    const mode = el.dataset.tear;
    const top = mode === "both" ? edge(0, 1) : ["0% 0%", "100% 0%"];
    const bottom = edge(100, -1).reverse();
    el.style.setProperty("--tear", `polygon(${[...top, ...bottom].join(",")})`);
  }

  // 分隔条：顶部锯齿、底部平直，叠在上一段的底边上
  function tearEdge(el, i) {
    const r = rng(7 + i * 53);
    const steps = Math.max(30, Math.round(innerWidth / 16));
    const pts = ["0% 100%"];
    for (let k = 0; k <= steps; k++) {
      const y = 25 + r() * 55 + (k % 4 === 0 ? r() * 20 : 0);
      pts.push(`${((k / steps) * 100).toFixed(2)}% ${Math.min(y, 100).toFixed(1)}%`);
    }
    pts.push("100% 100%");
    el.style.setProperty("--tear", `polygon(${pts.join(",")})`);
  }

  const applyTears = () => {
    $$("[data-tear]").forEach(tearPaper);
    $$("[data-tear-edge]").forEach(tearEdge);
  };
  applyTears();
  addEventListener("load", applyTears);
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(applyTears, 150); });

  /* ---------- 海浪泡沫 ---------- */
  if (!reduced) {
    const layer = $(".hero .foam-layer");
    const r = rng(2024);
    for (let k = 0; layer && k < 14; k++) {
      const s = document.createElement("span");
      s.className = "foam";
      s.style.cssText = `--x:${(r() * 100).toFixed(1)}%;--s:${(3 + r() * 6).toFixed(1)}px;--d:${(6 + r() * 7).toFixed(1)}s;--dl:${(r() * 8).toFixed(1)}s`;
      layer.appendChild(s);
    }
  }

  /* ---------- 滚动显现 ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  $$(".reveal").forEach((el) => io.observe(el));

  /* ---------- 群聊演示：消息依次出现 ---------- */
  const chat = $("[data-chat]");
  if (chat) {
    const items = [...chat.children];
    const play = () => items.forEach((m, k) => setTimeout(() => m.classList.add("shown"), reduced ? 0 : 350 + k * 650));
    const co = new IntersectionObserver(([e]) => { if (e.isIntersecting) { play(); co.disconnect(); } }, { threshold: 0.35 });
    co.observe(chat);
  }

  /* ---------- 导航：滚动状态、阅读进度、当前章节 ---------- */
  const nav = $("#nav");
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle("is-scrolled", y > 24);
    const max = document.documentElement.scrollHeight - innerHeight;
    nav.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : 0);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const links = $$(".nav-links a");
  const so = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => {
        if (a.hash === `#${e.target.id}`) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  links.forEach((a) => { const s = $(a.hash); if (s) so.observe(s); });
  so.observe($(".hero")); // 回到首屏时清除高亮（首屏没有 id，不会匹配任何链接）

  const toggle = $(".nav-toggle");
  const menu = $("#nav-links");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
    menu.classList.toggle("is-open", open);
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  links.forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* ---------- 能力筛选 ---------- */
  const filters = $$("[data-filter]");
  filters.forEach((b) => b.addEventListener("click", () => {
    const f = b.dataset.filter;
    filters.forEach((x) => x.setAttribute("aria-pressed", x === b));
    $$("[data-group]").forEach((g) => { g.hidden = f !== "all" && g.dataset.group !== f; });
    // 被隐藏过的卡片重新出现时，确保已显现
    $$("[data-group]:not([hidden]) .reveal").forEach((el) => el.classList.add("is-in"));
    requestAnimationFrame(applyTears);
  }));

  /* ---------- 复制命令 ---------- */
  const toast = $(".toast");
  let tt;
  const say = (msg) => {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(tt);
    tt = setTimeout(() => toast.classList.remove("show"), 1800);
  };
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const t = Object.assign(document.createElement("textarea"), { value: text });
      t.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(t); t.select();
      const ok = document.execCommand("copy"); t.remove(); return ok;
    }
  };
  $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const text = b.dataset.copy;
    const ok = await copyText(text);
    say(ok ? `已复制 ${text.trim()}` : "复制失败，请手动输入");
    if (ok) { b.classList.add("copied"); setTimeout(() => b.classList.remove("copied"), 1200); }
  }));
})();
