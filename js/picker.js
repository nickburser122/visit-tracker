const PICKER = (() => {
  const { esc, icons, p2, lastDay, addDays, fm } = UI;
  const WD = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
  const WEEK_START = 6;
  const Q = ["الأول", "الثاني", "الثالث", "الرابع"];
  const ym = d => d.slice(0, 7);
  const shiftMonth = (m, n) => { let y = +m.slice(0, 4), k = +m.slice(5, 7) - 1 + n; y += Math.floor(k / 12); k = ((k % 12) + 12) % 12; return y + "-" + p2(k + 1); };
  const mStart = m => m + "-01";
  const mEnd = m => m + "-" + p2(lastDay(+m.slice(0, 4), +m.slice(5, 7)));
  const mCount = (a, z) => (+z.slice(0, 4) - +a.slice(0, 4)) * 12 + (+z.slice(5, 7) - +a.slice(5, 7)) + 1;
  const dCount = (a, z) => Math.round((Date.parse(z) - Date.parse(a)) / 864e5) + 1;
  const fullMonths = (a, z) => !!a && a.slice(8) === "01" && z === mEnd(ym(z));
  const sort2 = (x, y) => x <= y ? [x, y] : [y, x];

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

  function curRange() {
    const f = S.filters;
    if (f.from || f.to) return sort2(f.from || f.to, f.to || f.from);
    if (f.months.length) {
      const ms = [...f.months].sort();
      if (ms.every((m, i) => !i || shiftMonth(ms[i - 1], 1) === m)) return [mStart(ms[0]), mEnd(ms[ms.length - 1])];
    }
    return ["", ""];
  }

  function label() {
    const [a, z] = curRange();
    if (a) return describe(a, z);
    return S.filters.months.length ? S.filters.months.length + " شهور" : "كل الفترة";
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
    const [a, z] = curRange();
    if (!a) return dir < 0;
    const [x, y] = shift(a, z, dir);
    return dir > 0 ? x <= b.z : y >= b.a;
  }
  function step(dir) {
    const b = bounds();
    if (!b.z || !canStep(dir)) return false;
    const [a, z] = curRange();
    let x, y;
    if (!a) { x = mStart(ym(b.z)); y = mEnd(ym(b.z)); } else [x, y] = shift(a, z, dir);
    const f = S.filters;
    f.from = x; f.to = y; f.months = [];
    return true;
  }

  let cache = null;
  function stats() {
    if (cache && cache.items === ENG.M.items) return cache;
    const ds = {}, ms = {};
    for (const it of ENG.M.items) { ds[it.v.d] = (ds[it.v.d] || 0) + it.sum; ms[it.v.m] = (ms[it.v.m] || 0) + it.sum; }
    return cache = { items: ENG.M.items, ds, ms };
  }

  function presets(b) {
    const z = b.z;
    if (!z) return [];
    const m = ym(z), y = +m.slice(0, 4), q = Math.floor((+m.slice(5, 7) - 1) / 3), qs = y + "-" + p2(q * 3 + 1), pm = shiftMonth(m, -1);
    const L = [
      ["all", "", ""],
      ["m", mStart(m), mEnd(m)],
      ["pm", mStart(pm), mEnd(pm)],
      ["d30", addDays(z, -29), z, "آخر 30 يوماً"],
      ["q", mStart(qs), mEnd(shiftMonth(qs, 2))],
      ["y", y + "-01-01", y + "-12-31"]
    ];
    if (b.a && +b.a.slice(0, 4) < y) L.push(["py", (y - 1) + "-01-01", (y - 1) + "-12-31"]);
    return L.map(([id, from, to, l]) => ({ id, from, to, l: l || describe(from, to) }));
  }

  function open(anchor, onApply) {
    const b = bounds(), st = stats();
    const days = ENG.M.meta.days || {}, mmeta = ENG.M.meta.months || {};
    const maxDay = Math.max(1, ...Object.values(days));
    const maxM = Math.max(1, ...Object.values(st.ms));
    const two = () => innerWidth >= 760;
    const P = presets(b);
    let [a, z] = curRange();
    let mode = !a || fullMonths(a, z) ? "months" : "days";
    let pickA = "", hov = "", drag = null;
    let year = +(a || b.z || UI.today()).slice(0, 4);
    let view = ym(a || b.z || UI.today());
    if (two() && (!a || ym(a) === ym(z))) view = shiftMonth(view, -1);
    let focusK = mode === "months" ? ym(a || b.z || UI.today()) : a || b.z || UI.today();

    const body = UI.open(anchor, "", { cls: "dp-pop", min: two() ? 620 : 320, title: "الفترة", align: "end" });
    if (!body) return;

    body.innerHTML = '<div class="dp"><div class="dp-pre" role="group" aria-label="فترات جاهزة">' + P.map(p => '<button type="button" class="dp-p" data-p="' + p.id + '">' + esc(p.l) + "</button>").join("") + "</div>" +
      '<div class="dp-bar"><div class="seg sm" role="group"><button type="button" data-mode="months">شهور</button><button type="button" data-mode="days">أيام</button></div>' +
      '<div class="dp-nav"><button type="button" class="icon-btn sm" data-step="-1" aria-label="السابق">' + icons.chevR + '</button><button type="button" class="dp-title" data-title></button><button type="button" class="icon-btn sm" data-step="1" aria-label="التالي">' + icons.chevL + "</button></div></div>" +
      '<div class="dp-stage"></div><div class="dp-ft"><div class="dp-sum"><b></b><small></small></div><div class="row"><button type="button" class="lnk" data-clear>مسح</button><button type="button" class="btn sm solid" data-done>تم</button></div></div></div>';
    const stage = body.querySelector(".dp-stage");

    const commit = close => { const f = S.filters; f.from = a; f.to = a ? z || a : ""; f.months = []; onApply(); if (close) UI.close(); else paint(); };
    const setMonths = (x, y) => { const [p, q] = sort2(x, y); a = mStart(p); z = mEnd(q); };
    const range = () => pickA ? sort2(pickA, hov || pickA) : a ? [a, z || a] : ["", ""];

    function monthGrid(m) {
      const y = +m.slice(0, 4), mo = +m.slice(5, 7), n = lastDay(y, mo);
      const first = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() - WEEK_START + 7) % 7;
      const td = UI.today();
      let h = '<div class="dp-month">' + (two() ? '<div class="dp-mname">' + esc(UI.mlabel(m)) + "</div>" : "") + '<div class="dp-grid">';
      for (let i = 0; i < 7; i++) h += '<span class="wd">' + WD[(i + WEEK_START) % 7] + "</span>";
      h += "<span></span>".repeat(first);
      for (let d = 1; d <= n; d++) {
        const k = m + "-" + p2(d), c = days[k] || 0;
        h += '<button type="button" class="dp-day' + (c ? " has" : "") + (k === td ? " today" : "") + '" data-k="' + k + '" tabindex="-1" aria-label="' + esc(UI.dlabel(k)) + (c ? " · " + c + " زيارة" : "") + '"><span>' + d + "</span>" + (c ? '<i style="--o:' + (0.35 + 0.65 * c / maxDay).toFixed(2) + '"></i>' : "") + "</button>";
      }
      return h + "</div></div>";
    }

    function pane(dir) {
      let h;
      if (mode === "months") {
        h = '<div class="dp-mgrid">';
        for (let i = 1; i <= 12; i++) {
          const k = year + "-" + p2(i), n = mmeta[k] ? mmeta[k].n : 0;
          h += '<button type="button" class="dp-mo' + (n ? " has" : "") + '" data-k="' + k + '" tabindex="-1"><b>' + MONTH_LABEL[i - 1] + "</b><small>" + (n ? n + " زيارة" : "—") + "</small>" + (n ? '<i style="--w:' + Math.max(6, Math.round((st.ms[k] || 0) / maxM * 100)) + '%"></i>' : "") + "</button>";
        }
        h += "</div>";
      } else h = '<div class="dp-months' + (two() ? " two" : "") + '">' + monthGrid(view) + (two() ? monthGrid(shiftMonth(view, 1)) : "") + "</div>";
      stage.innerHTML = '<div class="dp-pane' + (dir > 0 ? " fwd" : dir < 0 ? " back" : "") + '">' + h + "</div>";
      body.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.mode === mode)));
      const t = body.querySelector("[data-title]");
      t.textContent = mode === "months" ? year : two() ? describe(mStart(view), mEnd(shiftMonth(view, 1))) : UI.mlabel(view);
      t.disabled = mode === "months";
      paint();
      UI.place();
    }

    function paint() {
      const [lo, hi] = range();
      const M = mode === "months";
      const L = lo && M ? ym(lo) : lo, H = hi && M ? ym(hi) : hi;
      let focused = false;
      stage.querySelectorAll("[data-k]").forEach(el => {
        const k = el.dataset.k, on = !!L && k >= L && k <= H;
        el.classList.toggle("in", on);
        el.classList.toggle("lo", on && k === L);
        el.classList.toggle("hi", on && k === H);
        el.setAttribute("aria-pressed", String(on));
        el.tabIndex = k === focusK ? (focused = true, 0) : -1;
      });
      if (!focused) { const f = stage.querySelector("[data-k]"); if (f) f.tabIndex = 0; }
      body.querySelectorAll("[data-p]").forEach(x => { const p = P.find(q => q.id === x.dataset.p); x.classList.toggle("on", !pickA && p.from === (a || "") && p.to === (a ? z || a : "")); });
      let n = 0, sum = 0;
      for (const k in days) if (!lo || (k >= lo && k <= hi)) n += days[k];
      for (const k in st.ds) if (!lo || (k >= lo && k <= hi)) sum += st.ds[k];
      const s = body.querySelector(".dp-sum");
      s.querySelector("b").textContent = describe(lo, hi);
      s.querySelector("small").textContent = n + " زيارة · " + fm(sum) + " جنيه";
    }

    const cellAt = e => { const el = document.elementFromPoint(e.clientX, e.clientY); const c = el && el.closest("[data-k]"); return c && stage.contains(c) ? c : null; };

    stage.addEventListener("pointerdown", e => {
      const c = e.target.closest("[data-k]");
      if (!c || e.button > 0) return;
      e.preventDefault();
      const k = c.dataset.k;
      focusK = k;
      if (mode === "months") {
        const anc = e.shiftKey && a ? ym(a) : k;
        drag = { anc, cur: k, keep: e.shiftKey };
        setMonths(anc, k);
      } else {
        if (e.shiftKey && a) { [a, z] = sort2(a, k); pickA = hov = ""; commit(false); return; }
        drag = { k0: k, cur: k, second: !!pickA, moved: false };
        if (pickA) hov = k; else { a = z = k; }
      }
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      paint();
    });
    stage.addEventListener("pointermove", e => {
      if (!drag) {
        if (pickA && e.pointerType === "mouse") { const c = e.target.closest("[data-k]"); if (c && c.dataset.k !== hov) { hov = c.dataset.k; paint(); } }
        return;
      }
      const c = cellAt(e);
      if (!c || c.dataset.k === drag.cur) return;
      const k = drag.cur = c.dataset.k;
      if (mode === "months") setMonths(drag.anc, k);
      else { drag.moved = true; if (drag.second) hov = k; else [a, z] = sort2(drag.k0, k); }
      paint();
    });
    stage.addEventListener("pointerup", () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (mode === "months") return commit(!d.keep);
      if (d.second) { [a, z] = sort2(pickA, hov || pickA); pickA = hov = ""; commit(false); }
      else if (d.moved) { pickA = ""; commit(false); }
      else { pickA = d.k0; hov = ""; paint(); }
    });
    stage.addEventListener("pointercancel", () => { drag = null; });

    body.addEventListener("click", e => {
      const t = e.target.closest("button");
      if (!t || t.disabled || t.dataset.k) return;
      if (t.dataset.p) { const p = P.find(x => x.id === t.dataset.p); a = p.from; z = p.to; pickA = hov = ""; return commit(true); }
      if (t.dataset.mode) {
        if (mode === t.dataset.mode) return;
        mode = t.dataset.mode;
        pickA = hov = "";
        if (mode === "days") { view = ym(a || b.z || UI.today()); if (two() && (!a || ym(a) === ym(z))) view = shiftMonth(view, -1); focusK = a || b.z || UI.today(); }
        else { year = +(a || mStart(view)).slice(0, 4); focusK = ym(a || mStart(view)); }
        return pane(0);
      }
      if (t.dataset.step) { const s = +t.dataset.step; if (mode === "months") year += s; else view = shiftMonth(view, s); return pane(s); }
      if (t.hasAttribute("data-title")) { mode = "months"; year = +view.slice(0, 4); pickA = hov = ""; return pane(0); }
      if (t.hasAttribute("data-clear")) { a = z = pickA = hov = ""; return commit(true); }
      if (t.hasAttribute("data-done")) { if (pickA) { a = z = pickA; pickA = hov = ""; commit(false); } UI.close(); }
    });

    body.addEventListener("keydown", e => {
      const c = e.target.closest("[data-k]");
      if (!c) return;
      const k = c.dataset.k, M = mode === "months";
      const s = (M ? { ArrowLeft: 1, ArrowRight: -1, ArrowUp: -4, ArrowDown: 4 } : { ArrowLeft: 1, ArrowRight: -1, ArrowUp: -7, ArrowDown: 7 })[e.key];
      if (s) {
        e.preventDefault();
        const nk = M ? shiftMonth(k, s) : addDays(k, s);
        focusK = nk;
        if (pickA) hov = nk;
        if (M && +nk.slice(0, 4) !== year) { year = +nk.slice(0, 4); pane(s); }
        else if (!M && ym(nk) < view) { view = shiftMonth(view, -1); pane(-1); }
        else if (!M && ym(nk) > (two() ? shiftMonth(view, 1) : view)) { view = shiftMonth(view, 1); pane(1); }
        else paint();
        stage.querySelector('[data-k="' + nk + '"]')?.focus({ preventScroll: true });
        return;
      }
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (M) { setMonths(e.shiftKey && a ? ym(a) : k, k); return commit(!e.shiftKey); }
      if (pickA) { [a, z] = sort2(pickA, k); pickA = hov = ""; commit(false); }
      else { pickA = a = z = k; paint(); }
    });

    pane(0);
    setTimeout(() => { if (!UI.mobile()) stage.querySelector('[tabindex="0"]')?.focus({ preventScroll: true }); }, 0);
  }

  return { open, label, describe, prev, step, canStep, shiftMonth };
})();
