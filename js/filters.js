const FILTERS = (() => {
  const { esc, icons, fm } = UI;
  const CAR = [["nocar", "بدون سيارة"], ["car", "بسيارة الهيئة"]];
  const ZONE = [["out", "خارج دمنهور"], ["in", "داخل دمنهور"]];
  const AMT = [["pos", "له مبلغ"], ["zero", "بلا مبلغ"], ["miss", "بلا سعر"]];
  const LBL = Object.fromEntries([...CAR, ...ZONE, ...AMT]);
  const KIND_L = Object.fromEntries(ENG.KINDS);
  const KIND_F = { travel: "أجرة الانتقال", allow: "بدل سفر", class: "بدل داخلي", service: "سيرفيس دمنهور" };
  const LIMIT = 8;
  let root, ctrls = {}, lastMonth = null, fcache = { k: "", v: null };

  const metaList = key => Object.entries(ENG.M.meta[key]).map(([v, o]) => ({ v, l: o.l, n: o.n }));
  const purpOpts = () => metaList("purp").sort((a, b) => (b.v === "plan") - (a.v === "plan") || b.n - a.n);
  const fixed = list => () => list.map(([v, l]) => ({ v, l }));
  const GROUPS = [
    { k: "purp", l: "الغرض", icon: "spark", opts: purpOpts },
    { k: "car", l: "الانتقال", icon: "car", opts: fixed(CAR) },
    { k: "zone", l: "النطاق", icon: "pin", opts: fixed(ZONE) },
    { k: "people", l: "الأفراد", icon: "user", opts: () => metaList("people").sort((a, b) => b.n - a.n), wide: true },
    { k: "amt", l: "المبلغ", icon: "coin", opts: fixed(AMT) },
    { k: "kinds", l: "نوع البند", icon: "list", opts: () => ENG.KINDS.map(([v, l]) => ({ v, l: KIND_F[v] || l })) },
    { k: "types", l: "نوع الجهة", icon: "building", opts: () => metaList("types").sort((a, b) => b.n - a.n) },
    { k: "bands", l: "المسافة", icon: "route", opts: () => ENG.BANDS.filter(b => ENG.M.meta.bands[b]).map(b => ({ v: b, l: ENG.bandLabel(b) })) },
    { k: "cities", l: "المدينة", icon: "pin", opts: () => metaList("cities").sort((a, b) => b.n - a.n) },
    { k: "ents", l: "الجهة", icon: "building", opts: () => metaList("ents").sort((a, b) => b.n - a.n), wide: true }
  ];
  const GK = Object.fromEntries(GROUPS.map(g => [g.k, g]));
  const KEYS = GROUPS.map(g => g.k);

  function counts() {
    const k = ver + "|" + JSON.stringify(S.filters) + "|" + S.excl.join(",");
    if (fcache.k !== k) fcache = { k, v: ENG.facets(S.filters) };
    return fcache.v;
  }
  function labelOf(k, v) {
    if (k === "kinds") return KIND_F[v] || KIND_L[v] || v;
    if (k === "bands") return ENG.bandLabel(v);
    if (LBL[v] && (k === "car" || k === "zone" || k === "amt")) return LBL[v];
    const m = ENG.M.meta[k];
    return m && m[v] ? m[v].l : v;
  }

  function changed() { saveUi(); sync(); update(); }
  function toggle(k, v) { const s = new Set(S.filters[k]); s.has(v) ? s.delete(v) : s.add(v); S.filters[k] = [...s]; changed(); }

  function strip() {
    const el = document.createElement("div");
    el.className = "mstrip";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", "الشهور");
    el.onclick = e => {
      const f = S.filters;
      const yr = e.target.closest("[data-y]");
      const mb = e.target.closest("[data-m]");
      if (!yr && !mb) return;
      const months = Object.keys(ENG.M.meta.months).sort();
      const sel = new Set(f.from || f.to ? [] : f.months);
      f.from = f.to = "";
      if (yr) {
        const ym = months.filter(m => m.startsWith(yr.dataset.y));
        const allOn = ym.every(m => sel.has(m));
        ym.forEach(m => allOn ? sel.delete(m) : sel.add(m));
      } else {
        const k = mb.dataset.m;
        if (e.shiftKey && lastMonth) { const [a, z] = [lastMonth, k].sort(); months.filter(m => m >= a && m <= z).forEach(m => sel.add(m)); }
        else if (e.ctrlKey || e.metaKey || sel.size > 1) sel.has(k) ? sel.delete(k) : sel.add(k);
        else if (sel.size === 1 && sel.has(k)) sel.clear();
        else { sel.clear(); sel.add(k); }
        lastMonth = k;
      }
      f.months = sel.size === months.length ? [] : [...sel].sort();
      changed();
    };
    el.addEventListener("contextmenu", e => {
      const mb = e.target.closest("[data-m]");
      if (!mb) return;
      e.preventDefault();
      const f = S.filters, s = new Set(f.from || f.to ? [] : f.months);
      s.has(mb.dataset.m) ? s.delete(mb.dataset.m) : s.add(mb.dataset.m);
      f.from = f.to = ""; f.months = [...s].sort(); changed();
    });
    el.sync = () => {
      const f = S.filters, meta = ENG.M.meta.months;
      const months = Object.keys(meta).sort();
      const max = Math.max(1, ...months.map(m => meta[m].n));
      const sel = new Set(f.months);
      const ranged = !!(f.from || f.to);
      const inRange = m => ranged && (m + "-31") >= (f.from || "0") && (m + "-01") <= (f.to || "9");
      let h = "", y = "";
      for (const m of months) {
        if (m.slice(0, 4) !== y) { y = m.slice(0, 4); h += (h ? '<span class="ysep" aria-hidden="true"></span>' : "") + '<button type="button" class="ychip" data-y="' + y + '" title="كل شهور ' + y + '">' + y + "</button>"; }
        const on = sel.has(m) || inRange(m);
        h += '<button type="button" class="mchip' + (inRange(m) ? " ranged" : "") + '" data-m="' + m + '" aria-pressed="' + on + '" title="' + UI.mlabel(m) + " · " + meta[m].n + ' زيارة"><span>' + MONTH_SHORT[+m.slice(5) - 1] + '</span><i style="--h:' + Math.max(10, Math.round(meta[m].n / max * 100)) + '%"></i><small>' + meta[m].n + "</small></button>";
      }
      const prev = el.scrollLeft, first = !el.dataset.ready;
      el.innerHTML = h;
      el.dataset.ready = "1";
      if (first) requestAnimationFrame(() => el.center());
      else { el.scrollLeft = prev; edge(); }
    };
    const edge = () => {
      const p = el.parentElement;
      if (!p || !el.isConnected) return;
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft);
      p.classList.toggle("more", max > 4 && pos < max - 4);
      p.classList.toggle("s", max > 4 && pos > 4);
    };
    el.center = () => {
      const t = el.querySelector('.mchip[aria-pressed="true"]') || [...el.querySelectorAll(".mchip[data-m]")].pop();
      if (t) el.scrollTo({ left: el.scrollLeft + t.getBoundingClientRect().left - el.getBoundingClientRect().left - el.clientWidth / 2 + t.offsetWidth / 2, behavior: "instant" });
      edge();
    };
    let lastW = 0;
    new ResizeObserver(() => { const w = el.clientWidth; if (Math.abs(w - lastW) > 40) { lastW = w; el.center(); } }).observe(el);
    el.addEventListener("scroll", edge, { passive: true });
    el.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) { e.preventDefault(); el.scrollLeft -= e.deltaY; } }, { passive: false });
    addEventListener("resize", edge);
    return el;
  }

  function periodBtn() {
    const w = document.createElement("div");
    w.className = "period";
    w.innerHTML = '<button type="button" class="p-step" data-s="-1" aria-label="الفترة السابقة">' + icons.chevR + '</button><button type="button" class="period-btn" aria-haspopup="dialog"></button><button type="button" class="p-step" data-s="1" aria-label="الفترة التالية">' + icons.chevL + "</button>";
    const b = w.querySelector(".period-btn");
    b.onclick = () => PICKER.open(b, () => { lastMonth = null; changed(); });
    w.querySelectorAll(".p-step").forEach(s => s.onclick = () => { if (PICKER.step(+s.dataset.s)) { lastMonth = null; changed(); } });
    w.sync = () => {
      const f = S.filters, on = !!(f.from || f.to || f.months.length);
      b.classList.toggle("has", on);
      b.innerHTML = icons.cal + '<span class="pl"><small>الفترة</small><b>' + esc(PICKER.label()) + "</b></span>" + '<span class="car">' + icons.chevD + "</span>";
      w.querySelectorAll(".p-step").forEach(s => s.disabled = !PICKER.canStep(+s.dataset.s));
    };
    return w;
  }

  function suggestions(q) {
    const nq = NZ(q);
    if (!nq) return [];
    const out = [];
    const add = (kind, label, v, l, sub) => { const z = NZ(l); if (z.includes(nq)) out.push({ kind, label, v, l, sub, rank: z.startsWith(nq) ? 0 : z.split(" ").some(w => w.startsWith(nq)) ? 1 : 2 }); };
    for (const g of GROUPS) g.opts().forEach(o => add(g.k, g.l, o.v, o.l, o.n ? o.n + " زيارة" : ""));
    Object.keys(ENG.M.meta.months).sort().reverse().forEach(k => add("months", "شهر", k, UI.mlabel(k), ENG.M.meta.months[k].n + " زيارة"));
    const order = { people: 0, purp: 1, ents: 2, cities: 3, months: 4 };
    out.sort((a, b) => a.rank - b.rank || (order[a.kind] ?? 5) - (order[b.kind] ?? 5));
    const res = out.slice(0, 12);
    res.push({ kind: "q", label: "نص", v: q, l: "كل ما يحتوي «" + q + "»" });
    return res;
  }

  function applySuggestion(s) {
    const f = S.filters;
    if (s.kind === "q") f.q = s.v;
    else { if (s.kind === "months") { if (f.from || f.to) f.months = []; f.from = f.to = ""; } if (!f[s.kind].includes(s.v)) f[s.kind] = [...f[s.kind], s.v]; }
    changed();
  }

  function omni() {
    const wrap = document.createElement("div");
    wrap.className = "omni";
    wrap.innerHTML = icons.search + '<input type="search" id="omni-input" placeholder="ابحث عن فرد، جهة، غرض، مدينة…" autocomplete="off" enterkeyhint="search" aria-label="بحث سريع"><kbd>/</kbd>';
    const inp = wrap.querySelector("input");
    let hl = 0, list = [];
    const draw = () => {
      list = suggestions(inp.value);
      if (!list.length) { if (UI.isOpen(wrap)) UI.close(); return; }
      hl = Math.min(hl, list.length - 1);
      const p = UI.isOpen(wrap) ? UI.popBody() : UI.open(wrap, "", { cls: "dd-pop omni-pop", min: 340, sheet: false });
      if (!p) return;
      p.innerHTML = '<div class="dd-list" role="listbox">' + list.map((s, i) => '<div class="dd-opt omni-opt' + (i === hl ? " hl" : "") + '" role="option" data-i="' + i + '"><span class="kind">' + esc(s.label) + '</span><span class="t">' + esc(s.l) + "</span>" + (s.sub ? '<span class="sub">' + esc(s.sub) + "</span>" : "") + "</div>").join("") + "</div>";
      UI.place();
      p.querySelector(".hl")?.scrollIntoView({ block: "nearest" });
      p.onpointerdown = e => e.preventDefault();
      p.onclick = e => { const o = e.target.closest("[data-i]"); if (o) pick(list[+o.dataset.i]); };
    };
    const pick = s => { if (!s) return; inp.value = ""; UI.close(); applySuggestion(s); if (!UI.mobile()) inp.focus(); else inp.blur(); };
    inp.oninput = () => { hl = 0; draw(); };
    inp.onkeydown = e => {
      if (e.key === "ArrowDown") { e.preventDefault(); hl = Math.min(list.length - 1, hl + 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); hl = Math.max(0, hl - 1); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); pick(list[hl]); }
      else if (e.key === "Backspace" && !inp.value) popLast();
    };
    inp.onblur = () => setTimeout(() => { if (UI.isOpen(wrap) && document.activeElement !== inp) UI.close(); }, 120);
    return wrap;
  }

  function popLast() {
    const f = S.filters;
    if (f.q) { f.q = ""; return changed(); }
    for (const k of [...KEYS].reverse()) if (f[k].length) { f[k] = f[k].slice(0, -1); return changed(); }
  }

  function morePop(anchor, g) {
    let q = "";
    const C = counts()[g.k] || {};
    const all = () => g.opts().map(o => ({ ...o, c: C[o.v] || 0 })).sort((a, b) => b.c - a.c || a.l.localeCompare(b.l, "ar"));
    const p = UI.open(anchor, '<div class="dd-sw">' + icons.search + '<input class="dd-search" type="search" placeholder="ابحث في ' + esc(g.l) + '…" aria-label="بحث"></div><div class="dd-list" role="listbox" aria-multiselectable="true"></div><div class="dd-foot"><span class="dd-count mut sm"></span><span><button type="button" class="lnk" data-a="clear">مسح</button>' + (UI.mobile() ? '<button type="button" class="btn sm solid" data-sheet-x>تم</button>' : "") + "</span></div>", { cls: "dd-pop", title: g.l, min: 300 });
    if (!p) return;
    const box = p.querySelector(".dd-list");
    const draw = () => {
      const nq = NZ(q), sel = new Set(S.filters[g.k]);
      const L = all().filter(o => !nq || NZ(o.l).includes(nq));
      box.innerHTML = L.length ? L.map(o => '<div class="dd-opt' + (!o.c && !sel.has(o.v) ? " zero" : "") + '" role="option" aria-selected="' + sel.has(o.v) + '" data-v="' + esc(o.v) + '"><span class="tick">' + icons.check + '</span><span class="t">' + esc(o.l) + '</span><span class="sub">' + o.c + "</span></div>").join("") : '<div class="dd-empty">لا نتائج</div>';
      p.querySelector(".dd-count").textContent = sel.size ? sel.size + " محدد" : "بلا تحديد = الكل";
    };
    draw();
    UI.place();
    const s = p.querySelector(".dd-search");
    if (!UI.mobile()) setTimeout(() => s.focus(), 0);
    s.oninput = () => { q = s.value; draw(); };
    p.onpointerdown = e => { if (e.target.closest(".dd-opt,.lnk")) e.preventDefault(); };
    p.onclick = e => {
      if (e.target.closest('[data-a="clear"]')) { S.filters[g.k] = []; changed(); draw(); return; }
      const o = e.target.closest(".dd-opt");
      if (o) { toggle(g.k, o.dataset.v); draw(); }
    };
  }

  function board() {
    const el = document.createElement("div");
    el.className = "fboard";
    el.onclick = e => {
      const c = e.target.closest("[data-fc]");
      if (c) { toggle(c.dataset.g, c.dataset.fc); return; }
      const x = e.target.closest("[data-gclear]");
      if (x) { S.filters[x.dataset.gclear] = []; changed(); return; }
      const m = e.target.closest("[data-gmore]");
      if (m) morePop(m, GK[m.dataset.gmore]);
    };
    el.sync = () => {
      const C = counts();
      el.innerHTML = GROUPS.map(g => {
        const opts = g.opts();
        if (!opts.length) return "";
        const sel = new Set(S.filters[g.k]);
        const cc = C[g.k] || {};
        const ranked = opts.map(o => ({ ...o, c: cc[o.v] || 0 }));
        const big = ranked.length > LIMIT + 1;
        let shown = ranked;
        if (big) {
          const top = [...ranked].sort((a, b) => b.c - a.c).filter(o => !sel.has(o.v)).slice(0, Math.max(0, LIMIT - sel.size));
          shown = [...ranked.filter(o => sel.has(o.v)), ...top];
        }
        const rest = ranked.length - shown.length;
        return '<section class="fgroup' + (g.wide ? " wide" : "") + (sel.size ? " on" : "") + '" aria-label="' + esc(g.l) + '"><header><span class="fg-ic">' + (icons[g.icon] || "") + "</span><b>" + esc(g.l) + "</b>" + (sel.size ? '<span class="fg-n">' + sel.size + '</span><button type="button" class="fg-x" data-gclear="' + g.k + '">مسح</button>' : "") + '</header><div class="fchips">' +
          shown.map(o => '<button type="button" class="fchip' + (!o.c && !sel.has(o.v) ? " zero" : "") + '" data-g="' + g.k + '" data-fc="' + esc(o.v) + '" aria-pressed="' + sel.has(o.v) + '"><span>' + esc(o.l) + "</span><small>" + o.c + "</small></button>").join("") +
          (big ? '<button type="button" class="fchip more" data-gmore="' + g.k + '">' + icons.search + "<span>" + (rest > 0 ? "+" + rest : "الكل") + "</span></button>" : "") + "</div></section>";
      }).join("") + '<p class="fboard-hint">' + icons.info + "<span>داخل المجموعة الواحدة: <b>أيٌّ منها</b> · بين المجموعات: <b>جميعها معاً</b> · الرقم بجوار كل خيار = عدد الزيارات لو أضفته</span></p>";
    };
    return el;
  }

  function chips() {
    const f = S.filters, out = [];
    for (const g of GROUPS) f[g.k].forEach(v => out.push([g.k, v, g.l, labelOf(g.k, v)]));
    if (f.q) out.push(["q", "", "نص", "«" + f.q + "»"]);
    return out;
  }
  const advCount = () => KEYS.reduce((s, k) => s + S.filters[k].length, 0);

  function mount(el) {
    root = el;
    root.innerHTML = "";
    const r1 = document.createElement("div"); r1.className = "f-row f-top";
    const r0 = document.createElement("div"); r0.className = "f-row f-period";
    const adv = document.createElement("div"); adv.className = "f-adv"; adv.id = "filters-adv";
    const r2 = document.createElement("div"); r2.className = "f-row f-chips";
    ctrls.period = periodBtn();
    ctrls.toggle = document.createElement("button");
    ctrls.toggle.type = "button";
    ctrls.toggle.className = "btn f-toggle";
    ctrls.toggle.setAttribute("aria-controls", "filters-adv");
    ctrls.toggle.onclick = () => { S.advOpen = !S.advOpen; saveUi(); paintAdv(true); };
    r1.append(ctrls.period, omni(), ctrls.toggle);
    ctrls.strip = strip();
    const sw = document.createElement("div");
    sw.className = "mstrip-wrap";
    sw.appendChild(ctrls.strip);
    r0.append(sw);
    ctrls.board = board();
    const inner = document.createElement("div"); inner.className = "f-adv-in";
    inner.append(ctrls.board);
    adv.append(inner);
    root.append(r1, r0, adv, r2);
    ctrls.adv = adv;
    ctrls.chips = r2;
    r2.onclick = e => {
      const c = e.target.closest("[data-k]");
      if (!c) return;
      const k = c.dataset.k, v = c.dataset.v;
      if (k === "__all") { const snap = JSON.stringify(S.filters); resetFilters(); changed(); UI.toast("تم المسح", { action: "تراجع", onAction: () => { S.filters = JSON.parse(snap); changed(); } }); return; }
      if (k === "__excl") { const snap = S.excl; S.excl = []; saveUi(); update(); UI.toast("أُعيدت كل البنود المستبعدة", { action: "تراجع", onAction: () => { S.excl = snap; saveUi(); update(); } }); return; }
      if (k === "__report") { ACT.dialog(); return; }
      if (k === "q") S.filters.q = "";
      else S.filters[k] = S.filters[k].filter(x => x !== v);
      changed();
    };
    if (S.advOpen == null) S.advOpen = !UI.mobile();
    if (UI.mobile()) S.advOpen = false;
    sync();
  }

  function paintToggle() {
    const n = advCount();
    ctrls.toggle.innerHTML = icons.sliders + '<span class="ft-l">التصفية</span>' + (n ? '<span class="badge">' + n + "</span>" : "") + '<span class="car">' + icons.chevD + "</span>";
    ctrls.toggle.classList.toggle("has", n > 0);
    ctrls.toggle.classList.toggle("open", !!S.advOpen);
  }
  function paintAdv(animate) {
    if (!animate) { ctrls.adv.classList.add("still"); requestAnimationFrame(() => requestAnimationFrame(() => ctrls.adv.classList.remove("still"))); }
    ctrls.adv.classList.toggle("open", !!S.advOpen);
    ctrls.toggle.setAttribute("aria-expanded", String(!!S.advOpen));
    paintToggle();
  }

  function syncChips() {
    if (!ctrls.chips || !ctrls.chips.isConnected) return;
    ctrls.board.sync();
    const cs = chips();
    const any = cs.length || S.filters.months.length || S.filters.from;
    const R = currentResult();
    const ex = R.excluded.length;
    ctrls.chips.innerHTML = '<span class="f-count"><b>' + R.visits.length + "</b> زيارة · <b>" + R.items.length + "</b> نشاط فردي · <b>" + fm(R.total) + "</b> جنيه</span>" + cs.map(([k, v, l, t]) => '<span class="chip"><small>' + esc(l) + "</small>" + esc(t) + '<button type="button" data-k="' + k + '" data-v="' + esc(v) + '" aria-label="إزالة ' + esc(t) + '">' + icons.x + "</button></span>").join("") + (ex ? '<span class="chip warn"><small>مستبعد</small>' + ex + ' نشاط<button type="button" data-k="__excl" aria-label="إعادة المستبعد">' + icons.x + "</button></span>" : "") + (any ? '<button type="button" class="lnk" data-k="__all">' + icons.reset + "مسح الكل</button>" : "") + '<span class="f-sp"></span><button type="button" class="lnk acc" data-k="__report">' + icons.report + "تقرير لهذا العرض</button>";
  }

  function sync() {
    if (!root) return;
    ctrls.period.sync();
    ctrls.strip.sync();
    paintAdv();
    syncChips();
  }

  const mq = matchMedia("(max-width: 639px)");
  mq.addEventListener("change", () => { if (!root) return; S.advOpen = false; paintAdv(); });

  document.addEventListener("keydown", e => {
    if ((e.key === "[" || e.key === "]") && root && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector(".modal") && !e.ctrlKey && !e.metaKey && !e.altKey) { if (PICKER.step(e.key === "]" ? 1 : -1)) { e.preventDefault(); lastMonth = null; changed(); } return; }
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector(".modal")) { const i = document.getElementById("omni-input"); if (i) { e.preventDefault(); i.focus(); } }
  });

  return { mount, sync, syncChips, LBL, KIND_L, GROUPS, labelOf, KEYS };
})();
