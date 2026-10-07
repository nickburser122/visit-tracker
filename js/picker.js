const PICKER = (() => {
  const { esc, icons, p2, lastDay, addDays, fm } = UI;
  const Q = ["الأول", "الثاني", "الثالث", "الرابع"];
  const ym = d => d.slice(0, 7);
  const shiftMonth = (m, n) => { let y = +m.slice(0, 4), k = +m.slice(5, 7) - 1 + n; y += Math.floor(k / 12); k = ((k % 12) + 12) % 12; return y + "-" + p2(k + 1); };
  const mStart = m => m + "-01";
  const mEnd = m => m + "-" + p2(lastDay(+m.slice(0, 4), +m.slice(5, 7)));
  const mCount = (a, z) => (+z.slice(0, 4) - +a.slice(0, 4)) * 12 + (+z.slice(5, 7) - +a.slice(5, 7)) + 1;
  const dCount = (a, z) => Math.round((Date.parse(z) - Date.parse(a)) / 864e5) + 1;
  const fullMonths = (a, z) => !!a && a.slice(8) === "01" && z === mEnd(ym(z));
  const sort2 = (x, y) => x <= y ? [x, y] : [y, x];
  const contiguous = ms => ms.every((m, i) => !i || shiftMonth(ms[i - 1], 1) === m);
  const digits = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const MKEYS = Object.keys(MONTHS_AR).map(k => [NZ(k), MONTHS_AR[k]]).sort((a, b) => b[0].length - a[0].length);
  const monthWord = w => { const z = NZ(w); if (z.length < 3) return 0; const h = MKEYS.find(([k]) => z.startsWith(k) || k.startsWith(z)); return h ? h[1] : 0; };

  function describe(a, z) {
    if (!a) return "كل الفترة";
    z = z || a;
    if (fullMonths(a, z)) {
      const n = mCount(a, z), mo = +a.slice(5, 7), y = a.slice(0, 4);
      if (n === 1) return UI.mlabel(ym(a));
      if (n === 12 && mo === 1) return "سنة " + y;
      if (n === 3 && (mo - 1) % 3 === 0) return "الربع " + Q[(mo - 1) / 3] + " " + y;
      const ma = MONTH_LABEL[mo - 1], mz = MONTH_LABEL[+z.slice(5, 7) - 1], yz = z.slice(0, 4);
      return y === yz ? ma + " – " + mz + " " + y : ma + " " + y + " – " + mz + " " + yz;
    }
    return UI.rangeLabel(a, z);
  }

  function describeMonths(ms) {
    if (!ms.length) return "كل الفترة";
    ms = [...ms].sort();
    if (contiguous(ms)) return describe(mStart(ms[0]), mEnd(ms[ms.length - 1]));
    const ys = [...new Set(ms.map(m => m.slice(0, 4)))];
    if (ys.length === 1) return ms.map(m => MONTH_SHORT[+m.slice(5) - 1]).join("، ") + " " + ys[0];
    return ms.length + " شهور";
  }

  function curRange() {
    const f = S.filters;
    if (f.from || f.to) return sort2(f.from || f.to, f.to || f.from);
    if (f.months.length) {
      const ms = [...f.months].sort();
      if (contiguous(ms)) return [mStart(ms[0]), mEnd(ms[ms.length - 1])];
    }
    return ["", ""];
  }

  function label() {
    const f = S.filters;
    if (f.from || f.to) { const [a, z] = curRange(); return describe(a, z); }
    return describeMonths(f.months);
  }

  function shift(a, z, dir) {
    if (fullMonths(a, z)) { const n = mCount(a, z) * dir; return [mStart(shiftMonth(ym(a), n)), mEnd(shiftMonth(ym(z), n))]; }
    const n = dCount(a, z) * dir;
    return [addDays(a, n), addDays(z, n)];
  }
  function prev() {
    const [a, z] = curRange();
    if (!a) return null;
    const [x, y] = shift(a, z, -1);
    return { from: x, to: y, label: describe(x, y) };
  }
  function canStep(dir) {
    const b = bounds();
    if (!b.z) return false;
    const f = S.filters;
    if (f.months.length && !(f.from || f.to) && !contiguous([...f.months].sort())) return false;
    const [a, z] = curRange();
    if (!a) return dir < 0;
    const [x, y] = shift(a, z, dir);
    return dir > 0 ? x <= b.z : y >= b.a;
  }
  function step(dir) {
    const b = bounds();
    if (!b.z || !canStep(dir)) return false;
    const [a, z] = curRange();
    const f = S.filters;
    if (!a) { f.months = [ym(b.z)]; f.from = f.to = ""; return true; }
    const [x, y] = shift(a, z, dir);
    if (fullMonths(x, y)) { const ms = []; for (let m = ym(x); m <= ym(y); m = shiftMonth(m, 1)) ms.push(m); f.months = ms; f.from = f.to = ""; }
    else { f.from = x; f.to = y; f.months = []; }
    return true;
  }

  function parseTyped(s, end, year) {
    s = digits(s).trim();
    if (!s) return { v: "" };
    let m = s.match(/^(\d{1,2})\s*[\/\-.]\s*(\d{4})$/) || s.match(/^(\d{4})\s*[\/\-.]\s*(\d{1,2})$/);
    if (m) {
      const [y, mo] = m[1].length === 4 ? [+m[1], +m[2]] : [+m[2], +m[1]];
      if (mo >= 1 && mo <= 12) { const k = y + "-" + p2(mo); return { v: end ? mEnd(k) : mStart(k), month: true }; }
    }
    m = s.match(/^([\u0621-\u064aA-Za-z]{3,})\s*(\d{2,4})?$/);
    if (m) {
      const mo = monthWord(m[1]);
      if (mo) { const y = m[2] ? (+m[2] < 100 ? 2000 + +m[2] : +m[2]) : year; const k = y + "-" + p2(mo); return { v: end ? mEnd(k) : mStart(k), month: true }; }
    }
    const d = ENG.toDate(s, "dmy", year);
    return d ? { v: d } : { err: true };
  }

  let cache = null;
  function stats() {
    if (cache && cache.items === ENG.M.items) return cache;
    const ds = {}, ms = {}, mn = {};
    for (const it of ENG.M.items) { ds[it.v.d] = (ds[it.v.d] || 0) + it.sum; ms[it.v.m] = (ms[it.v.m] || 0) + it.sum; }
    for (const v of ENG.M.visits) mn[v.m] = (mn[v.m] || 0) + 1;
    return cache = { items: ENG.M.items, ds, ms, mn };
  }

  function open(anchor, onApply) {
    const b = bounds(), st = stats();
    const days = ENG.M.meta.days || {};
    const f = S.filters;
    const years = [...new Set(Object.keys(st.mn).map(m => +m.slice(0, 4)))].sort();
    const dataYear = b.z ? +b.z.slice(0, 4) : +UI.today().slice(0, 4);
    let mode = f.from || f.to ? "range" : "months";
    let sel = new Set(f.from || f.to ? [] : f.months);
    let year = sel.size ? +[...sel].sort().pop().slice(0, 4) : dataYear;
    let from = f.from || "", to = f.to && f.to !== f.from ? f.to : "";
    const maxM = Math.max(1, ...Object.values(st.mn));

    const body = UI.open(anchor, "", { cls: "dp-pop", min: 380, title: "الفترة", align: "end" });
    if (!body) return;
    const fmtIn = d => d ? +d.slice(8) + "/" + +d.slice(5, 7) + "/" + d.slice(0, 4) : "";
    body.innerHTML = '<div class="dp">' +
      '<div class="seg dp-mode" role="tablist"><button type="button" data-mode="months">شهور</button><button type="button" data-mode="range">تاريخ محدد</button></div>' +
      '<div class="dp-pane" data-pane="months"><div class="dp-yr"><button type="button" class="icon-btn sm" data-y="-1" aria-label="السنة السابقة">' + icons.chevR + '</button><b data-ytitle></b><button type="button" class="icon-btn sm" data-y="1" aria-label="السنة التالية">' + icons.chevL + '</button></div>' +
      '<div class="dp-mgrid" role="group" aria-label="الشهور"></div><div class="dp-q"></div></div>' +
      '<div class="dp-pane" data-pane="range"><div class="dp-in"><label class="fl"><span>من</span><input class="txt" id="dp-from" inputmode="numeric" autocomplete="off" placeholder="يوم/شهر/سنة" value="' + esc(fmtIn(from)) + '"><small data-hint="from"></small></label>' +
      '<label class="fl"><span>إلى <i class="mut">(اختياري)</i></span><input class="txt" id="dp-to" inputmode="numeric" autocomplete="off" placeholder="نفس اليوم" value="' + esc(fmtIn(to)) + '"><small data-hint="to"></small></label></div>' +
      '<p class="note sm">أمثلة: <b>7/4</b> · <b>7/4/2025</b> · <b>15 مارس</b> · <b>4/2025</b> لشهر كامل. السنة الافتراضية ' + dataYear + '.</p></div>' +
      '<div class="dp-ft"><div class="dp-sum"><b></b><small></small></div><div class="row"><button type="button" class="lnk" data-clear>كل الفترة</button><button type="button" class="btn sm solid" data-done>تطبيق</button></div></div></div>';

    const inF = body.querySelector("#dp-from"), inT = body.querySelector("#dp-to");
    let pf = parseTyped(inF.value, false, dataYear), pt = parseTyped(inT.value, true, dataYear);

    function draft() {
      if (mode === "months") return { months: [...sel].sort(), from: "", to: "" };
      if (pf.err || pt.err || !pf.v) return null;
      let a = pf.v, z = pt.v || (pf.month ? parseTyped(inF.value, true, dataYear).v : pf.v);
      [a, z] = sort2(a, z);
      return { months: [], from: a, to: z };
    }

    function paintMonths() {
      body.querySelector("[data-ytitle]").textContent = year;
      body.querySelector('[data-y="-1"]').disabled = years.length ? year <= years[0] : false;
      body.querySelector('[data-y="1"]').disabled = years.length ? year >= years[years.length - 1] : false;
      let h = "";
      for (let i = 1; i <= 12; i++) {
        const k = year + "-" + p2(i), n = st.mn[k] || 0;
        h += '<button type="button" class="dp-mo' + (n ? " has" : "") + (sel.has(k) ? " on" : "") + '" data-k="' + k + '" aria-pressed="' + sel.has(k) + '"><b>' + MONTH_LABEL[i - 1] + "</b><small>" + (n ? n + " زيارة" : "—") + "</small>" + (n ? '<i style="--w:' + Math.max(8, Math.round(n / maxM * 100)) + '%"></i>' : "") + "</button>";
      }
      body.querySelector(".dp-mgrid").innerHTML = h;
      const ym12 = [...Array(12).keys()].map(i => year + "-" + p2(i + 1));
      const allOn = ym12.every(k => sel.has(k));
      body.querySelector(".dp-q").innerHTML = '<button type="button" class="dp-p' + (allOn ? " on" : "") + '" data-q="y">السنة كلها</button>' + Q.map((q, i) => { const ks = ym12.slice(i * 3, i * 3 + 3), on = ks.every(k => sel.has(k)); return '<button type="button" class="dp-p' + (on ? " on" : "") + '" data-q="' + i + '">ر' + (i + 1) + "</button>"; }).join("") + (sel.size ? '<button type="button" class="dp-p ghost" data-q="none">إلغاء التحديد</button>' : "");
    }

    function paintHints() {
      const hf = body.querySelector('[data-hint="from"]'), ht = body.querySelector('[data-hint="to"]');
      const hint = (el, p, inp) => { el.textContent = p.err ? "تاريخ غير مفهوم" : p.v ? (p.month ? "شهر " + UI.mlabel(ym(p.v)) : UI.dlabel(p.v) + " · " + UI.wday(p.v)) : ""; el.className = p.err ? "bad" : ""; inp.classList.toggle("bad", !!p.err); };
      hint(hf, pf, inF); hint(ht, pt, inT);
    }

    function paint() {
      body.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.mode === mode)));
      body.querySelectorAll("[data-pane]").forEach(x => x.hidden = x.dataset.pane !== mode);
      if (mode === "months") paintMonths(); else paintHints();
      const d = draft();
      const s = body.querySelector(".dp-sum");
      const done = body.querySelector("[data-done]");
      done.disabled = !d;
      if (!d) { s.querySelector("b").textContent = "أدخل تاريخاً صحيحاً"; s.querySelector("small").textContent = ""; return; }
      let n = 0, sum = 0;
      const inSel = d.from ? k => k >= d.from && k <= d.to : d.months.length ? (ms => k => ms.has(k.slice(0, 7)))(new Set(d.months)) : () => true;
      for (const k in days) if (inSel(k)) n += days[k];
      for (const k in st.ds) if (inSel(k)) sum += st.ds[k];
      s.querySelector("b").textContent = d.from ? describe(d.from, d.to) : describeMonths(d.months);
      s.querySelector("small").textContent = n + " زيارة · " + fm(sum) + " جنيه";
      UI.place();
    }

    const apply = () => { const d = draft(); if (!d) return; f.months = d.months; f.from = d.from; f.to = d.to; onApply(); UI.close(); };

    body.addEventListener("click", e => {
      const t = e.target.closest("button");
      if (!t || t.disabled) return;
      if (t.dataset.mode) { mode = t.dataset.mode; paint(); if (mode === "range" && !UI.mobile()) inF.focus(); return; }
      if (t.dataset.y) { year += +t.dataset.y; return paint(); }
      if (t.dataset.k) { const k = t.dataset.k; sel.has(k) ? sel.delete(k) : sel.add(k); return paint(); }
      if (t.dataset.q) {
        const ks = [...Array(12).keys()].map(i => year + "-" + p2(i + 1));
        if (t.dataset.q === "none") { sel.clear(); return paint(); }
        const part = t.dataset.q === "y" ? ks : ks.slice(+t.dataset.q * 3, +t.dataset.q * 3 + 3);
        const on = part.every(k => sel.has(k));
        part.forEach(k => on ? sel.delete(k) : sel.add(k));
        return paint();
      }
      if (t.hasAttribute("data-clear")) { f.months = []; f.from = f.to = ""; onApply(); UI.close(); return; }
      if (t.hasAttribute("data-done")) apply();
    });
    body.addEventListener("dblclick", e => { const t = e.target.closest("[data-k]"); if (t) { sel = new Set([t.dataset.k]); apply(); } });
    const onIn = () => { pf = parseTyped(inF.value, false, dataYear); pt = parseTyped(inT.value, true, dataYear); paint(); };
    inF.addEventListener("input", onIn);
    inT.addEventListener("input", onIn);
    [inF, inT].forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (i === inF && !inT.value && e.shiftKey) return inT.focus(); apply(); } }));
    paint();
    setTimeout(() => { if (UI.mobile()) return; (mode === "range" ? inF : body.querySelector(".dp-mo.on, .dp-mo.has"))?.focus({ preventScroll: true }); }, 0);
  }

  return { open, label, describe, describeMonths, prev, step, canStep, shiftMonth, contiguous };
})();
