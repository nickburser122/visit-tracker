const PICKER = (() => {
  const { esc, icons, p2, lastDay, addDays } = UI;
  const WD = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
  const WEEK_START = 6;
  const ym = d => d.slice(0, 7);
  const shiftMonth = (m, n) => { let y = +m.slice(0, 4), k = +m.slice(5) - 1 + n; y += Math.floor(k / 12); k = ((k % 12) + 12) % 12; return y + "-" + p2(k + 1); };
  const mStart = m => m + "-01";
  const mEnd = m => m + "-" + p2(lastDay(+m.slice(0, 4), +m.slice(5)));
  const clampD = (d, a, z) => d < a ? a : d > z ? z : d;

  function presets(bounds) {
    const z = bounds.z, a = bounds.a;
    if (!z) return [];
    const m = ym(z), q = Math.floor((+m.slice(5) - 1) / 3), y = m.slice(0, 4);
    const qs = y + "-" + p2(q * 3 + 1), pq = shiftMonth(qs, -3);
    const pm = shiftMonth(m, -1);
    const Q = ["الأول", "الثاني", "الثالث", "الرابع"];
    const list = [
      { id: "all", l: "كل الفترة", sub: UI.rangeLabel(a, z), from: "", to: "" },
      { id: "m", l: UI.mlabel(m), from: mStart(m), to: mEnd(m) },
      { id: "pm", l: UI.mlabel(pm), from: mStart(pm), to: mEnd(pm) },
      { id: "d30", l: "آخر 30 يوماً", from: addDays(z, -29), to: z },
      { id: "q", l: "الربع " + Q[q] + " " + y, from: mStart(qs), to: mEnd(shiftMonth(qs, 2)) },
      { id: "pq", l: "الربع " + Q[Math.floor((+pq.slice(5) - 1) / 3)] + " " + pq.slice(0, 4), from: mStart(pq), to: mEnd(shiftMonth(pq, 2)) },
      { id: "y", l: "سنة " + y, from: y + "-01-01", to: y + "-12-31" }
    ];
    if (a && a.slice(0, 4) !== y) list.push({ id: "py", l: "سنة " + (+y - 1), from: (+y - 1) + "-01-01", to: (+y - 1) + "-12-31" });
    return list;
  }

  function curRange() {
    const f = S.filters;
    if (f.from || f.to) return [f.from, f.to || f.from];
    if (f.months.length) { const ms = [...f.months].sort(); const contiguous = ms.every((m, i) => !i || shiftMonth(ms[i - 1], 1) === m); if (contiguous) return [mStart(ms[0]), mEnd(ms[ms.length - 1])]; }
    return ["", ""];
  }

  function label() {
    const f = S.filters;
    if (f.from || f.to) {
      const b = bounds();
      const hit = presets(b).find(p => p.from === f.from && p.to === f.to);
      return hit ? hit.l : UI.rangeLabel(f.from, f.to);
    }
    if (f.months.length === 1) return UI.mlabel(f.months[0]);
    if (f.months.length) return f.months.length + " شهور";
    return "كل الفترة";
  }

  function parseTyped(s) {
    s = String(s || "").trim();
    if (!s) return "";
    return ENG.toDate(s, "dmy", +(bounds().z || UI.today()).slice(0, 4)) || null;
  }
  const typedFmt = d => d ? +d.slice(8) + "/" + +d.slice(5, 7) + "/" + d.slice(0, 4) : "";

  function open(anchor, onApply) {
    const b = bounds();
    const days = ENG.M.meta.days || {};
    const maxDay = Math.max(1, ...Object.values(days));
    let [a, z] = curRange();
    let hover = "", picking = false;
    let mode = "days";
    const two = () => innerWidth >= 760;
    let view = ym(a || b.z || UI.today());
    if (two() && !a) view = shiftMonth(view, -1);
    if (two() && a && z && ym(a) !== ym(z)) view = ym(a);
    let focusD = a || b.z || UI.today();
    const P = presets(b);
    const body = UI.open(anchor, "", { cls: "dp-pop", min: two() ? 680 : 320, title: "الفترة", align: "end" });
    if (!body) return;

    const commit = (from, to, close) => {
      const f = S.filters;
      f.from = from; f.to = to; f.months = [];
      onApply();
      if (close) UI.close();
    };

    function monthHTML(m) {
      const y = +m.slice(0, 4), mo = +m.slice(5), n = lastDay(y, mo);
      const first = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() - WEEK_START + 7) % 7;
      const end = picking ? (hover || a) : z;
      const [lo, hi] = a ? [a, end || a].sort() : ["", ""];
      let h = '<div class="dp-month"><div class="dp-mtitle"><button type="button" class="dp-mt" data-mode="months">' + esc(UI.mlabel(m)) + icons.chevD + '</button></div><div class="dp-grid" role="grid">';
      for (let i = 0; i < 7; i++) h += '<span class="wd">' + WD[(i + WEEK_START) % 7] + "</span>";
      h += "<span></span>".repeat(first);
      const td = UI.today();
      for (let d = 1; d <= n; d++) {
        const k = m + "-" + p2(d);
        const c = days[k] || 0;
        const inR = lo && k >= lo && k <= hi;
        const cls = ["dp-day", c ? "has" : "", inR ? "in" : "", k === lo ? "lo" : "", k === hi ? "hi" : "", k === td ? "today" : "", k === focusD ? "focus" : ""].filter(Boolean).join(" ");
        h += '<button type="button" class="' + cls + '" data-d="' + k + '" tabindex="' + (k === focusD ? 0 : -1) + '" aria-label="' + esc(UI.dlabel(k)) + (c ? " · " + c + " زيارة" : "") + '" aria-pressed="' + !!inR + '"><span>' + d + "</span>" + (c ? '<i style="--o:' + (0.35 + 0.65 * c / maxDay).toFixed(2) + '"></i>' : "") + "</button>";
      }
      return h + "</div></div>";
    }

    function monthsHTML() {
      const y = +view.slice(0, 4);
      const mc = ENG.M.meta.months;
      const [lo, hi] = a ? [ym(a), ym(z || a)] : ["", ""];
      let h = '<div class="dp-years"><button type="button" class="icon-btn sm" data-ystep="1" aria-label="السنة التالية">' + icons.chevR + "</button><b>" + y + '</b><button type="button" class="icon-btn sm" data-ystep="-1" aria-label="السنة السابقة">' + icons.chevL + '</button></div><div class="dp-mgrid">';
      for (let i = 1; i <= 12; i++) {
        const k = y + "-" + p2(i), n = mc[k] ? mc[k].n : 0;
        const on = lo && k >= lo && k <= hi;
        h += '<button type="button" class="dp-mo' + (n ? " has" : "") + (on ? " in" : "") + (k === lo || k === hi ? " edge" : "") + '" data-mo="' + k + '"><b>' + MONTH_LABEL[i - 1] + "</b><small>" + (n ? n + " زيارة" : "—") + "</small></button>";
      }
      return h + "</div>";
    }

    let moAnchor = "";
    function draw() {
      const hint = picking ? "← النهاية" : a ? (UI.rangeLabel(...[a, z || a].sort())) + " · " + countIn(a, z || a) + " زيارة" : "";
      let h = '<div class="dp"><aside class="dp-pre" role="listbox" aria-label="فترات جاهزة">' + P.map(p => '<button type="button" class="dp-p' + (p.from === (S.filters.from || "") && p.to === (S.filters.to || "") && !S.filters.months.length ? " on" : "") + '" data-p="' + p.id + '"><b>' + esc(p.l) + "</b>" + (p.sub ? "<small>" + esc(p.sub) + "</small>" : "") + "</button>").join("") + '</aside><div class="dp-main"><div class="dp-inputs"><label><span>من</span><input type="text" inputmode="numeric" class="txt" id="dp-from" placeholder="يوم/شهر/سنة" value="' + typedFmt(a) + '"></label><span class="dp-arrow">←</span><label><span>إلى</span><input type="text" inputmode="numeric" class="txt" id="dp-to" placeholder="يوم/شهر/سنة" value="' + typedFmt(z) + '"></label></div>';
      if (mode === "months") h += monthsHTML();
      else {
        h += '<div class="dp-nav"><button type="button" class="icon-btn sm" data-step="-1" aria-label="الشهر السابق">' + icons.chevR + '</button><button type="button" class="lnk" data-jump>' + icons.cal + "آخر بيانات</button>" + '<button type="button" class="icon-btn sm" data-step="1" aria-label="الشهر التالي">' + icons.chevL + '</button></div><div class="dp-months' + (two() ? " two" : "") + '">' + monthHTML(view) + (two() ? monthHTML(shiftMonth(view, 1)) : "") + "</div>";
      }
      h += '<div class="dp-ft"><span class="dp-hint">' + esc(hint) + '</span><span class="row"><button type="button" class="lnk" data-clear>مسح</button><button type="button" class="btn sm solid" data-done>تم</button></span></div></div></div>';
      body.innerHTML = h;
      UI.place();
    }
    const countIn = (lo, hi) => { [lo, hi] = [lo, hi].sort(); let n = 0; for (const k in days) if (k >= lo && k <= hi) n += days[k]; return n; };

    const paintRange = () => {
      const end = picking ? (hover || a) : z;
      const [lo, hi] = a ? [a, end || a].sort() : ["", ""];
      body.querySelectorAll(".dp-day").forEach(el => {
        const k = el.dataset.d, inR = lo && k >= lo && k <= hi;
        el.classList.toggle("in", !!inR);
        el.classList.toggle("lo", k === lo);
        el.classList.toggle("hi", k === hi);
      });
      const h = body.querySelector(".dp-hint");
      if (h) h.textContent = picking ? (hover ? UI.rangeLabel(...[a, hover].sort()) + " · " + countIn(a, hover) + " زيارة" : "← النهاية") : a ? UI.rangeLabel(...[a, z || a].sort()) + " · " + countIn(a, z || a) + " زيارة" : "";
    };

    function pickDay(k) {
      if (!picking) { a = k; z = ""; picking = true; hover = ""; focusD = k; draw(); return; }
      [a, z] = [a, k].sort();
      picking = false; hover = ""; focusD = k;
      draw();
      commit(a, z, false);
    }

    draw();
    body.onpointerdown = e => { if (e.target.closest("button")) e.preventDefault(); };
    body.onmouseover = e => {
      if (!picking) return;
      const d = e.target.closest("[data-d]");
      if (d && d.dataset.d !== hover) { hover = d.dataset.d; paintRange(); }
    };
    body.onclick = e => {
      const t = e.target.closest("button");
      if (!t || t.disabled) return;
      if (t.dataset.p) { const p = P.find(x => x.id === t.dataset.p); a = p.from; z = p.to; picking = false; if (a) view = ym(two() && ym(a) !== ym(z) ? a : a); commit(p.from, p.to, true); return; }
      if (t.dataset.step) { view = shiftMonth(view, +t.dataset.step); return draw(); }
      if (t.hasAttribute("data-jump")) { view = two() ? shiftMonth(ym(b.z), -1) : ym(b.z); return draw(); }
      if (t.dataset.mode) { mode = "months"; return draw(); }
      if (t.dataset.ystep) { view = (+view.slice(0, 4) + +t.dataset.ystep) + view.slice(4); return draw(); }
      if (t.dataset.mo) {
        const k = t.dataset.mo;
        if (moAnchor && (e.shiftKey || moAnchor !== k)) { const [x, y] = [moAnchor, k].sort(); a = mStart(x); z = mEnd(y); moAnchor = ""; }
        else { a = mStart(k); z = mEnd(k); moAnchor = k; }
        picking = false; view = ym(a);
        commit(a, z, false);
        return draw();
      }
      if (t.hasAttribute("data-clear")) { a = z = hover = ""; picking = false; moAnchor = ""; commit("", "", false); return draw(); }
      if (t.hasAttribute("data-done")) { if (picking && a) commit(a, a, false); UI.close(); return; }
      if (t.dataset.d) pickDay(t.dataset.d);
    };
    body.addEventListener("dblclick", e => { const t = e.target.closest("[data-mo]"); if (t) UI.close(); });
    body.onkeydown = e => {
      const el = e.target.closest(".dp-day");
      if (!el) return;
      const step = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (step) {
        e.preventDefault();
        focusD = addDays(el.dataset.d, step);
        const vis = [view, two() ? shiftMonth(view, 1) : view];
        if (ym(focusD) < vis[0]) view = shiftMonth(view, -1);
        else if (ym(focusD) > vis[1]) view = shiftMonth(view, 1);
        if (picking) hover = focusD;
        draw();
        body.querySelector('[data-d="' + focusD + '"]')?.focus();
      } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickDay(el.dataset.d); body.querySelector('[data-d="' + focusD + '"]')?.focus(); }
    };
    body.addEventListener("change", e => {
      if (e.target.id !== "dp-from" && e.target.id !== "dp-to") return;
      const fa = parseTyped(body.querySelector("#dp-from").value), fz = parseTyped(body.querySelector("#dp-to").value);
      if (fa === null || fz === null) { UI.toast("صيغة التاريخ غير مفهومة — جرّب 15/3/2026", { error: true }); return; }
      a = fa || fz; z = fz || fa;
      if (a && z) [a, z] = [a, z].sort();
      picking = false;
      if (a) view = ym(a);
      commit(a || "", z || "", false);
      draw();
    });
    body.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("#dp-from,#dp-to")) e.target.dispatchEvent(new Event("change", { bubbles: true })); });
    setTimeout(() => { if (!UI.mobile()) body.querySelector(".dp-day.focus")?.focus({ preventScroll: true }); }, 0);
  }

  return { open, label, presets, shiftMonth };
})();
