const FILTERS = (() => {
  const { esc, icons } = UI;
  const PUR = [["plan", "خطة المرور"], ["insp", "فحص"], ["other", "أخرى"]];
  const CAR = [["nocar", "بدون سيارة"], ["car", "بالسيارة"]];
  const ZONE = [["out", "خارج دمنهور"], ["in", "داخل دمنهور"]];
  const AMT = [["pos", "له مبلغ"], ["zero", "صفر"], ["miss", "بلا سعر"]];
  const LBL = Object.fromEntries([...PUR, ...CAR, ...ZONE, ...AMT]);
  const KIND_L = Object.fromEntries(ENG.KINDS);
  let root, ctrls = {}, lastMonth = null;

  const metaOpts = key => () => Object.entries(ENG.M.meta[key]).map(([v, o]) => ({ v, l: o.l, sub: o.n })).sort((a, b) => b.sub - a.sub);
  const OPTS = {
    people: metaOpts("people"),
    cities: metaOpts("cities"),
    types: metaOpts("types"),
    ents: metaOpts("ents"),
    bands: () => ENG.BANDS.filter(b => ENG.M.meta.bands[b]).map(b => ({ v: b, l: ENG.bandLabel(b), sub: ENG.M.meta.bands[b].n })),
    kinds: () => { const n = {}; for (const it of ENG.M.items) for (const k of new Set(it.ls.map(l => l.kind))) n[k] = (n[k] || 0) + 1; return ENG.KINDS.filter(([k]) => n[k]).map(([k, l]) => ({ v: k, l, sub: n[k] })); }
  };

  function changed() { saveUi(); sync(); update(); }

  function segMulti(key, items, label) {
    const el = document.createElement("div");
    el.className = "seg";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", label);
    el.innerHTML = items.map(([k, l]) => '<button type="button" data-v="' + k + '">' + l + "</button>").join("");
    el.onclick = e => {
      const b = e.target.closest("[data-v]");
      if (!b) return;
      const s = new Set(S.filters[key]);
      s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v);
      S.filters[key] = s.size === items.length ? [] : [...s];
      changed();
    };
    el.sync = () => el.querySelectorAll("[data-v]").forEach(b => b.setAttribute("aria-pressed", String(S.filters[key].includes(b.dataset.v))));
    return el;
  }

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
      const ranged = !!(f.from || f.to);
      const sel = new Set(ranged ? [] : f.months);
      f.from = f.to = "";
      if (yr) {
        const ym = months.filter(m => m.startsWith(yr.dataset.y));
        const allOn = ym.every(m => sel.has(m));
        ym.forEach(m => allOn ? sel.delete(m) : sel.add(m));
      } else {
        const k = mb.dataset.m;
        if (e.shiftKey && lastMonth) { const [a, z] = [lastMonth, k].sort(); months.filter(m => m >= a && m <= z).forEach(m => sel.add(m)); }
        else if (e.ctrlKey || e.metaKey || sel.size > 1 || (sel.size === 1 && !sel.has(k) && e.altKey)) sel.has(k) ? sel.delete(k) : sel.add(k);
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
      if (first) requestAnimationFrame(() => {
        const t = el.querySelector('.mchip[aria-pressed="true"]') || [...el.querySelectorAll(".mchip[data-m]")].pop();
        if (t) el.scrollTo({ left: el.scrollLeft + t.getBoundingClientRect().left - el.getBoundingClientRect().left - el.clientWidth / 2 + t.offsetWidth / 2, behavior: "instant" });
        edge();
      });
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
      w.classList.toggle("has", on);
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
    const L = { people: "فرد", ents: "جهة", cities: "مدينة", types: "نوع", bands: "المسافة" };
    for (const k of Object.keys(L)) OPTS[k]().forEach(o => add(k, L[k], o.v, o.l, o.sub + " زيارة"));
    PUR.forEach(([k, l]) => add("pur", "الغرض", k, l));
    AMT.forEach(([k, l]) => add("amt", "المبلغ", k, l));
    ENG.KINDS.forEach(([k, l]) => add("kinds", "البند", k, l));
    ZONE.forEach(([k, l]) => add("zone", "النطاق", k, l));
    CAR.forEach(([k, l]) => add("car", "السيارة", k, l));
    Object.keys(ENG.M.meta.months).sort().reverse().forEach(k => add("months", "شهر", k, UI.mlabel(k), ENG.M.meta.months[k].n + " زيارة"));
    const order = { people: 0, ents: 1, cities: 2, months: 3 };
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
    wrap.innerHTML = icons.search + '<input type="search" id="omni-input" placeholder="بحث…" autocomplete="off" enterkeyhint="search" aria-label="بحث سريع"><kbd>/</kbd>';
    const inp = wrap.querySelector("input");
    let hl = 0, list = [];
    const draw = () => {
      list = suggestions(inp.value);
      if (!list.length) { if (UI.isOpen(wrap)) UI.close(); return; }
      hl = Math.min(hl, list.length - 1);
      const p = UI.isOpen(wrap) ? UI.popBody() : UI.open(wrap, "", { cls: "dd-pop omni-pop", min: 340, sheet: false });
      if (!p) return;
      p.innerHTML = '<div class="dd-list" role="listbox">' + list.map((s, i) => '<div class="dd-opt omni-opt' + (i === hl ? " hl" : "") + '" role="option" data-i="' + i + '"><span class="kind">' + esc(s.label) + '</span><span class="t">' + esc(s.l) + "</span>" + (s.sub ? '<span class="sub">' + esc(s.sub) + "</span>" : "") + "</div>").join("") + '</div>';
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
    for (const k of ["kinds", "amt", "bands", "ents", "types", "cities", "people", "zone", "car", "pur"]) if (f[k].length) { f[k] = f[k].slice(0, -1); return changed(); }
  }

  function chips() {
    const f = S.filters, out = [], meta = ENG.M.meta;
    const nm = (k, v) => (meta[k][v] || { l: v }).l;
    f.people.forEach(v => out.push(["people", v, "فرد", nm("people", v)]));
    f.ents.forEach(v => out.push(["ents", v, "جهة", nm("ents", v)]));
    f.cities.forEach(v => out.push(["cities", v, "مدينة", nm("cities", v)]));
    f.types.forEach(v => out.push(["types", v, "نوع", v]));
    f.bands.forEach(v => out.push(["bands", v, "المسافة", ENG.bandLabel(v)]));
    f.pur.forEach(v => out.push(["pur", v, "الغرض", LBL[v]]));
    f.car.forEach(v => out.push(["car", v, "السيارة", LBL[v]]));
    f.zone.forEach(v => out.push(["zone", v, "النطاق", LBL[v]]));
    f.amt.forEach(v => out.push(["amt", v, "المبلغ", LBL[v]]));
    f.kinds.forEach(v => out.push(["kinds", v, "البند", KIND_L[v]]));
    if (f.q) out.push(["q", "", "نص", "«" + f.q + "»"]);
    return out;
  }
  const ADV = ["pur", "car", "zone", "amt", "kinds", "people", "cities", "types", "bands", "ents"];
  const advCount = () => { const f = S.filters; return ADV.reduce((s, k) => s + f[k].length, 0); };

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
    ctrls.pur = segMulti("pur", PUR, "الغرض");
    ctrls.car = segMulti("car", CAR, "السيارة");
    ctrls.zone = segMulti("zone", ZONE, "النطاق");
    ctrls.amt = segMulti("amt", AMT, "المبلغ");
    const segs = document.createElement("div"); segs.className = "f-segs";
    [ctrls.pur, ctrls.car, ctrls.zone, ctrls.amt].forEach(s => segs.appendChild(s));
    const dds = document.createElement("div"); dds.className = "f-dds";
    const mk = (label, key) => UI.multi({ label, value: S.filters[key], options: OPTS[key], onChange: v => { S.filters[key] = v; saveUi(); syncChips(); paintToggle(); update(); } });
    ctrls.people = mk("الأفراد", "people");
    ctrls.ents = mk("الجهة", "ents");
    ctrls.cities = mk("المدينة", "cities");
    ctrls.types = mk("نوع الجهة", "types");
    ctrls.bands = mk("المسافة", "bands");
    ctrls.kinds = mk("البند", "kinds");
    [ctrls.people, ctrls.ents, ctrls.cities, ctrls.types, ctrls.bands, ctrls.kinds].forEach(b => dds.appendChild(b));
    const inner = document.createElement("div"); inner.className = "f-adv-in";
    inner.append(segs, dds);
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
      if (k === "q") S.filters.q = "";
      else S.filters[k] = S.filters[k].filter(x => x !== v);
      changed();
    };
    if (S.advOpen == null || UI.mobile()) S.advOpen = !UI.mobile();
    sync();
  }

  function paintToggle() {
    const n = advCount();
    ctrls.toggle.innerHTML = icons.sliders + '<span class="ft-l">تصفية</span>' + (n ? '<span class="badge">' + n + "</span>" : "");
    ctrls.toggle.classList.toggle("has", n > 0);
  }
  function paintAdv(animate) {
    if (!animate) { ctrls.adv.classList.add("still"); requestAnimationFrame(() => requestAnimationFrame(() => ctrls.adv.classList.remove("still"))); }
    ctrls.adv.classList.toggle("open", !!S.advOpen);
    ctrls.toggle.setAttribute("aria-expanded", String(!!S.advOpen));
    paintToggle();
  }

  function syncChips() {
    if (!ctrls.chips || !ctrls.chips.isConnected) return;
    const cs = chips();
    const any = cs.length || S.filters.months.length || S.filters.from;
    const R = currentResult();
    const ex = R.excluded.length;
    ctrls.chips.innerHTML = '<span class="f-count"><b>' + R.visits.length + "</b> زيارة · <b>" + R.items.length + "</b> مشاركة · <b>" + UI.fm(R.total) + "</b> جنيه</span>" + cs.map(([k, v, l, t]) => '<span class="chip"><small>' + esc(l) + "</small>" + esc(t) + '<button type="button" data-k="' + k + '" data-v="' + esc(v) + '" aria-label="إزالة ' + esc(t) + '">' + icons.x + "</button></span>").join("") + (ex ? '<span class="chip warn"><small>مستبعد</small>' + ex + ' مشاركة<button type="button" data-k="__excl" aria-label="إعادة المستبعد">' + icons.x + "</button></span>" : "") + (any ? '<button type="button" class="lnk" data-k="__all">' + icons.reset + "مسح</button>" : "");
  }

  function sync() {
    if (!root) return;
    ctrls.period.sync();
    ctrls.strip.sync();
    ["pur", "car", "zone", "amt"].forEach(k => ctrls[k].sync());
    ["people", "ents", "cities", "types", "bands", "kinds"].forEach(k => ctrls[k].setValue(S.filters[k]));
    paintAdv();
    syncChips();
  }

  const mq = matchMedia("(max-width: 639px)");
  mq.addEventListener("change", () => { if (!root) return; S.advOpen = !mq.matches; paintAdv(); });

  document.addEventListener("keydown", e => {
    if ((e.key === "[" || e.key === "]") && root && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector(".modal") && !e.ctrlKey && !e.metaKey && !e.altKey) { if (PICKER.step(e.key === "]" ? 1 : -1)) { e.preventDefault(); lastMonth = null; changed(); } return; }
    if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector(".modal")) { const i = document.getElementById("omni-input"); if (i) { e.preventDefault(); i.focus(); } }
  });

  return { mount, sync, syncChips, LBL, KIND_L };
})();
