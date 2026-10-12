const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = process.env.ADDAD_ROOT || path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

function load() {
  const ctx = vm.createContext({ console });
  vm.runInContext(read("js/data.js") + "\nthis.NZ = NZ; this.DEFAULT_SETTINGS = DEFAULT_SETTINGS; this.ENTITY_INFO = ENTITY_INFO; this.pairKey = typeof pairKey === 'undefined' ? null : pairKey;", ctx);
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
  for (const patch of [{}, { internalOnce: false }, { chainTrips: false }, { internalOnce: false, chainTrips: false }]) {
    const tag = "seed " + seed + " " + JSON.stringify(patch);
    R = run(rows, patch);
    const m = ENG.M;
    let sumLines = true, kindSum = true, onceOk = true, estOk = true, cls = {};
    for (const it of m.items) {
      let s = 0, e = 0;
      for (const l of it.ls) { if (l.a != null) s += l.a; if (l.est) e++; }
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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
