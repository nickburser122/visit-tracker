const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = process.env.ADDAD_ROOT || path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

function load() {
  const ctx = vm.createContext({ console });
  vm.runInContext(read("js/data.js") + "\nthis.NZ = NZ; this.DEFAULT_SETTINGS = DEFAULT_SETTINGS; this.ENTITY_INFO = ENTITY_INFO; this.pairKey = typeof pairKey === 'undefined' ? null : pairKey; this.TL = TL;", ctx);
  ctx.UI = { fm: n => n == null ? "—" : String(n) };
  ctx.S = { settings: null, raw: [], excl: [] };
  ctx.saveSettings = () => {};
  vm.runInContext(read("js/engine.js") + "\nthis.ENG = ENG;", ctx);
  return ctx;
}

const ctx = load();
const { ENG, DEFAULT_SETTINGS, ENTITY_INFO } = ctx;
const clone = o => JSON.parse(JSON.stringify(o));
ctx.S.settings = clone(DEFAULT_SETTINGS);
const BLANK = { months: [], from: "", to: "", purp: [], car: [], zone: [], people: [], cities: [], types: [], ents: [], bands: [], amt: [], kinds: [], q: "" };
const P = c => DEFAULT_SETTINGS.prices[c];
const CLS3 = 7.5, CLS12 = 10;

function run(rows, patch = {}) {
  const st = clone(DEFAULT_SETTINGS);
  Object.assign(st, patch);
  st.pairs = { ...(patch.pairs || {}) };
  ctx.S.settings = st;
  ctx.S.raw = rows;
  ENG.registerPeople(rows);
  ENG.build(rows);
  return ENG.filter(BLANK);
}

const row = (d, ent, people, o = {}) => ({ d, ent, g: o.g || "فحص", car: !!o.car, people: [].concat(people), src: "t:" + Math.random(), ...(o.cp ? { cp: o.cp } : {}) });
const D = "2026-03-02";
const person = (R, name) => R.persons.find(p => p.name === name);
const ENT = { kd1: "كفر الدوار طلاب", kd2: "كفر الدوار قوي عاملة", ah: "ابو حمص", itay: "مستشفي ايتاي", dmn: "مستشفي كونكورد", mah: "المحمودية", alx: "الصفوة اسكندرية" };

let pass = 0, fail = 0;
const near = (a, b) => a != null && b != null && Math.abs(a - b) < 1e-9;
function check(name, got, want) {
  const ok = Array.isArray(want) ? JSON.stringify(got) === JSON.stringify(want) : near(got, want) || got === want;
  ok ? pass++ : fail++;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : "  got=" + JSON.stringify(got) + " want=" + JSON.stringify(want)));
}

const KD = "كفر الدوار", AH = "أبو حمص", IT = "إيتاي البارود", MH = "المحمودية", AX = "الإسكندرية";
const kdKey = ENG.resolve(ENT.kd1).city, ahKey = ENG.resolve(ENT.ah).city;
check("resolver maps كفر الدوار", kdKey, KD);
check("resolver maps أبو حمص", ahKey, AH);
check("resolver maps إيتاي", ENG.resolve(ENT.itay).city, IT);
check("resolver maps دمنهور (مستشفى كونكورد)", ENG.resolve(ENT.dmn).city, "دمنهور");

const pk = (a, b) => [a, b].sort().join("|");

let R = run([row(D, ENT.kd1, "غادة")]);
check("S1 single outside stop = 2×fare + class", R.total, 2 * P(KD) + CLS12);

R = run([row(D, ENT.kd1, "ميسرة")]);
check("S1b third class single stop", R.total, 2 * P(KD) + CLS3);

R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.kd2, "ميسرة")]);
check("S2 two places same city same day = one round trip + ONE internal fee", R.total, 2 * P(KD) + CLS3);
check("S2 not flagged (same city needs no pair price)", R.est, 0);
check("S2 no pending pairs", ENG.M.meta.pend, 0);

R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.kd2, "ميسرة")], { internalOnce: false });
check("S4 setting off → internal fee per place again", R.total, 2 * P(KD) + 2 * CLS3);

R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.kd1, "ميسرة")]);
check("S12 same place twice same day (duplicate rows)", R.total, 2 * P(KD) + CLS3);

R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة")], { pairs: { [pk(KD, AH)]: 10 } });
check("S3 two cities, typed pair price", R.total, P(KD) + 10 + P(AH) + CLS3);
check("S3 typed → not estimated", R.est, 0);
check("S3 typed → nothing pending", ENG.M.meta.pend, 0);

R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة")]);
check("S3b untyped pair → estimate = fare Damanhour→2nd city", R.total, P(KD) + P(AH) + P(AH) + CLS3);
check("S3b flagged as estimate", R.est, 1);
check("S3b pending pair registered", Object.keys(ENG.M.meta.pairs), [pk(KD, AH)]);
check("S3b pending count", ENG.M.meta.pend, 1);

R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة")], { pairs: { [pk(KD, AH)]: 12 } });
const t12 = R.total;
R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة")], { pairs: { [pk(KD, AH)]: 13 } });
check("S3c raising pair price by 1 raises total by exactly 1", R.total - t12, 1);

R = run([row(D, ENT.ah, "ميسرة"), row(D, ENT.kd1, "ميسرة")], { pairs: { [pk(KD, AH)]: 10 } });
check("S3d pair price is symmetric (reverse order, same hop price)", R.total, P(AH) + 10 + P(KD) + CLS3);

R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة")], { chainTrips: false });
check("S5 chain off → legacy round trip per city, one internal fee", R.total, 2 * P(KD) + 2 * P(AH) + CLS3);
check("S5 chain off → never flagged", R.est, 0);

R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة"), row(D, ENT.kd2, "ميسرة")], { pairs: { [pk(KD, AH)]: 10 } });
check("S6 A→B→A uses the pair price twice", R.total, P(KD) + 10 + 10 + P(KD) + CLS3);

R = run([row(D, ENT.dmn, "ميسرة"), row(D, ENT.itay, "ميسرة")]);
check("S7 Damanhour stop stays on service price and is outside the chain", R.total, 2 * DEFAULT_SETTINGS.servicePrice + 2 * P(IT) + CLS3);
check("S7 single outside stop → no estimate", R.est, 0);

R = run([row(D, ENT.kd1, ["ميسرة", "اباظة"]), row(D, ENT.ah, "ميسرة")], { pairs: { [pk(KD, AH)]: 10 } });
check("S10 teammate on one stop only pays standalone round trip", person(R, "اباظة").sum, 2 * P(KD) + CLS12);
check("S10 the one who did both stops pays the chain", person(R, "ميسرة").sum, P(KD) + 10 + P(AH) + CLS3);

R = run([row(D, ENT.kd1, "ميسرة", { car: true }), row(D, ENT.ah, "ميسرة")]);
const mis = person(R, "ميسرة");
check("S8 car stop + public stop → only the public stop is paid, standalone", mis.sum, 2 * P(AH) + CLS3);
const altWorld = P(KD) + P(AH) + P(AH) + CLS3;
check("S8 'if no car' world prices the whole day as one chain", R.total + mis.save, altWorld);
check("S8 saving = no-car world − actual", mis.save, altWorld - (2 * P(AH) + CLS3));

R = run([row(D, ENT.kd1, "ميسرة"), row(D, "مكان غير معروف تماما", "ميسرة")]);
check("S11 unknown-city stop stays out of the chain and is flagged missing", R.miss, 1);
check("S11 known stop keeps its standalone cost", R.items.find(i => i.v.ent === ENT.kd1).sum, 2 * P(KD) + CLS3);

R = run([row(D, ENT.kd1, "ميسرة"), row("2026-03-03", ENT.ah, "ميسرة")]);
check("different days never chain", R.total, 2 * P(KD) + CLS3 + 2 * P(AH) + CLS3);

R = run([row(D, "الشرطة", "ميسرة"), row(D, ENT.kd1, "ميسرة")]);
check("zero-cost entity does not consume the internal fee", R.total, 2 * P(KD) + CLS3);

R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة"), row(D, ENT.itay, "ميسرة")], { pairs: { [pk(KD, AH)]: 10, [pk(AH, IT)]: 15 } });
check("three cities chain with two typed pairs", R.total, P(KD) + 10 + 15 + P(IT) + CLS3);

R = run([row(D, ENT.kd1, "ميسرة", { car: true }), row(D, ENT.kd2, "ميسرة", { car: true })], { carNearInternal: true });
check("car-near-internal + once/day → one internal fee for two car stops", R.total, CLS3);

R = run([row(D, ENT.itay, "غادة", { car: true })]);
check("car + far city allowance unchanged by new rules (control)", R.total, 0);

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function bigMonth(seed) {
  const rnd = rng(seed), pick = a => a[Math.floor(rnd() * a.length)];
  const names = Object.values(ENTITY_INFO).map(o => o.name).filter(n => !/مسائي/.test(n));
  const ppl = ["اباظة", "لبنى", "أماني", "غادة", "شوقي", "شلتوت", "ميسرة", "حمودين", "نهى", "سمر"];
  const rows = [];
  for (let day = 0; day < 240; day++) {
    const d = new Date(Date.UTC(2026, 0, 4 + day)).toISOString().slice(0, 10);
    const n = Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const team = [...new Set([pick(ppl), pick(ppl), rnd() < .3 ? pick(ppl) : ""].filter(Boolean))];
      rows.push({ d, ent: pick(names), g: rnd() < .5 ? "خطة المرور" : "فحص", car: rnd() < .3, people: team, src: "g:" + rows.length });
    }
  }
  return rows;
}

function dayTotals(R) {
  const m = new Map();
  for (const it of R.items) { const k = it.p.key + "|" + it.v.d; m.set(k, (m.get(k) || 0) + it.sum); }
  return m;
}

for (const seed of [7, 99, 2026]) {
  const rows = bigMonth(seed);
  const allItems = [];
  for (const patch of [{}, { internalOnce: false }, { chainTrips: false }, { internalOnce: false, chainTrips: false }, { mergeTrips: false }, { hideZero: false }, { mergeTrips: false, hideZero: false }]) {
    const tag = "seed " + seed + " " + JSON.stringify(patch);
    R = run(rows, patch);
    const m = ENG.M;
    let sumLines = true, kindSum = true, onceOk = true, estOk = true, cls = {};
    for (const it of m.items) {
      let s = 0, e = 0;
      for (const l of it.ls) { if (l.a != null) s += l.a; if (l.est) e += l.estN || 1; }
      if (Math.abs(s - it.sum) > 1e-9) sumLines = false;
      if (Math.abs(it.k.travel + it.k.class + it.k.service + it.k.allow - it.sum) > 1e-9) kindSum = false;
      if (e !== it.est) estOk = false;
      const k = it.p.key + "|" + it.v.d;
      cls[k] = (cls[k] || 0) + it.k.class;
      it.cls = it.p.cls;
    }
    if (patch.internalOnce !== false) for (const it of m.items) if (cls[it.p.key + "|" + it.v.d] > CLS12 + 1e-9) onceOk = false;
    check(tag + " · item.sum equals the sum of its lines", sumLines, true);
    check(tag + " · kind buckets add up to item.sum", kindSum, true);
    check(tag + " · est count matches flagged lines", estOk, true);
    if (patch.internalOnce !== false) check(tag + " · never more than one internal fee per person per day", onceOk, true);
    check(tag + " · filter total equals Σ item sums", R.total, m.items.reduce((s, it) => s + it.sum, 0));
    check(tag + " · Σ persons equals total", R.persons.reduce((s, p) => s + p.sum, 0), R.total);
    check(tag + " · pending pairs = distinct unset pairs seen", ENG.M.meta.pend, Object.values(ENG.M.meta.pairs).filter(o => o.est).length);
    allItems.push(R.total);

    const noCarRows = rows.map(r => ({ ...r, car: false, cp: undefined }));
    const A = run(noCarRows, patch);
    const noCarWorld = dayTotals(A);
    R = run(rows, patch);
    const act = dayTotals(R);
    const saveByDay = new Map();
    for (const it of ENG.M.items) if (it.p.car && it.alt != null) { const k = it.p.key + "|" + it.v.d; saveByDay.set(k, (saveByDay.get(k) || 0) + it.save); }
    let consistent = true, bad = "";
    for (const [k, v] of act) {
      const hasNull = ENG.M.items.some(it => it.p.key + "|" + it.v.d === k && it.p.car && it.alt == null);
      if (hasNull) continue;
      const want = (noCarWorld.get(k) || 0) - v;
      const got = saveByDay.get(k) || 0;
      if (Math.abs(want - got) > 1e-6) { consistent = false; bad = k + " want " + want + " got " + got; break; }
    }
    check(tag + " · 'if no car' world reconciles day by day with savings" + (bad ? " [" + bad + "]" : ""), consistent, true);
  }
}

{
  const rows = bigMonth(7);
  run(rows, { internalOnce: false, chainTrips: false });
  const legacy = dayTotals(ENG.filter(BLANK));
  const legacyMiss = ENG.M.items.reduce((s, it) => s + it.miss, 0);
  R = run(rows, { internalOnce: true, chainTrips: true });
  const now = dayTotals(R);
  let worse = 0, equalSingle = 0, singleDays = 0;
  const stops = new Map();
  for (const it of ENG.M.items) { const k = it.p.key + "|" + it.v.d; stops.set(k, (stops.get(k) || 0) + 1); }
  for (const [k, v] of now) {
    if (v > legacy.get(k) + 1e-9) worse++;
    if (stops.get(k) === 1) { singleDays++; if (Math.abs(v - legacy.get(k)) < 1e-9) equalSingle++; }
  }
  check("new rules never charge a person-day MORE than the legacy rules (estimates only lower it)", worse, 0);
  check("single-stop days are identical to legacy (no regression)", equalSingle, singleDays);
  check("legacy and new agree on missing-price count", R.miss, legacyMiss);
}

{
  const rows = bigMonth(2026);
  const ref = run(rows, { mergeTrips: false, hideZero: false });
  const refDays = dayTotals(ref), refTotal = ref.total, refMiss = ref.miss, refEst = ref.est;
  R = run(rows, {});
  const now = dayTotals(R);
  let dayOk = true;
  for (const [k, v] of refDays) if (Math.abs(v - (now.get(k) || 0)) > 1e-9) dayOk = false;
  check("defaults: grand total identical to unmerged/unhidden", R.total, refTotal);
  check("defaults: every person-day total identical", dayOk, true);
  check("defaults: missing-price count identical", R.miss, refMiss);
  check("defaults: estimated-hop count identical", R.est, refEst);
  let zeroShown = 0, tripLinesPerDay = new Map(), blank = 0, rawKept = true;
  for (const it of ENG.M.items) {
    for (const l of it.ls) if (l.a === 0) zeroShown++;
    const k = it.p.key + "|" + it.v.d;
    tripLinesPerDay.set(k, (tripLinesPerDay.get(k) || 0) + it.ls.filter(l => l.trip).length);
    if (!it.ls.length) blank++;
    if (it.raw.length < it.ls.length - 1) rawKept = false;
  }
  check("defaults: no zero-fee line is shown", zeroShown, 0);
  check("defaults: at most one route line per person per day", Math.max(...tripLinesPerDay.values()) <= 1, true);
  check("defaults: raw lines are kept for filters", rawKept, true);
  check("defaults: some items are fully hidden (zero-only)", blank > 0, true);
  const off = run(rows, { mergeTrips: false, hideZero: false });
  let same = true;
  for (const it of ENG.M.items) if (it.ls !== it.raw && JSON.stringify(it.ls) !== JSON.stringify(it.raw)) same = false;
  check("both toggles off: display lines equal the legacy lines", same, true);
  check("both toggles off: total unchanged", off.total, refTotal);
  const hz = run(rows, { mergeTrips: false });
  check("hide-zero only: total unchanged", hz.total, refTotal);
  const mg = run(rows, { hideZero: false });
  check("merge only: total unchanged", mg.total, refTotal);
  run(rows, {});
  const kz = ENG.filter({ ...BLANK, kinds: ["zero"] });
  const kzOff = (run(rows, { hideZero: false }), ENG.filter({ ...BLANK, kinds: ["zero"] }));
  check("kind filter still finds zero-fee entities while they are hidden", kz.items.length, kzOff.items.length);
  check("kind filter finds some zero-fee items", kz.items.length > 0, true);
}

{
  R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة"), row(D, ENT.itay, "ميسرة")], { pairs: { [pk(KD, AH)]: 10, [pk(AH, IT)]: 15 } });
  const items = ENG.M.items.filter(it => it.p.name === "ميسرة");
  const withLines = items.filter(it => it.ls.length);
  const routeLines = items.flatMap(it => it.ls).filter(l => l.kind === "travel");
  check("three-city day shows exactly one route line", routeLines.length, 1);
  check("route line carries the whole route fare", routeLines[0].a, P(KD) + 10 + 15 + P(IT));
  check("route line names every place in order", routeLines[0].t, "من دمنهور إلى " + [ENT.kd1, ENT.ah, ENT.itay].join(" ثم ") + " والعودة");
  check("only the internal fee remains besides the route line", items.flatMap(it => it.ls).length, 2);
  check("only one item carries lines", withLines.length, 1);

  R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.kd2, "ميسرة")]);
  const l2 = ENG.M.items.flatMap(it => it.ls).filter(l => l.kind === "travel");
  check("two visits in the same city give one route line", l2.length, 1);
  check("same-city route costs one round trip", l2[0].a, 2 * P(KD));

  R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة")]);
  const est = ENG.M.items.flatMap(it => it.ls).find(l => l.kind === "travel");
  check("estimated hop keeps its flag on the merged line", est.est, true);
  check("estimated hop keeps its pair on the merged line", est.pair, pk(KD, AH));

  R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة")], { mergeTrips: false, hideZero: false });
  check("merge off: three separate travel lines come back", ENG.M.items.flatMap(it => it.ls).filter(l => l.kind === "travel").length, 3);

  R = run([row(D, "الشرطة", "ميسرة"), row(D, ENT.kd1, "ميسرة")], { hideZero: true });
  check("zero-cost entity row is hidden by default", ENG.M.items.find(it => it.v.ent === "الشرطة").ls.length, 0);
  R = run([row(D, "الشرطة", "ميسرة"), row(D, ENT.kd1, "ميسرة")], { hideZero: false });
  check("zero-cost entity row returns when the toggle is off", ENG.M.items.find(it => it.v.ent === "الشرطة").ls.length, 1);

  R = run([row(D, ENT.kd1, "ميسرة")], { prices: { ...DEFAULT_SETTINGS.prices, [KD]: null } });
  check("unpriced lines are never hidden", ENG.M.items[0].ls.some(l => l.a == null), true);
}

{
  const TL = ctx.TL;
  check("TL scalar passes through", TL.at(12, "2026-01-01"), 12);
  check("TL null scalar is null", TL.at(null, "2026-01-01"), null);
  const pr = [{ v: 18 }, { from: "2026-04-01", v: 20 }, { from: "2026-07-01", to: "2026-07-31", v: 25 }];
  check("TL open first period applies to the past", TL.at(pr, "2025-01-01"), 18);
  check("TL boundary day takes the new value", TL.at(pr, "2026-04-01"), 20);
  check("TL day before boundary keeps the old value", TL.at(pr, "2026-03-31"), 18);
  check("TL closed period applies inside", TL.at(pr, "2026-07-15"), 25);
  check("TL after a closed period the earlier open one resumes", TL.at(pr, "2026-08-01"), 20);
  check("TL gap with no match is null", TL.at([{ from: "2026-02-01", to: "2026-02-28", v: 5 }], "2026-03-01"), null);
  check("TL no date gives the latest period", TL.at(pr, null), 25);
  check("TL overlap: latest start wins", TL.at([{ from: "2026-01-01", v: 1 }, { from: "2026-02-01", v: 2 }], "2026-03-01"), 2);
  check("TL explicit null period is unpriced", TL.at([{ v: 5 }, { from: "2026-05-01", v: null }], "2026-06-01"), null);
  check("TL clean collapses one open period to a scalar", TL.clean([{ v: 7 }]), 7);
  check("TL clean sorts by start", TL.clean([{ from: "2026-05-01", v: 2 }, { v: 1 }]).map(p => p.v), [1, 2]);
  check("TL clean drops negatives and bad dates", TL.clean([{ v: -1 }, { from: "x", v: 3 }, { v: 4 }]), 4);
  check("TL clean drops reversed ranges", TL.clean([{ from: "2026-05-01", to: "2026-04-01", v: 3 }]), null);
  check("TL clean keeps a plain number", TL.clean(9.5), 9.5);
  check("TL clean turns junk into null", TL.clean("abc"), null);
  check("TL label lists the periods", TL.label(pr, String).includes("من 2026-04-01"), true);
  const san = TL.sanitize({ prices: { a: [{ v: 3 }], b: "x" }, pairs: { "a|b": [{ v: -1 }], "c|d": 4 }, classAmount: {}, carAllowance: {}, servicePrice: [{ v: 6 }], people: { p: { cls: [{ v: 2 }] }, q: { cls: null } }, defaultClass: 3 });
  check("sanitize collapses prices", san.prices.a, 3);
  check("sanitize nulls junk prices", san.prices.b, null);
  check("sanitize drops invalid pairs", Object.keys(san.pairs), ["c|d"]);
  check("sanitize collapses service price", san.servicePrice, 6);
  check("sanitize collapses grades", san.people.p.cls, 2);
  check("sanitize defaults missing grades", san.people.q.cls, 3);
}

{
  const D2 = "2026-04-06", D3 = "2026-07-06";
  const prices = { ...DEFAULT_SETTINGS.prices, [KD]: [{ v: 20.5 }, { from: "2026-04-01", v: 30 }], [AH]: [{ from: "2026-04-01", v: 10 }] };
  R = run([row(D, ENT.kd1, "غادة"), row(D2, ENT.kd1, "غادة")], { prices });
  const byDay = d => ENG.M.items.filter(it => it.v.d === d).reduce((s, it) => s + it.sum, 0);
  check("dated city price: before the change", byDay(D), 2 * 20.5 + CLS12);
  check("dated city price: after the change", byDay(D2), 2 * 30 + CLS12);
  R = run([row(D, ENT.ah, "غادة")], { prices });
  check("price period starting later leaves earlier dates unpriced", R.miss, 1);
  R = run([row(D2, ENT.ah, "غادة")], { prices });
  check("price period applies once it starts", R.miss, 0);
  check("dated price amount", R.total, 20 + CLS12);

  const pairs = { [pk(KD, AH)]: [{ v: 5 }, { from: "2026-04-01", v: 12 }] };
  const chain = d => run([row(d, ENT.kd1, "غادة"), row(d, ENT.ah, "غادة")], { pairs, prices: DEFAULT_SETTINGS.prices });
  check("dated pair: before", chain(D).total, P(KD) + 5 + P(AH) + CLS12);
  check("dated pair: after", chain(D2).total, P(KD) + 12 + P(AH) + CLS12);
  check("dated pair set means not pending", (chain(D2), ENG.M.meta.pend), 0);

  const classAmount = { 1: [{ v: 10 }, { from: "2026-04-01", v: 15 }], 2: 10, 3: 7.5 };
  const carAllowance = { 1: [{ v: 37.5 }, { from: "2026-04-01", v: 45 }], 2: 37.5, 3: 30 };
  const g1 = { ...DEFAULT_SETTINGS.people, [ENG.personKey("غادة")]: { name: "غادة", cls: 1 } };
  R = run([row(D, ENT.kd1, "غادة"), row(D2, ENT.kd1, "غادة")], { classAmount, people: g1 });
  check("dated internal fee follows the visit date", [byDay(D), byDay(D2)], [2 * P(KD) + 10, 2 * P(KD) + 15]);
  R = run([row(D, ENT.alx, "غادة", { car: true }), row(D2, ENT.alx, "غادة", { car: true })], { carAllowance, people: g1 });
  check("dated car allowance follows the visit date", [byDay(D), byDay(D2)], [37.5, 45]);
  R = run([row(D, ENT.dmn, "غادة"), row(D3, ENT.dmn, "غادة")], { servicePrice: [{ v: 6.5 }, { from: "2026-06-01", v: 8 }] });
  check("dated service price follows the visit date", [byDay(D), byDay(D3)], [13, 16]);

  const grade = { ...DEFAULT_SETTINGS.people, [ENG.personKey("غادة")]: { name: "غادة", cls: [{ v: 3 }, { from: "2026-04-01", v: 1 }] } };
  R = run([row(D, ENT.kd1, "غادة"), row(D2, ENT.kd1, "غادة")], { people: grade });
  check("dated grade: each visit gets the grade of its date", ENG.M.items.map(it => it.p.cls), [3, 1]);
  check("dated grade: fees follow the grade", [byDay(D), byDay(D2)], [2 * P(KD) + CLS3, 2 * P(KD) + 10]);
  const gp = R.persons.find(p => p.name === "غادة");
  check("dated grade: person shows the latest grade", gp.cls, 1);
  check("dated grade: person keeps the sequence", gp.clsSeq, [3, 1]);
  check("dated grade: label shows the change", ENG.clsLabel(gp, ["", "الأولى", "الثانية", "الثالثة"]), "الثالثة ثم الأولى");
  R = run([row(D, ENT.kd1, "غادة")], { people: { ...DEFAULT_SETTINGS.people, [ENG.personKey("غادة")]: { name: "غادة", cls: [{ from: "2026-05-01", v: 1 }] } }, defaultClass: 2 });
  check("grade gap falls back to the default grade", ENG.M.items[0].p.cls, 2);
  R = run([row(D, ENT.kd1, "غادة")]);
  check("single-value grade has a one-step sequence", R.persons[0].clsSeq.length, 1);
}

{
  R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة"), row(D, ENT.itay, "ميسرة")], { pairs: { [pk(KD, AH)]: 10, [pk(AH, IT)]: 15 } });
  const its = ENG.M.items.filter(it => it.p.name === "ميسرة");
  const head = its.find(it => it.ls.some(l => l.legs));
  check("merged line lists every leg", head.ls.find(l => l.legs).legs.length, 4);
  check("legs add up to the merged amount", head.ls.find(l => l.legs).legs.reduce((s, g) => s + g.a, 0), head.ls.find(l => l.legs).a);
  check("every stop of the route knows the whole route", its.every(it => it.route && it.route.ids.length === 3), true);
  check("route ids point at the real items", its.every(it => it.route.ids.includes(it.id)), true);
  check("full lines keep the zero lines", its.some(it => it.full.some(l => l.a === 0)), true);
  check("hidden count equals the zero lines left out", its.reduce((s, it) => s + it.hid, 0), its.reduce((s, it) => s + it.full.length - it.ls.length, 0));
  check("hidden count is positive by default here", its.reduce((s, it) => s + it.hid, 0) > 0, true);

  R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة")], { hideZero: false });
  check("hide-zero off: nothing is hidden", ENG.M.items.every(it => it.hid === 0 && it.ls === it.full), true);
  R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "ميسرة")], { mergeTrips: false });
  check("merge off: no route grouping", ENG.M.items.every(it => it.route === null), true);
  check("merge off: no merged legs", ENG.M.items.flatMap(it => it.full).some(l => l.legs), false);
  R = run([row(D, ENT.kd1, "ميسرة")]);
  check("single stop: no route grouping", ENG.M.items[0].route, null);
  R = run([row(D, ENT.kd1, "ميسرة"), row(D, ENT.ah, "غادة")]);
  check("different people never share a route", ENG.M.items.every(it => it.route === null), true);
}

{
  const D2 = "2026-04-06";
  const tot = (rows, patch) => run(rows, patch).total;
  const rowsAt = (d, car) => [row(d, ENT.kd1, "غادة", car ? { car: true } : {})];
  const flag = [{ v: false }, { from: "2026-04-01", v: true }];
  const allowD = { ...DEFAULT_SETTINGS.allow, [KD]: flag };
  const allowOff = { ...DEFAULT_SETTINGS.allow, [KD]: false }, allowOn = { ...DEFAULT_SETTINGS.allow, [KD]: true };
  check("dated allowance: before the start it behaves as no allowance", tot(rowsAt(D, true), { allow: allowD }), tot(rowsAt(D, true), { allow: allowOff }));
  check("dated allowance: from the start it behaves as allowance", tot(rowsAt(D2, true), { allow: allowD }), tot(rowsAt(D2, true), { allow: allowOn }));
  check("dated allowance: the two sides really differ", tot(rowsAt(D2, true), { allow: allowOn }) !== tot(rowsAt(D2, true), { allow: allowOff }), true);
  check("dated allowance: non-car trips are unaffected", tot(rowsAt(D2, false), { allow: allowD }), tot(rowsAt(D2, false), { allow: allowOff }));
  R = run(rowsAt(D, true).concat(rowsAt(D2, true)), { allow: allowD });
  check("dated allowance: far flag follows the date", [...new Set(ENG.M.items.map(it => it.v.far))].length, 2);
  check("dated allowance: a gap means unknown", (run(rowsAt(D, true), { allow: { ...DEFAULT_SETTINGS.allow, [KD]: [{ from: "2026-05-01", v: true }] } }), ENG.M.items[0].v.far), null);

  const km = [{ v: 20 }, { from: "2026-04-01", v: 90 }];
  const kmD = { ...DEFAULT_SETTINGS.km, [KD]: km };
  R = run(rowsAt(D, false).concat(rowsAt(D2, false)), { km: kmD, allowMode: "km" });
  check("dated km: each visit gets the distance of its date", ENG.M.items.map(it => it.v.km), [20, 90]);
  check("dated km: the far threshold follows the date", ENG.M.items.map(it => it.v.far), [false, true]);
  check("dated km: the band follows the date", ENG.M.items[0].v.band !== ENG.M.items[1].v.band, true);
  check("dated km: city mode ignores the distance", (run(rowsAt(D2, true), { km: kmD, allowMode: "city" }), ENG.M.items[0].v.far), !!DEFAULT_SETTINGS.allow[KD]);
  check("scalar km is unchanged", (run(rowsAt(D, false), { allowMode: "km" }), ENG.M.items[0].v.km), DEFAULT_SETTINGS.km[KD]);
  check("TL keeps booleans", [ctx.TL.clean(false), ctx.TL.clean(true), ctx.TL.at([{ v: false }], "2026-01-01")], [false, true, false]);
  const san = ctx.TL.sanitize({ prices: {}, classAmount: {}, carAllowance: {}, km: { a: [{ v: 5 }], b: "x" }, allow: { a: false, b: [{ v: true }, { from: "2026-02-01", v: false }] }, pairs: {}, people: {}, defaultClass: 3 });
  check("sanitize keeps a false allowance", san.allow.a, false);
  check("sanitize keeps dated allowance", san.allow.b.length, 2);
  check("sanitize collapses km", [san.km.a, san.km.b], [5, null]);
}

{
  const split = v => v == null ? v : [{ to: "2026-01-14", v }, { from: "2026-01-15", to: "2026-03-09", v }, { from: "2026-03-10", v }];
  const mapOf = (m, f) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, f(v)]));
  for (const seed of [2026, 7, 99]) {
    const rows = bigMonth(seed);
    const pairs = { [pk(KD, AH)]: 9, [pk(AH, IT)]: 11, [pk(KD, IT)]: 13 };
    const base = { pairs, allowMode: seed === 7 ? "km" : "city" };
    const exploded = {
      ...base,
      prices: mapOf(DEFAULT_SETTINGS.prices, split),
      classAmount: mapOf(DEFAULT_SETTINGS.classAmount, split),
      carAllowance: mapOf(DEFAULT_SETTINGS.carAllowance, split),
      km: mapOf(DEFAULT_SETTINGS.km, split),
      allow: mapOf(DEFAULT_SETTINGS.allow, split),
      servicePrice: split(DEFAULT_SETTINGS.servicePrice),
      pairs: mapOf(pairs, split),
      people: mapOf(DEFAULT_SETTINGS.people, p => ({ ...p, cls: split(p.cls) }))
    };
    const a = run(rows, base);
    const itemsA = new Map(ENG.M.items.map(it => [it.id, [it.sum, it.k, it.alt, it.save, it.p.cls, it.v.km, it.v.far, it.v.band]]));
    const b = run(rows, exploded);
    const itemsB = new Map(ENG.M.items.map(it => [it.id, [it.sum, it.k, it.alt, it.save, it.p.cls, it.v.km, it.v.far, it.v.band]]));
    check("split periods with equal values change nothing (seed " + seed + "): total", b.total, a.total);
    check("split periods: missing and estimated counts", [b.miss, b.est], [a.miss, a.est]);
    check("split periods: every item identical", JSON.stringify([...itemsB]), JSON.stringify([...itemsA]));
  }
}

check("شلتوت is first class by default", DEFAULT_SETTINGS.people["شلتوت"].cls, 1);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
