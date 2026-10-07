const UI = (() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NF = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const NF2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fm = n => n == null ? "—" : NF.format(n);
  const fm2 = n => n == null ? "—" : NF2.format(n);
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const p2 = n => String(n).padStart(2, "0");
  const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dt = d => new Date(d + "T00:00:00Z");
  const today = () => { const n = new Date(); return n.getFullYear() + "-" + p2(n.getMonth() + 1) + "-" + p2(n.getDate()); };
  const addDays = (d, n) => { const x = dt(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const dlabel = d => { if (!d) return ""; const x = dt(d); return x.getUTCDate() + " " + MONTH_LABEL[x.getUTCMonth()] + " " + x.getUTCFullYear(); };
  const dshort = d => { const x = dt(d); return x.getUTCDate() + " " + MONTH_LABEL[x.getUTCMonth()]; };
  const mlabel = k => MONTH_LABEL[+k.slice(5) - 1] + " " + k.slice(0, 4);
  const wday = d => WEEKDAYS[dt(d).getUTCDay()];
  const rangeLabel = (a, z) => {
    if (!a) return "";
    if (!z || a === z) return dlabel(a);
    if (a.slice(0, 7) === z.slice(0, 7)) return +a.slice(8) + " – " + +z.slice(8) + " " + MONTH_LABEL[+a.slice(5, 7) - 1] + " " + a.slice(0, 4);
    if (a.slice(0, 4) === z.slice(0, 4)) return dshort(a) + " – " + dshort(z) + " " + a.slice(0, 4);
    return dlabel(a) + " – " + dlabel(z);
  };
  const dateCell = d => { const x = dt(d); return '<div class="date-cell"><b>' + x.getUTCDate() + " " + MONTH_LABEL[x.getUTCMonth()] + "</b><span>" + WEEKDAYS[x.getUTCDay()] + " · " + x.getUTCFullYear() + "</span></div>"; };
  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
  const icons = {
    car: svg('<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/>'),
    upload: svg('<path d="M12 15V4M7 9l5-5 5 5"/><path d="M5 15v4h14v-4"/>'),
    dl: svg('<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 19h14"/>'),
    pdf: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    print: svg('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
    sheet: svg('<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M4 9h16M4 15h16M10 3v18"/>'),
    reset: svg('<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7"/><path d="M4 4v4.7h4.7"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    cal: svg('<rect x="3.5" y="5" width="17" height="15" rx="4"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    auto: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>'),
    chevL: svg('<path d="M15 6l-6 6 6 6"/>'),
    chevR: svg('<path d="M9 6l6 6-6 6"/>'),
    chevD: svg('<path d="M6 9l6 6 6-6"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    filter: svg('<path d="M4 5h16l-6 8v5l-4 2v-7z"/>'),
    sliders: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
    more: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
    spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    warn: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    sort: svg('<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/>'),
    link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>')
  };

  let raf = 0, queued = [];
  function schedule(fn) {
    if (!queued.includes(fn)) queued.push(fn);
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; const q = queued; queued = []; q.forEach(f => f()); });
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const mobile = () => innerWidth < 640;

  let pop, bd, cur = null;
  function ensure() {
    if (pop) return pop;
    pop = document.createElement("div");
    pop.className = "pop";
    bd = document.createElement("div");
    bd.className = "pop-bd";
    document.body.append(bd, pop);
    bd.addEventListener("click", () => close());
    document.addEventListener("pointerdown", e => { if (cur && !cur.sheet && !pop.contains(e.target) && !cur.anchor.contains(e.target)) close(); }, true);
    addEventListener("resize", () => cur && place());
    addEventListener("scroll", e => { if (cur && !cur.sheet && !pop.contains(e.target)) place(); }, { capture: true, passive: true });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && cur) { e.stopPropagation(); const a = cur.anchor; close(); a.focus && a.focus({ preventScroll: true }); } }, true);
    return pop;
  }
  function place() {
    if (!cur) return;
    if (!cur.anchor.isConnected) return close();
    if (cur.sheet) { pop.style.top = pop.style.left = pop.style.minWidth = ""; return; }
    const r = cur.anchor.getBoundingClientRect();
    pop.style.minWidth = Math.min(innerWidth - 16, Math.max(cur.min || 240, r.width)) + "px";
    const h = pop.offsetHeight, w = pop.offsetWidth;
    let top = r.bottom + 6;
    if (top + h > innerHeight - 8) top = r.top - h - 6 > 8 ? r.top - h - 6 : Math.max(8, innerHeight - h - 8);
    let left = cur.align === "start" ? r.left : document.dir === "rtl" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, innerWidth - w - 8));
    pop.style.top = Math.max(8, top) + "px";
    pop.style.left = left + "px";
  }
  function open(anchor, html, opts = {}) {
    ensure();
    if (cur && cur.anchor === anchor) { close(); return null; }
    close();
    const sheet = opts.sheet !== false && mobile();
    cur = { anchor, onClose: opts.onClose, min: opts.min, sheet, align: opts.align };
    anchor.setAttribute("aria-expanded", "true");
    anchor.classList.add("open");
    pop.className = "pop show" + (sheet ? " sheet" : "") + (opts.cls ? " " + opts.cls : "");
    bd.classList.toggle("show", sheet);
    pop.innerHTML = (sheet ? '<div class="grab" aria-hidden="true"></div>' + (opts.title ? '<div class="sheet-hd"><b>' + esc(opts.title) + '</b><button type="button" class="icon-btn sm" data-sheet-x aria-label="إغلاق">' + icons.x + "</button></div>" : "") : "") + '<div class="pop-body">' + html + "</div>";
    pop.onclick = pop.onkeydown = pop.onpointerdown = pop.onmouseover = null;
    pop.addEventListener("click", sheetX);
    place();
    return pop.querySelector(".pop-body");
  }
  function sheetX(e) { if (e.target.closest("[data-sheet-x]")) close(); }
  function close() {
    if (!cur) return;
    cur.anchor.setAttribute("aria-expanded", "false");
    cur.anchor.classList.remove("open");
    pop.className = "pop";
    bd.classList.remove("show");
    pop.innerHTML = "";
    const cb = cur.onClose;
    cur = null;
    cb && cb();
  }
  const isOpen = a => !!cur && cur.anchor === a;
  const popBody = () => pop && pop.querySelector(".pop-body");

  function menu(anchor, items, opts = {}) {
    const p = open(anchor, '<div class="menu" role="menu">' + items.map((it, i) => it === "-" ? '<hr>' : '<button type="button" role="menuitem" class="menu-it' + (it.primary ? " primary" : "") + '" data-mi="' + i + '"' + (it.disabled ? " disabled" : "") + ">" + (it.icon || "") + '<span><b>' + esc(it.label) + "</b>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</span>" + (it.kbd ? "<kbd>" + esc(it.kbd) + "</kbd>" : "") + "</button>").join("") + "</div>", { cls: "menu-pop", min: opts.min || 260, title: opts.title });
    if (!p) return;
    const btns = [...p.querySelectorAll("[data-mi]")];
    btns[0] && setTimeout(() => btns[0].focus({ preventScroll: true }), 0);
    p.onkeydown = e => {
      const i = btns.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    };
    p.onclick = e => { const b = e.target.closest("[data-mi]"); if (!b) return; const it = items[+b.dataset.mi]; close(); it.run && it.run(); };
  }

  function multi(cfg) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn" + (cfg.cls ? " " + cfg.cls : "");
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    let val = [...(cfg.value || [])];
    const opts = () => cfg.options();
    const label = () => {
      if (!val.length) return cfg.allLabel || "الكل";
      const o = opts();
      if (val.length === 1) { const x = o.find(z => z.v === val[0]); return x ? x.l : val[0]; }
      if (val.length === 2) return val.map(v => (o.find(z => z.v === v) || { l: v }).l).join("، ");
      return val.length + " محدد";
    };
    const paint = () => {
      btn.innerHTML = (cfg.icon || "") + (cfg.label ? '<span class="lbl">' + esc(cfg.label) + "</span>" : "") + '<span class="val">' + esc(label()) + "</span>" + (val.length ? '<span class="badge">' + val.length + "</span>" : "") + '<span class="car">' + icons.chevD + "</span>";
      btn.classList.toggle("has", val.length > 0);
    };
    paint();
    let q = "", hl = 0;
    const list = () => { const nq = NZ(q); return opts().filter(o => !nq || NZ(o.l).includes(nq)); };
    const draw = () => {
      const p = popBody();
      if (!p) return;
      const L = list(), box = p.querySelector(".dd-list"), st = box.scrollTop;
      hl = Math.max(0, Math.min(hl, L.length - 1));
      box.innerHTML = L.length ? L.map((o, i) => '<div class="dd-opt' + (i === hl ? " hl" : "") + '" role="option" aria-selected="' + val.includes(o.v) + '" data-i="' + i + '"><span class="tick">' + icons.check + '</span><span class="t">' + esc(o.l) + "</span>" + (o.sub != null ? '<span class="sub">' + esc(o.sub) + "</span>" : "") + '<button type="button" class="only" data-only="' + i + '" tabindex="-1">فقط</button></div>').join("") : '<div class="dd-empty">لا نتائج</div>';
      box.scrollTop = st;
      p.querySelector(".dd-count").textContent = val.length ? val.length + " محدد" : "بلا تحديد = الكل";
    };
    const emit = () => { paint(); cfg.onChange(val.slice()); };
    const toggle = o => { if (!o) return; val = val.includes(o.v) ? val.filter(x => x !== o.v) : [...val, o.v]; draw(); emit(); };
    const show = () => {
      q = ""; hl = 0;
      const searchable = opts().length > 6;
      const p = open(btn, (searchable ? '<div class="dd-sw">' + icons.search + '<input class="dd-search" type="search" placeholder="اكتب للتصفية…" aria-label="بحث"></div>' : "") + '<div class="dd-list" role="listbox" aria-multiselectable="true"></div><div class="dd-foot"><span class="dd-count mut sm"></span><span><button type="button" class="lnk" data-a="all">تحديد الظاهر</button><button type="button" class="lnk" data-a="clear">مسح</button>' + (mobile() ? '<button type="button" class="btn sm solid" data-sheet-x>تم</button>' : "") + "</span></div>", { cls: "dd-pop", title: cfg.label || cfg.allLabel });
      if (!p) return;
      const box = p.querySelector(".dd-list");
      draw();
      place();
      const s = p.querySelector(".dd-search");
      const keys = e => {
        const L = list();
        if (e.key === "ArrowDown") { e.preventDefault(); hl = Math.min(L.length - 1, hl + 1); draw(); box.querySelector(".hl")?.scrollIntoView({ block: "nearest" }); }
        else if (e.key === "ArrowUp") { e.preventDefault(); hl = Math.max(0, hl - 1); draw(); box.querySelector(".hl")?.scrollIntoView({ block: "nearest" }); }
        else if (e.key === "Enter") { e.preventDefault(); toggle(L[hl]); }
      };
      if (s) { if (!mobile()) setTimeout(() => s.focus(), 0); s.oninput = () => { q = s.value; hl = 0; draw(); }; s.onkeydown = keys; }
      else { p.tabIndex = -1; p.focus(); p.onkeydown = e => { if (e.key === " ") { e.preventDefault(); toggle(list()[hl]); } else keys(e); }; }
      p.onpointerdown = e => { if (e.target.closest(".dd-opt,.lnk")) e.preventDefault(); };
      p.onclick = e => {
        const a = e.target.closest("[data-a]");
        if (a) { val = a.dataset.a === "all" ? [...new Set([...val, ...list().map(o => o.v)])] : []; draw(); emit(); return; }
        const only = e.target.closest("[data-only]");
        if (only) { val = [list()[+only.dataset.only].v]; draw(); emit(); return; }
        const o = e.target.closest(".dd-opt");
        if (o) { hl = +o.dataset.i; toggle(list()[hl]); }
      };
    };
    btn.addEventListener("click", show);
    btn.addEventListener("keydown", e => { if ((e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") && !isOpen(btn)) { e.preventDefault(); show(); } });
    btn.setValue = v => { val = [...v]; paint(); if (isOpen(btn)) draw(); };
    return btn;
  }

  function single(cfg) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn" + (cfg.cls ? " " + cfg.cls : "");
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    let val = cfg.value;
    const opts = () => typeof cfg.options === "function" ? cfg.options() : cfg.options;
    const paint = () => { const o = opts().find(x => x.v === val); btn.innerHTML = (cfg.label ? '<span class="lbl">' + esc(cfg.label) + "</span>" : "") + '<span class="val">' + esc(o ? o.l : cfg.placeholder || "اختر") + '</span><span class="car">' + icons.chevD + "</span>"; btn.classList.toggle("empty", !o); };
    paint();
    btn.addEventListener("click", () => {
      let q = "", hl = Math.max(0, opts().findIndex(o => o.v === val));
      const searchable = opts().length > 8;
      const p = open(btn, (searchable ? '<div class="dd-sw">' + icons.search + '<input class="dd-search" type="search" placeholder="اكتب للتصفية…"></div>' : "") + '<div class="dd-list" role="listbox"></div>', { cls: "dd-pop", title: cfg.label || cfg.placeholder });
      if (!p) return;
      const box = p.querySelector(".dd-list");
      const list = () => { const nq = NZ(q); return opts().filter(o => !nq || NZ(o.l).includes(nq)); };
      const draw = () => { const L = list(); hl = Math.max(0, Math.min(hl, L.length - 1)); box.innerHTML = L.map((o, i) => '<div class="dd-opt single' + (i === hl ? " hl" : "") + '" role="option" aria-selected="' + (o.v === val) + '" data-i="' + i + '"><span class="tick">' + icons.check + '</span><span class="t">' + esc(o.l) + "</span>" + (o.sub != null ? '<span class="sub">' + esc(o.sub) + "</span>" : "") + "</div>").join("") || '<div class="dd-empty">لا نتائج</div>'; box.querySelector(".hl")?.scrollIntoView({ block: "nearest" }); };
      draw(); place();
      const pick = o => { if (!o) return; val = o.v; paint(); close(); btn.focus({ preventScroll: true }); cfg.onChange(val); };
      const s = p.querySelector(".dd-search");
      const keys = e => { const L = list(); if (e.key === "ArrowDown") { e.preventDefault(); hl++; draw(); } else if (e.key === "ArrowUp") { e.preventDefault(); hl--; draw(); } else if (e.key === "Enter") { e.preventDefault(); pick(L[hl]); } };
      if (s) { if (!mobile()) setTimeout(() => s.focus(), 0); s.oninput = () => { q = s.value; hl = 0; draw(); }; s.onkeydown = keys; } else { p.tabIndex = -1; p.focus(); p.onkeydown = keys; }
      p.onpointerdown = e => { if (e.target.closest(".dd-opt")) e.preventDefault(); };
      p.onclick = e => { const o = e.target.closest(".dd-opt"); if (o) pick(list()[+o.dataset.i]); };
    });
    btn.setValue = v => { val = v; paint(); };
    return btn;
  }

  const modals = [];
  function modal(title, body, actions, opts = {}) {
    close();
    const m = document.createElement("div");
    m.className = "modal" + (opts.cls ? " " + opts.cls : "");
    m.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="modal-hd"><div><h2>' + esc(title) + "</h2>" + (opts.sub ? '<p class="mut sm">' + opts.sub + "</p>" : "") + '</div><button class="icon-btn sm" data-x aria-label="إغلاق">' + icons.x + '</button></div><div class="modal-bd">' + body + "</div>" + (actions ? '<div class="modal-ft">' + actions + "</div>" : "") + "</div>";
    document.body.appendChild(m);
    document.documentElement.classList.add("locked");
    const prevFocus = document.activeElement;
    const done = () => {
      if (!m.isConnected) return;
      m.classList.remove("show");
      m.classList.add("hide");
      const i = modals.indexOf(m);
      if (i >= 0) modals.splice(i, 1);
      if (!modals.length) document.documentElement.classList.remove("locked");
      setTimeout(() => m.remove(), 180);
      opts.onClose && opts.onClose();
      prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true });
    };
    modals.push(m);
    m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-x]")) done(); });
    m.addEventListener("keydown", e => {
      if (e.key !== "Tab") return;
      const f = [...m.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1], cur = document.activeElement;
      if (e.shiftKey && (cur === a || !m.contains(cur))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && cur === z) { e.preventDefault(); a.focus(); }
    });
    m.close = done;
    requestAnimationFrame(() => { m.classList.add("show"); const f = m.querySelector("[autofocus]") || m.querySelector(".modal-ft .solid"); f && !mobile() && f.focus({ preventScroll: true }); });
    return m;
  }
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || cur || !modals.length) return;
    modals[modals.length - 1].close();
  });

  function confirm(title, msg, okLabel, danger) {
    return new Promise(res => {
      let ok = false;
      const m = modal(title, '<p class="note lg">' + msg + "</p>", '<button class="btn" data-x>إلغاء</button><button class="btn solid' + (danger ? " danger" : "") + '" data-ok>' + esc(okLabel || "تأكيد") + "</button>", { cls: "small", onClose: () => res(ok) });
      m.querySelector("[data-ok]").onclick = () => { ok = true; m.close(); };
    });
  }

  let tt, tEl;
  function toast(msg, opt = {}) {
    if (!tEl) { tEl = document.createElement("div"); tEl.className = "toast"; tEl.setAttribute("role", "status"); tEl.setAttribute("aria-live", "polite"); document.body.appendChild(tEl); }
    tEl.innerHTML = '<span>' + esc(msg) + "</span>" + (opt.action ? '<button type="button" class="t-act">' + esc(opt.action) + "</button>" : "");
    tEl.classList.remove("show");
    void tEl.offsetWidth;
    tEl.classList.add("show");
    tEl.classList.toggle("err", !!opt.error);
    const b = tEl.querySelector(".t-act");
    if (b) b.onclick = () => { tEl.classList.remove("show"); opt.onAction && opt.onAction(); };
    clearTimeout(tt);
    tt = setTimeout(() => tEl.classList.remove("show"), opt.ms || (opt.action ? 6000 : 2800));
  }

  function donut(parts, center, sub) {
    const tot = parts.reduce((s, p) => s + p.v, 0) || 1;
    let a = -Math.PI / 2;
    const R = 62, r = 44, cx = 75, cy = 75;
    const seg = parts.map(p => {
      const ang = p.v / tot * Math.PI * 2;
      if (p.v <= 0) return "";
      if (ang >= Math.PI * 2 - 1e-6) return '<circle cx="75" cy="75" r="53" fill="none" style="stroke:' + p.c + '" stroke-width="18"/>';
      const a2 = a + ang, lg = ang > Math.PI ? 1 : 0;
      const P = (rad, t) => (cx + rad * Math.cos(t)).toFixed(2) + " " + (cy + rad * Math.sin(t)).toFixed(2);
      const d = "M" + P(R, a) + " A" + R + " " + R + " 0 " + lg + " 1 " + P(R, a2) + " L" + P(r, a2) + " A" + r + " " + r + " 0 " + lg + " 0 " + P(r, a) + "Z";
      a = a2;
      return '<path d="' + d + '" style="fill:' + p.c + ';stroke:var(--pn)" stroke-width="2"/>';
    }).join("");
    return '<svg class="donut" viewBox="0 0 150 150" role="img"><circle cx="75" cy="75" r="53" fill="none" style="stroke:var(--pn3)" stroke-width="18"/>' + seg + '<text x="75" y="76" text-anchor="middle" font-size="24" font-weight="300">' + esc(center) + '</text><text x="75" y="96" text-anchor="middle" font-size="11" opacity=".55">' + esc(sub) + "</text></svg>";
  }

  function download(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  return { esc, fm, fm2, pct, p2, lastDay, today, addDays, dlabel, dshort, mlabel, wday, rangeLabel, dateCell, icons, schedule, debounce, mobile, open, close, isOpen, place: () => cur && place(), popBody, menu, multi, single, modal, confirm, toast, donut, download };
})();
