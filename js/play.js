/* XueGao's Blog · 玩法：逐字拆分、撕纸过渡、漂浮缎带、可对话的群聊、照片翻面、海边签 */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ---------- 逐字拆分（只拆文本节点，保留内部标签） ---------- */
  $$(".sec-head h2, .demo-copy h2, .footer-title").forEach((el) => el.classList.add("split"));
  $$(".split").forEach((el) => {
    const isHeading = /^H[1-6]$/.test(el.tagName);
    if (isHeading && !el.hasAttribute("aria-label")) el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 1) return walk(n);
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        for (const c of n.textContent) {
          if (/\s/.test(c)) { frag.append(c); continue; }
          const s = document.createElement("span");
          s.className = "ch"; s.textContent = c; s.style.setProperty("--i", i++);
          if (isHeading) s.setAttribute("aria-hidden", "true"); // 标题用 aria-label 朗读整句
          frag.append(s);
        }
        n.replaceWith(frag);
      });
    };
    walk(el);
  });
  // 首屏标题：等一帧再触发，才能看到逐字升起
  requestAnimationFrame(() => requestAnimationFrame(() => $(".hero h1")?.classList.add("is-in")));

  /* ---------- 过渡：滚动时纸从中间撕开 ---------- */
  const bridge = $("[data-bridge]");
  if (bridge && !reduced) {
    const top = $(".rip-top .rip-sheet", bridge), bot = $(".rip-bottom .rip-sheet", bridge);
    const makeTear = () => {
      let seed = 4242;
      const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const steps = Math.max(26, Math.round(innerWidth / 22));
      const pts = []; // 舞台坐标：y 在 47%~53% 之间抖动
      for (let k = 0; k <= steps; k++) pts.push([(k / steps) * 100, 47.5 + r() * 4 + (k % 5 === 0 ? r() * 1.5 : 0)]);
      const toTop = pts.map(([x, y]) => `${x.toFixed(2)}% ${((y / 52) * 100).toFixed(2)}%`).reverse();
      const toBot = pts.map(([x, y]) => `${x.toFixed(2)}% ${(((y - 48) / 52) * 100).toFixed(2)}%`);
      top.style.setProperty("--tear", `polygon(0% 0%,100% 0%,${toTop.join(",")})`);
      bot.style.setProperty("--tear", `polygon(${toBot.join(",")},100% 100%,0% 100%)`);
    };
    makeTear();
    addEventListener("resize", makeTear);

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = bridge.getBoundingClientRect();
      const total = bridge.offsetHeight - innerHeight;
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const p = clamp(-rect.top / total);
      const x = clamp((p - 0.1) / 0.6);
      bridge.style.setProperty("--t", (x * x * (3 - 2 * x)).toFixed(4)); // smoothstep
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- 漂浮缎带：跟随滚动速度加速，向上滚时反向 ---------- */
  const tracks = $$("[data-marquee]");
  if (tracks.length && !reduced) {
    const state = tracks.map((el) => ({ el, x: 0, dir: +el.dataset.marquee }));
    let lastY = scrollY, v = 0, flow = 1, visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe($(".ribbons"));
    const loop = () => {
      const dy = scrollY - lastY; lastY = scrollY;
      v += (dy - v) * 0.12;
      if (Math.abs(v) > 0.6) flow = Math.sign(v);
      if (visible) {
        const boost = 0.55 + Math.min(Math.abs(v), 70) * 0.18;
        state.forEach((s) => {
          const half = s.el.scrollWidth / 2;
          s.x -= s.dir * flow * boost;
          if (s.x <= -half) s.x += half;
          if (s.x > 0) s.x -= half;
          s.el.style.transform = `translate3d(${s.x.toFixed(2)}px,0,0)`;
        });
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- 群聊：点话题，看她怎么回（回复是预先写好的） ---------- */
  const chat = $("[data-chat]");
  const chips = $$("[data-chips] button");
  const SCRIPT = {
    hot: { say: "今天好热啊", quiet: "没有叫她，雪糕继续晒太阳" },
    morning: { say: "@雪糕 早上好", reply: ["早。今天天气不错，适合晒太阳。"] },
    song: { say: "@雪糕 推荐首歌", reply: ["那就听钢琴曲吧，安静一点的那种。", "想让我直接点歌的话，得先有人把音乐服务配好喵。"] },
    cute: { say: "@雪糕 你好可爱", reply: ["……突然说这个干嘛。", "不过，谢谢。"] },
    fish: { say: "@雪糕 小鱼干要吗", reply: ["要。三条。", "……不对，这不是重点。找我有什么事吗？"] },
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const msg = (who, mine, content) => {
    const m = el("div", mine ? "msg me" : "msg");
    const av = el("span", "av");
    if (mine) { av.textContent = "你"; av.style.setProperty("--c", "#23272b"); }
    else { const img = el("img"); img.src = "assets/favicon.png"; img.alt = ""; av.append(img); }
    const box = el("div"); box.append(el("div", "who", who), content);
    m.append(av, box);
    return m;
  };
  const push = (node) => {
    chat.append(node);
    requestAnimationFrame(() => node.classList.add("shown"));
    chat.scrollTop = chat.scrollHeight;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
  chips.forEach((b) => b.addEventListener("click", async () => {
    const s = SCRIPT[b.dataset.say];
    chips.forEach((c) => (c.disabled = true));
    const bubble = el("span", "bubble");
    if (s.say.startsWith("@")) { bubble.append(el("span", "at", "@雪糕"), s.say.slice(3)); } else bubble.textContent = s.say;
    push(msg("你", true, bubble));
    await wait(650);
    if (s.quiet) { push(el("p", "quiet", s.quiet)); }
    else {
      for (const line of s.reply) {
        const typing = el("span", "typing"); typing.append(el("i"), el("i"), el("i"));
        const t = msg("雪糕", false, typing); push(t);
        await wait(700 + line.length * 35);
        t.remove();
        push(msg("雪糕", false, el("span", "bubble", line)));
        await wait(350);
      }
    }
    chips.forEach((c) => (c.disabled = false));
  }));

  /* ---------- 拍立得翻面 ---------- */
  const flip = $(".flip");
  if (flip) {
    const toggle = () => {
      const on = flip.classList.toggle("is-flipped");
      flip.setAttribute("aria-pressed", on);
      $(".hero-hint")?.style.setProperty("opacity", "0");
    };
    flip.addEventListener("click", toggle);
    flip.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  }

  /* ---------- 海边签 ---------- */
  const omi = $("[data-omikuji]");
  if (omi) {
    const LOTS = [["宜", "晒太阳"], ["宜", "听一首钢琴曲"], ["宜", "早点睡"], ["宜", "吃小鱼干"], ["忌", "熬夜"],
      ["宜", "给朋友道一声早安"], ["忌", "一口气发五条消息"], ["宜", "去海边吹吹风"], ["宜", "签到"], ["忌", "空腹喝冰奶茶"], ["宜", "发一会儿呆"]];
    const k = $("[data-omi-k]"), v = $("[data-omi-v]"), out = $("[data-omi-result]");
    let last = -1, busy = false;
    omi.addEventListener("click", async () => {
      if (busy) return; busy = true;
      if (omi.classList.contains("is-open")) { omi.classList.remove("is-open"); await wait(550); }
      omi.classList.add("is-shaking"); await wait(500); omi.classList.remove("is-shaking");
      let i; do { i = Math.floor(Math.random() * LOTS.length); } while (i === last); last = i;
      k.textContent = LOTS[i][0]; v.textContent = LOTS[i][1];
      omi.classList.add("is-open");
      out.textContent = `今日${LOTS[i][0]}：${LOTS[i][1]}。—— 雪糕`;
      busy = false;
    });
  }
})();
