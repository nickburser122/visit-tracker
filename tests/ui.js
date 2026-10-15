const fs = require("fs");
const path = require("path");

let JSDOM;
try { ({ JSDOM } = require("jsdom")); } catch (e) { console.log("SKIP ui tests: jsdom not installed (npm i --no-save jsdom)"); process.exit(0); }

const root = process.env.ADDAD_ROOT || path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
const source = scripts.map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n;\n");
const EXPOSE = "\n;window.__T = { S, ENG, IO, REPORT, ACT, TL, TLUI, currentResult, rebuild, render, update, saveSettings };";
const wait = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = Array.isArray(want) ? JSON.stringify(got) === JSON.stringify(want) : got === want || (typeof got === "number" && typeof want === "number" && Math.abs(got - want) < 1e-9);
  ok ? pass++ : fail++;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : "  got=" + JSON.stringify(got) + " want=" + JSON.stringify(want)));
}

async function boot(stored) {
  const dom = new JSDOM(html, { url: "http://localhost/index.html?demo", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  w.IntersectionObserver = class { observe() {} disconnect() {} };
  w.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLElement.prototype.scrollTo = () => {};
  w.scrollTo = () => {};
  w.URL.createObjectURL = () => "blob:x";
  if (stored) w.localStorage.setItem("addad2.settings", JSON.stringify(stored));
  const errs = [];
  w.addEventListener("error", e => errs.push(e.message));
  w.eval(source + EXPOSE);
  await wait(400);
  const T = w.__T;
  const go = async (tab, pview) => { T.S.tab = tab; if (pview) T.S.pview = pview; w.eval("render()"); await wait(150); return w.document.getElementById("view"); };
  const fire = (el, type = "change") => el.dispatchEvent(new w.Event(type, { bubbles: true }));
  return { w, T, errs, go, fire, $: s => w.document.querySelector(s), $$: s => [...w.document.querySelectorAll(s)] };
}

const summary = () => { console.log("\n" + pass + " passed, " + fail + " failed"); return fail; };
module.exports = { boot, check, wait, summary };

if (require.main === module) {
  (async () => {
    const A = await boot({ v: 9, people: { "شلتوت": { name: "شلتوت", cls: 2 } } });
    check("migration: شلتوت first class", A.T.S.settings.people["شلتوت"].cls, 1);
    check("migration: settings version bumped", JSON.parse(A.w.localStorage.getItem("addad2.settings")).v, A.T.S.settings.v);
    check("defaults: merge and hide-zero are on", [A.T.S.settings.mergeTrips, A.T.S.settings.hideZero], [true, true]);
    for (const [tab, pv] of [["dash"], ["visits"], ["people", "table"], ["people", "statement"], ["people", "ledger"], ["prices"]]) {
      const el = await A.go(tab, pv);
      check("renders " + tab + (pv ? "/" + pv : ""), el.innerHTML.length > 200, true);
    }

    const city = A.T.ENG.M.items.find(it => it.v.city && it.v.city !== "دمنهور" && !it.p.car && it.raw.some(l => l.kind === "travel"));
    const d = city.v.d, c = city.v.city;
    await A.go("prices");
    const btn = A.$('.tl-btn[data-tl="prices:' + c + '"]');
    check("city price has a timeline button", !!btn, true);
    btn.click(); await wait(100);
    check("editor opens with one row", A.$$(".modal.show .tl-t tbody tr").length, 1);
    A.$("[data-add]").click(); await wait(50);
    const rows = A.$$(".modal.show .tl-t tbody tr");
    check("add creates a second row", rows.length, 2);
    rows[1].querySelector("[data-f]").value = d;
    rows[1].querySelector("[data-v]").value = "99";
    A.fire(rows[1].querySelector("[data-v]"));
    A.$("[data-ok]").click(); await wait(250);
    const saved = A.T.S.settings.prices[c];
    check("saved as a dated list", Array.isArray(saved) && saved.length === 2 && saved[1].from === d && saved[1].v === 99, true);
    const now = A.T.ENG.M.items.find(it => it.id === city.id);
    check("engine uses the dated price on that day", now.raw.find(l => l.kind === "travel").a, 198);
    await A.go("prices");
    check("chip replaces the input", !!A.$('.tl-chip[data-tl="prices:' + c + '"]'), true);
    A.$('.tl-chip[data-tl="prices:' + c + '"]').click(); await wait(100);
    A.$("[data-flat]").click(); await wait(250);
    check("flatten returns a single value", typeof A.T.S.settings.prices[c], "number");
    check("flatten keeps the latest value", A.T.S.settings.prices[c], 99);
    check("no script errors", A.errs, []);
    A.w.close();

    const B = await boot();
    const st = B.T.S.settings, IO = B.T.IO, TL = B.T.TL;
    const sheetsOf = () => IO.settingsSheets().map(s => ({ name: s.name, rows: s.rows }));
    const apply = (sheets, base) => { const target = JSON.parse(JSON.stringify(base)); const sets = IO.readSettings(sheets); sets.forEach(x => x.apply(target)); TL.sanitize(target); return { target, sets }; };
    const gk = Object.keys(st.people)[0];
    st.prices["كفر الدوار"] = [{ v: 20 }, { from: "2026-04-01", v: 30 }];
    st.pairs["أبو حمص|كفر الدوار"] = [{ from: "2026-01-01", to: "2026-03-31", v: 5 }, { from: "2026-04-01", v: 12 }];
    st.classAmount[1] = [{ v: 10 }, { from: "2026-05-01", v: 15 }];
    st.carAllowance[1] = 40;
    st.servicePrice = [{ v: 6.5 }, { from: "2026-06-01", v: 8 }];
    st.people[gk].cls = [{ v: 3 }, { from: "2026-04-01", v: 1 }];
    st.km["كفر الدوار"] = [{ v: 36.7 }, { from: "2026-04-01", v: 90 }];
    st.allow["كفر الدوار"] = [{ v: false }, { from: "2026-04-01", v: true }];
    const sheets = sheetsOf();
    const rt = apply(sheets, B.T.S.settings);
    const back = rt.target;
    check("round trip: dated city price", back.prices["كفر الدوار"], st.prices["كفر الدوار"]);
    check("round trip: dated pair with closed period", back.pairs["أبو حمص|كفر الدوار"], st.pairs["أبو حمص|كفر الدوار"]);
    check("round trip: dated internal fee", back.classAmount[1], st.classAmount[1]);
    check("round trip: scalar allowance beside a dated fee", back.carAllowance[1], 40);
    check("round trip: dated service price", back.servicePrice, st.servicePrice);
    check("round trip: dated grade", back.people[gk].cls, st.people[gk].cls);
    check("round trip: dated km", back.km["كفر الدوار"], [{ v: 36.7 }, { from: "2026-04-01", v: 90 }]);
    check("round trip: dated allowance flag", back.allow["كفر الدوار"], [{ v: false }, { from: "2026-04-01", v: true }]);
    check("round trip: scalar km stays a number", back.km["أبو حمص"], st.km["أبو حمص"]);
    check("round trip: scalar allowance stays a boolean", back.allow["أبو حمص"], st.allow["أبو حمص"]);
    check("round trip: untouched scalars stay scalars", back.prices["أبو حمص"], st.prices["أبو حمص"]);
    check("round trip: service sheet is exported", sheets.some(s => s.name === "سعر السيرفيس"), true);

    const legacy = [
      { name: "المدن", rows: [["المدينة", "السعر", "المسافة", "بدل سفر"], ["كفر الدوار", 21, 36.7, false]] },
      { name: "الافراد", rows: [["الاسم", "الدرجة"], ["غادة", 2]] },
      { name: "الدرجات", rows: [["الدرجة", "بدل داخلي", "بدل سفر"], [1, 11, 41], [2, 9, ""]] },
      { name: "خطوط المدن", rows: [["المدينة الأولى", "المدينة الثانية", "السعر"], ["كفر الدوار", "ابو حمص", 7]] }
    ];
    const lg = apply(legacy, B.T.S.settings).target;
    check("legacy sheet: city price stays a number", lg.prices["كفر الدوار"], 21);
    check("legacy sheet: km and allowance stay plain", [lg.km["كفر الدوار"], lg.allow["كفر الدوار"]], [36.7, false]);
    check("legacy sheet: grade stays a number", lg.people[Object.keys(lg.people).find(k => lg.people[k].name === "غادة")].cls, 2);
    check("legacy sheet: grades amounts", [lg.classAmount[1], lg.carAllowance[1]], [11, 41]);
    check("legacy sheet: blank allowance clears the value", lg.carAllowance[2], null);
    check("legacy sheet: pair price stays a number", lg.pairs["أبو حمص|كفر الدوار"], 7);

    const mixed = [
      { name: "المدن", rows: [["المدينة", "السعر", "المسافة", "بدل سفر", "من", "إلى"], ["كفر الدوار", 18, 36.7, false, "", ""], ["كفر الدوار", 24, "", "", "01/04/2026", ""], ["كفر الدوار", 99, "", "", "not a date", ""], ["كفر الدوار", 77, "", "", "2026-09-01", "2026-08-01"]] }
    ];
    const mx = apply(mixed, B.T.S.settings);
    check("dated rows: dmy text dates become periods", mx.target.prices["كفر الدوار"], [{ v: 18 }, { from: "2026-04-01", v: 24 }]);
    check("dated rows: bad dates are reported", mx.sets[0].label.includes("2"), true);
    check("dated rows: km and allowance come from the undated row", [mx.target.km["كفر الدوار"], mx.target.allow["كفر الدوار"]], [36.7, false]);
    const split = [{ name: "المدن", rows: [["المدينة", "السعر", "المسافة", "بدل سفر", "من", "إلى"], ["كفر الدوار", 18, "", "", "", ""], ["كفر الدوار", "", 20, "", "", ""], ["كفر الدوار", "", 80, "", "2026-04-01", ""], ["كفر الدوار", "", "", "نعم", "2026-04-01", ""], ["كفر الدوار", "", "", "لا", "", ""]] }];
    const sp = apply(split, B.T.S.settings).target;
    check("independent timelines per column: km", sp.km["كفر الدوار"], [{ v: 20 }, { from: "2026-04-01", v: 80 }]);
    check("independent timelines per column: allowance", sp.allow["كفر الدوار"], [{ v: false }, { from: "2026-04-01", v: true }]);
    check("independent timelines per column: price stays scalar", sp.prices["كفر الدوار"], 18);

    const grades = [{ name: "الافراد", rows: [["الاسم", "الدرجة", "من", "إلى"], ["غادة", 3, "", ""], ["غادة", 1, "2026-04-01", ""], ["غادة", "", "2026-06-01", ""]] }];
    const gr = apply(grades, B.T.S.settings).target;
    check("dated grade rows import as periods", gr.people[Object.keys(gr.people).find(k => gr.people[k].name === "غادة")].cls, [{ v: 3 }, { from: "2026-04-01", v: 1 }]);
    check("no script errors (import)", B.errs, []);
    B.w.close();

    const C = await boot();
    const key = C.T.ENG.personKey("غادة");
    const mk = (ent, d = "2026-03-02") => ({ d, ent, g: "فحص", car: false, people: ["غادة"], src: "u:" + Math.random() });
    const load = rows => { C.T.S.raw = rows; C.T.S.excl = []; C.T.S.editMode = false; C.T.S.showZero = false; C.T.S.filters.people = [key]; C.w.eval("rebuild()"); };
    const statementRows = () => C.$$("table.statement tbody tr:not(.sumrow)").length;
    C.T.S.settings.people[key] = { name: "غادة", cls: 1 };
    load([mk("كفر الدوار طلاب"), mk("ابو حمص"), mk("الشرطة")]);
    await C.go("people", "statement");
    check("route: one expandable details block", C.$$("table.statement details.legs").length, 1);
    check("route: details lists the legs", C.$$("table.statement details.legs div").length, 3);
    const hiddenBefore = statementRows();
    const pz = C.$("#p-zero");
    check("zero toggle appears when lines are hidden", !!pz, true);
    pz.click(); await wait(150);
    check("showing zero lines adds rows", statementRows() > hiddenBefore, true);
    check("zero toggle can hide them again", (C.$("#p-zero").click(), await wait(150), statementRows()), hiddenBefore);
    check("zero toggle does not touch the saved setting", C.T.S.settings.hideZero, true);
    await C.go("people", "ledger");
    check("ledger renders route lines", C.$$("table.ledger tbody tr:not(.sumrow)").length >= 1, true);

    C.T.S.editMode = true;
    await C.go("people", "statement");
    const boxes = C.$$("table.statement .exbox");
    check("edit mode shows an exclusion box", boxes.length >= 1, true);
    boxes[0].click(); await wait(250);
    const ids = C.T.ENG.M.items.filter(it => it.p.key === key && it.route).map(it => it.id);
    check("excluding a route stop excludes the whole route", ids.every(id => C.T.S.excl.includes(id)) && ids.length === 2, true);
    C.T.S.editMode = false; C.T.S.excl = [];

    C.T.S.settings.prices["أبو حمص"] = null;
    C.T.S.settings.pairs = {};
    load([mk("ابو حمص")]);
    await C.go("prices");
    check("need panel lists the unpriced city", !!C.$('#need input[data-city="أبو حمص"]'), true);
    const inp = C.$('#need input[data-city="أبو حمص"]');
    inp.value = "14"; C.fire(inp); await wait(300);
    check("entering the price saves it", C.T.S.settings.prices["أبو حمص"], 14);
    check("need panel disappears once priced", !!C.$("#need"), false);
    check("display panel has both toggles", !!C.$("#display #s-merge") && !!C.$("#display #s-hidez"), true);
    const hz = C.$("#s-hidez"); hz.checked = false; C.fire(hz); await wait(250);
    check("display toggle saves the option", JSON.parse(C.w.localStorage.getItem("addad2.settings")).hideZero, false);

    const opt = C.T.IO.settingsSheets().find(x => x.name === "خيارات");
    check("options sheet is exported", !!opt && opt.rows.length === 7, true);
    const target = JSON.parse(JSON.stringify(C.T.S.settings));
    target.mergeTrips = true;
    const flip = opt.rows.map(r => r[0] === "دمج خط السير في بند واحد" ? [r[0], false] : r);
    C.T.IO.readSettings([{ name: "خيارات", rows: flip }]).forEach(x => x.apply(target));
    check("options sheet import applies the flag", target.mergeTrips, false);
    check("no script errors (phase 4)", C.errs, []);
    C.w.close();

    const E = await boot();
    const ek = E.T.ENG.personKey("غادة");
    E.T.S.settings.people[ek] = { name: "غادة", cls: [{ v: 3 }, { from: "2026-04-01", v: 1 }] };
    const er = (ent, d) => ({ d, ent, g: "فحص", car: false, people: ["غادة"], src: "e:" + Math.random() });
    E.T.S.raw = [er("كفر الدوار طلاب", "2026-03-02"), er("ابو حمص", "2026-03-02"), er("كفر الدوار طلاب", "2026-04-06")];
    E.T.S.filters.people = [ek];
    E.w.eval("rebuild()");
    const ep = E.T.ENG.filter({ months: [], from: "", to: "", purp: [], car: [], zone: [], people: [], cities: [], types: [], ents: [], bands: [], amt: [], kinds: [], q: "" }).persons.find(p => p.name === "غادة");
    check("report data: grade sequence", ep.clsSeq, [3, 1]);
    await E.go("people", "table");
    check("people table shows the grade change", E.$(".ptbl tbody").textContent.includes("ثم"), true);
    E.T.REPORT.dialog({ summary: true, statements: true, people: [] }); await wait(400);
    const rp = E.$$(".r-page").map(x => x.textContent).join(" ");
    check("printed report shows the grade change", rp.includes("الثالثة ثم الأولى"), true);
    check("printed report keeps one route line", (rp.match(/والعودة/g) || []).length >= 2, true);
    check("printed report has no zero-fee rows", E.$$(".r-stmt tbody tr").filter(r => /^[0٠]$/.test(r.lastElementChild.textContent.trim())).length, 0);
    E.w.document.dispatchEvent(new E.w.KeyboardEvent("keydown", { key: "Escape" })); await wait(250);
    E.T.ACT.dialog(); await wait(300);
    check("activity report opens", E.$$(".modal.show").length >= 1, true);
    E.w.document.dispatchEvent(new E.w.KeyboardEvent("keydown", { key: "Escape" })); await wait(250);
    let xl = true;
    try { E.T.IO.exportExcel(E.T.currentResult()); } catch (err) { xl = err.message; }
    check("excel export runs with dated grades", xl, true);
    check("no script errors (reports)", E.errs, []);
    E.w.close();

    const F = await boot();
    const fc = "كفر الدوار";
    await F.go("prices");
    F.$('.tl-btn[data-tl="allow:' + fc + '"]').click(); await wait(100);
    check("flag editor uses a yes/no selector", F.$$(".modal.show .tl-t select[data-v]").length, 1);
    F.$("[data-add]").click(); await wait(50);
    const fr = F.$$(".modal.show .tl-t tbody tr")[1];
    fr.querySelector("[data-f]").value = "2026-04-01";
    fr.querySelector("[data-v]").value = "1"; F.fire(fr.querySelector("[data-v]"));
    F.$("[data-ok]").click(); await wait(250);
    check("flag editor saves booleans", F.T.S.settings.allow[fc].map(p => p.v), [false, true]);
    await F.go("prices");
    check("allowance chip replaces the switch", !!F.$('.tl-chip[data-tl="allow:' + fc + '"]'), true);
    F.$('.tl-btn[data-tl="km:' + fc + '"]').click(); await wait(100);
    F.$("[data-add]").click(); await wait(50);
    const kr = F.$$(".modal.show .tl-t tbody tr")[1];
    kr.querySelector("[data-f]").value = "2026-04-01";
    kr.querySelector("[data-v]").value = "88"; F.fire(kr.querySelector("[data-v]"));
    F.$("[data-ok]").click(); await wait(250);
    check("km editor saves numbers", [F.T.S.settings.km[fc][1]], [{ from: "2026-04-01", v: 88 }]);
    check("no script errors (flag editor)", F.errs, []);
    F.w.close();

    process.exit(summary() ? 1 : 0);
  })();
}
