const KEY = { settings: "addad2.settings", data: "addad2.data", ui: "addad3.ui", theme: "addad2.theme" };
const BLANK_FILTERS = () => ({ months: [], from: "", to: "", purp: [], car: [], zone: [], people: [], cities: [], types: [], ents: [], bands: [], amt: [], kinds: [], q: "" });

const S = {
  settings: null, raw: [], file: "", sheet: "", sheets: [],
  tab: "dash", pview: "table", sheetCap: 8, theme: "system", vlimit: 200, vsort: "d-desc", advOpen: null, excl: [], editMode: false,
  filters: BLANK_FILTERS()
};

const NEW_EXCEPTIONS = [["دمنهور مسائي", 4], ["ادارة المنطقة الثانية", 4]];
const addException = (list, name, count) => list.some(x => NZ(x.name) === NZ(name)) ? list : [...list, { name, count }];

function loadStore() {
  const base = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  try {
    const s = JSON.parse(localStorage.getItem(KEY.settings) || "null");
    if (s) {
      const v = s.v || 0;
      S.settings = { ...base, ...s, v: base.v,
        prices: v >= 5 ? { ...base.prices, ...s.prices } : base.prices,
        km: v >= 5 ? { ...base.km, ...(s.km || {}) } : base.km,
        allow: { ...base.allow, ...(s.allow || {}) },
        servicePrice: v >= 5 ? s.servicePrice : base.servicePrice,
        exceptions: v >= 8 ? s.exceptions : NEW_EXCEPTIONS.reduce((l, [n, c]) => addException(l, n, c), v >= 5 ? s.exceptions || base.exceptions : (s.exceptions || base.exceptions).filter(x => NZ(x.name) !== NZ("المخازن الطبية"))),
        zeroEntities: s.zeroEntities || base.zeroEntities,
        classAmount: { ...base.classAmount, ...(s.classAmount || {}) },
        carAllowance: { ...base.carAllowance, ...(s.carAllowance || {}) },
        org: { ...base.org, ...(s.org || {}) },
        entities: s.entities || {},
        people: { ...base.people, ...(s.people || {}) } };
      if (v < base.v) saveSettings();
    } else S.settings = base;
  } catch (e) { S.settings = base; }
  try {
    const d = JSON.parse(localStorage.getItem(KEY.data) || "null");
    if (d && Array.isArray(d.raw)) { S.raw = d.raw.filter(r => r && r.d && r.ent && Array.isArray(r.people)); S.file = d.file || ""; S.sheet = d.sheet || ""; }
  } catch (e) {}
  try {
    const u = JSON.parse(localStorage.getItem(KEY.ui) || "null");
    if (u) {
      S.tab = ["dash", "visits", "people", "prices"].includes(u.tab) ? u.tab : "dash";
      S.pview = ["table", "statement", "ledger"].includes(u.pview) ? u.pview : "table";
      S.vsort = u.vsort || "d-desc";
      S.advOpen = u.advOpen ?? null;
      S.excl = Array.isArray(u.excl) ? u.excl : [];
      const base = BLANK_FILTERS();
      const f = { ...base };
      for (const k of Object.keys(base)) if (u.filters && k in u.filters) f[k] = u.filters[k];
      for (const k of Object.keys(base)) if (k !== "q" && k !== "from" && k !== "to" && !Array.isArray(f[k])) f[k] = [];
      if (Array.isArray(u.sel) && u.sel.length && !f.people.length) f.people = u.sel;
      S.filters = f;
    }
  } catch (e) {}
  S.theme = localStorage.getItem(KEY.theme) || "system";
}

function saveSettings() { try { localStorage.setItem(KEY.settings, JSON.stringify(S.settings)); } catch (e) {} }
function saveData() { try { localStorage.setItem(KEY.data, JSON.stringify({ raw: S.raw, file: S.file, sheet: S.sheet })); } catch (e) { UI.toast("الملف أكبر من التخزين المحلي", { error: true }); } }
let uiT = 0;
function saveUi() { clearTimeout(uiT); uiT = setTimeout(() => { try { localStorage.setItem(KEY.ui, JSON.stringify({ tab: S.tab, pview: S.pview, vsort: S.vsort, advOpen: S.advOpen, filters: S.filters, excl: S.excl })); } catch (e) {} }, 150); }

const darkMq = matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  const t = S.theme === "system" ? (darkMq.matches ? "dark" : "light") : S.theme;
  document.documentElement.dataset.theme = t;
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.content = t === "dark" ? "#15171a" : "#f4f2ee";
  const b = document.getElementById("theme-btn");
  if (b) { b.innerHTML = UI.icons[S.theme === "system" ? "auto" : S.theme === "dark" ? "moon" : "sun"]; b.title = { system: "المظهر: تلقائي", dark: "المظهر: داكن", light: "المظهر: فاتح" }[S.theme]; b.setAttribute("aria-label", b.title); }
}
darkMq.addEventListener("change", applyTheme);

let ver = 0, cacheKey = "", cacheVal = null;
function rebuild() {
  if (ENG.registerPeople(S.raw)) saveSettings();
  ENG.build(S.raw);
  ver++;
}
function currentResult() {
  const k = ver + "|" + JSON.stringify(S.filters) + "|" + S.excl.join(",");
  if (k !== cacheKey) { cacheKey = k; cacheVal = ENG.filter(S.filters); }
  return { ...cacheVal, persons: cacheVal.persons.slice(), visits: cacheVal.visits };
}
function toggleExcl(ids, on) {
  const s = new Set(S.excl);
  for (const id of ids) on ? s.add(id) : s.delete(id);
  S.excl = [...s];
  saveUi(); update();
}

function bounds() { const v = ENG.M.visits; return v.length ? { a: v[0].d, z: v[v.length - 1].d } : { a: "", z: "" }; }
function resetFilters() { S.filters = BLANK_FILTERS(); }
function update() { S.vlimit = 200; UI.schedule(renderView); UI.schedule(FILTERS.syncChips); }

const loadFile = f => IO.load(f);

function setTab(t) { if (S.tab === t) return; S.tab = t; saveUi(); render(); scrollTo({ top: 0 }); }
function setFilter(k, v) { S.filters[k] = v; saveUi(); FILTERS.sync(); update(); }
function toggleFilter(k, v) {
  const f = S.filters;
  if (k === "months" && (f.from || f.to)) { f.from = f.to = ""; f.months = []; }
  const s = new Set(f[k]);
  s.has(v) ? s.delete(v) : s.add(v);
  setFilter(k, [...s]);
}

function renderTop() {
  const has = ENG.M.visits.length > 0;
  document.getElementById("file-info").textContent = has ? S.file + " · " + ENG.M.visits.length + " زيارة" : "بدلات وانتقالات المرور";
  document.getElementById("file-info").title = has ? S.file + " · «" + S.sheet + "»" : "";
  const ic = UI.icons;
  document.getElementById("top-actions").innerHTML = (has
    ? '<button class="btn sm" id="act-rep">' + ic.report + '<span>تقرير النشاط</span></button><button class="btn sm solid" id="act-pdf">' + ic.pdf + '<span>الكشوف</span></button><button class="btn sm" id="act-more" aria-haspopup="menu" aria-label="المزيد">' + ic.more + "<span>المزيد</span></button>"
    : '<button class="btn sm" id="act-tpl">' + ic.dl + "<span>القالب</span></button>") + '<button class="icon-btn" id="theme-btn"></button>';
  const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
  on("act-pdf", () => REPORT.dialog());
  on("act-rep", () => ACT.dialog());
  on("act-more", e => UI.menu(e.currentTarget, [
    { icon: ic.upload, label: "استيراد", kbd: "Ctrl O", run: () => document.getElementById("file-input").click() },
    { icon: ic.report, label: "تقرير النشاط", sub: "عدد الزيارات · PDF أو Excel", kbd: "Ctrl R", run: () => ACT.dialog() },
    { icon: ic.sheet, label: "كشوف البدلات Excel", run: () => IO.exportExcel(currentResult()) },
    "-",
    { icon: ic.dl, label: "نسخة احتياطية", run: () => IO.template(true) },
    { icon: ic.dl, label: "قالب فارغ", run: () => IO.template(false) }
  ], { title: "المزيد" }));
  on("act-tpl", () => IO.template(false));
  on("theme-btn", () => { S.theme = { system: "dark", dark: "light", light: "system" }[S.theme]; localStorage.setItem(KEY.theme, S.theme); applyTheme(); UI.toast(document.getElementById("theme-btn").title); });
  applyTheme();
  renderTabs(has);
}

function renderTabs(has) {
  const tabs = document.getElementById("main-tabs");
  tabs.classList.toggle("hidden", !has);
  if (!has) { tabs.innerHTML = ""; return; }
  const unk = Object.values(ENG.M.meta.unknown).filter(o => !o.city).length;
  const T = [["dash", "المؤشرات"], ["visits", "الزيارات", ENG.M.visits.length], ["people", "الأفراد", Object.keys(ENG.M.meta.people).length], ["prices", "الإعدادات", unk || null, unk ? "warn" : ""]];
  if (!tabs.querySelector(".tab-ink")) {
    tabs.innerHTML = T.map(([k], i) => '<button class="tab" role="tab" data-tab="' + k + '" title="Alt+' + (i + 1) + '"></button>').join("") + '<span class="tab-ink" aria-hidden="true"></span>';
    tabs.onclick = e => { const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab); };
    tabs.onkeydown = tabKeys;
  }
  T.forEach(([k, l, c, cls]) => {
    const b = tabs.querySelector('[data-tab="' + k + '"]');
    const h = l + (c != null ? '<span class="cnt ' + (cls || "") + '">' + c + "</span>" : "");
    b.setAttribute("aria-selected", S.tab === k);
    b.tabIndex = S.tab === k ? 0 : -1;
    if (b.dataset.h !== h) { b.dataset.h = h; b.innerHTML = h; }
  });
  requestAnimationFrame(() => moveInk(!tabs.querySelector(".tab-ink.on")));
}
function tabKeys(e) {
  const list = [...e.currentTarget.querySelectorAll("[data-tab]")];
  const i = list.indexOf(document.activeElement);
  if (i < 0) return;
  const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
  const to = { ArrowRight: rtl ? i - 1 : i + 1, ArrowLeft: rtl ? i + 1 : i - 1, Home: 0, End: list.length - 1 }[e.key];
  if (to == null) return;
  e.preventDefault();
  const b = list[(to + list.length) % list.length];
  b.focus();
  setTab(b.dataset.tab);
}
function moveInk(snap) {
  const tabs = document.getElementById("main-tabs"), a = tabs.querySelector('[aria-selected="true"]'), ink = tabs.querySelector(".tab-ink");
  if (!a || !ink || !a.offsetWidth) return;
  if (snap) ink.style.transition = "none";
  ink.style.width = a.offsetWidth + "px";
  ink.style.transform = "translateX(" + a.offsetLeft + "px)";
  if (snap) { void ink.offsetWidth; ink.style.transition = ""; }
  ink.classList.add("on");
  if (a.offsetLeft < tabs.scrollLeft || a.offsetLeft + a.offsetWidth > tabs.scrollLeft + tabs.clientWidth) a.scrollIntoView({ inline: "center", block: "nearest" });
}
const snapInk = () => moveInk(true);
addEventListener("resize", () => UI.schedule(snapInk));
document.fonts?.ready.then(() => UI.schedule(snapInk));

function renderView() {
  const v = document.getElementById("view");
  v.onclick = null;
  if (!ENG.M.visits.length) return VIEWS.welcome(v);
  const fn = { dash: VIEWS.dash, visits: VIEWS.visits, people: VIEWS.people, prices: VIEWS.prices }[S.tab] || VIEWS.dash;
  fn(v);
}

let mounted = false;
function render() {
  UI.close();
  renderTop();
  const has = ENG.M.visits.length > 0;
  const fb = document.getElementById("filter-bar");
  const showF = has && S.tab !== "prices";
  fb.classList.toggle("hidden", !showF);
  if (showF) { if (!mounted || !fb.firstChild) { FILTERS.mount(fb); mounted = true; } else FILTERS.sync(); }
  const v = document.getElementById("view");
  v.classList.remove("enter");
  void v.offsetWidth;
  v.classList.add("enter");
  renderView();
}

document.getElementById("file-input").addEventListener("change", e => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ""; });
let dragN = 0;
document.addEventListener("dragenter", e => { if (![...(e.dataTransfer?.types || [])].includes("Files")) return; e.preventDefault(); dragN++; document.body.classList.add("dragging"); });
document.addEventListener("dragover", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) e.preventDefault(); });
document.addEventListener("dragleave", () => { dragN = Math.max(0, dragN - 1); if (!dragN) document.body.classList.remove("dragging"); });
document.addEventListener("drop", e => { e.preventDefault(); dragN = 0; document.body.classList.remove("dragging"); const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
document.addEventListener("keydown", e => {
  if (document.querySelector(".modal") || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.key === "Escape" && S.editMode) { S.editMode = false; update(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); document.getElementById("file-input").click(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p" && ENG.M.visits.length) { e.preventDefault(); REPORT.dialog(); }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "r" && ENG.M.visits.length) { e.preventDefault(); ACT.dialog(); }
  if (e.altKey && /^[1-4]$/.test(e.key) && ENG.M.visits.length) { e.preventDefault(); setTab(["dash", "visits", "people", "prices"][+e.key - 1]); }
});
addEventListener("scroll", () => document.body.classList.toggle("scrolled", scrollY > 8), { passive: true });

loadStore();
applyTheme();
rebuild();
render();
const BOOT = (location.search + location.hash + " " + (window.ADDAD_BOOT || ""));
if (/demo/.test(BOOT) && !S.raw.length) IO.demo();
if (/open=report/.test(BOOT) && ENG.M.visits.length) ACT.dialog();
if (/open=filters/.test(BOOT) && ENG.M.visits.length) { S.advOpen = true; FILTERS.sync(); }
