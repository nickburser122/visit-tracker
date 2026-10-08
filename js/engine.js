const ENG = (() => {
  const digits = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const p2 = n => String(n).padStart(2, "0");
  const okYMD = (y, m, d) => y > 1900 && y < 2200 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  const iso = (y, m, d) => okYMD(y, m, d) ? y + "-" + p2(m) + "-" + p2(d) : "";
  const fixYear = y => y < 100 ? 2000 + y : y;
  const DAY_WORDS = /(?<![\u0621-\u064a])(?:يوم\s+)?(?:ال)?(?:سبت|[اأإ]حد|[اأإ]ثنين|[اأإ]ثنا|ثلاثاء?|[اأإ]ربعاء?|خميس|جمع[ةه])(?![\u0621-\u064a])\s*[,،]?|\b(?:sat|sun|mon|tue|wed|thu|fri)[a-z]*\.?\s*[,،]?/gi;
  const MONTH_KEYS = Object.keys(MONTHS_AR).map(k => [NZ(k), MONTHS_AR[k]]).sort((a, b) => b[0].length - a[0].length);
  const monthWord = w => { const z = NZ(w); const hit = MONTH_KEYS.find(([k]) => z.startsWith(k) || (z.length >= 3 && k.startsWith(z))); return hit ? hit[1] : 0; };

  function dateParts(v, order) {
    if (v == null || v === "") return null;
    if (typeof v === "number") {
      if (v > 20000 && v < 80000) { const s = new Date(Math.round((v - 25569) * 864e5)); return { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate() }; }
      return null;
    }
    if (v instanceof Date) return isNaN(v) ? null : { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
    let s = digits(v).replace(DAY_WORDS, " ").replace(/[\u200e\u200f]/g, "").trim();
    if (!s || s.length > 40) return null;
    let m = s.match(/^(\d{4})[-\/.\s](\d{1,2})[-\/.\s](\d{1,2})(?:[T\s].*)?$/);
    if (m) return { y: +m[1], m: +m[2], d: +m[3] };
    m = s.match(/^(\d{1,2})\s*[-\/.\\]\s*(\d{1,2})\s*[-\/.\\]\s*(\d{2}|\d{4})(?:\s.*)?$/);
    if (m) {
      const a = +m[1], b = +m[2], y = fixYear(+m[3]);
      const mdy = order === "mdy" || (a <= 12 && b > 12);
      return mdy ? { y, m: a, d: b } : { y, m: b, d: a };
    }
    m = s.match(/^(\d{1,2})\s*[-\/.\\]\s*(\d{1,2})$/);
    if (m) { const a = +m[1], b = +m[2]; const mdy = order === "mdy" || (a <= 12 && b > 12); return mdy ? { y: null, m: a, d: b } : { y: null, m: b, d: a }; }
    m = s.match(/^(\d{1,2})\s*[-\/.\s]?\s*([a-z\u0621-\u064a]{3,})\s*[-\/.,،\s]?\s*(\d{2,4})?$/i);
    if (m) { const mo = monthWord(m[2]); if (mo) return { y: m[3] ? fixYear(+m[3]) : null, m: mo, d: +m[1] }; }
    m = s.match(/^([a-z\u0621-\u064a]{3,})\s*(\d{1,2})\s*[,،]?\s*(\d{2,4})?$/i);
    if (m) { const mo = monthWord(m[1]); if (mo) return { y: m[3] ? fixYear(+m[3]) : null, m: mo, d: +m[2] }; }
    if (/^\d{5}(\.\d+)?$/.test(s)) return dateParts(+s, order);
    return null;
  }
  function toDate(v, order, year) {
    const p = dateParts(v, order);
    if (!p) return "";
    return iso(p.y || year || new Date().getFullYear(), p.m, p.d);
  }

  const TRUE_RX = /^(true|1|yes|y|نعم|اه|ايوه|x|✓|✔|☑|✅|صح|\*|سياره|بالسياره|سياره الهيئه|عربيه|بالعربيه|هيئه|الهيئه|car)$/i;
  const FALSE_RX = /^(false|0|no|n|لا|بدون|-|—|×|✗|✘|خاص|مواصلات)$/i;
  const truthy = v => v === true || v === 1 || TRUE_RX.test(NZ(v));
  const boolish = v => typeof v === "boolean" || TRUE_RX.test(NZ(v)) || FALSE_RX.test(NZ(v));

  const HEAD = {
    d: ["التاريخ", "اليوم", "تاريخ المرور", "تاريخ الزياره", "تاريخ", "يوم", "date", "day"],
    e: ["جهه المرور", "الجهه المزاره", "اسم الجهه", "مكان المرور", "الجهه", "جهه", "المكان", "الموقع", "المنشاه", "entity", "place", "location", "site"],
    g: ["الغرض من المرور", "الغرض", "نوع المرور", "نوع الزياره", "سبب المرور", "السبب", "purpose", "reason"],
    p: ["القائم بالمرور", "القائمين بالمرور", "القائم", "القائمين", "الافراد", "الاسماء", "اسماء", "المرافقين", "المفتشين", "فريق المرور", "اللجنه", "الفريق", "staff", "people", "team", "names", "inspectors"],
    c: ["سياره الهيئه", "سياره", "السياره", "عربيه", "وسيله الانتقال", "car", "vehicle"]
  };
  for (const k in HEAD) HEAD[k] = HEAD[k].map(NZ);
  const REQ = ["d", "e", "p"];
  const EXACT = {
    d: ["اليوم", "التاريخ", "تاريخ المرور"],
    e: ["جهة المرور", "الجهة"],
    g: ["الغرض من المرور", "الغرض"],
    p: ["القائم بالمرور", "القائمين بالمرور", "القائمون بالمرور"],
    c: ["سيارة الهيئة", "السيارة"]
  };
  for (const k in EXACT) EXACT[k] = EXACT[k].map(NZ);

  function exactHeader(rows) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = rows[i] || [], cols = {};
      r.forEach((c, j) => { const z = NZ(c); if (!z) return; for (const k in EXACT) if (cols[k] == null && EXACT[k].includes(z)) { cols[k] = j; break; } });
      if (REQ.every(k => cols[k] != null)) return { hdr: i, cols };
    }
    return null;
  }

  function headerHit(cell, words) {
    const c = NZ(cell);
    if (!c || c.length > 40) return 0;
    let best = 0;
    for (const w of words) {
      if (c === w) return 1;
      if (c.startsWith(w) || c.endsWith(w)) best = Math.max(best, .8);
      else if (c.includes(w)) best = Math.max(best, .55);
    }
    return best;
  }
  function headerRow(rows) {
    let best = { hdr: -1, score: 0 };
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const r = rows[i] || [];
      let s = 0;
      for (const [k, w] of Object.entries(HEAD)) { let m = 0; r.forEach(c => { m = Math.max(m, headerHit(c, w)); }); s += m * (REQ.includes(k) ? 2 : 1); }
      if (s > best.score) best = { hdr: i, score: s };
    }
    return best.score >= 2 ? best : { hdr: -1, score: 0 };
  }

  const splitPeople = s => {
    const out = [], car = [];
    const raw = String(s == null ? "" : s).replace(/\r?\n/g, "-");
    for (let x of raw.split(/\s*(?:[-–—,،\/+|&؛;]|\sو\s|\s+و(?=ال))\s*/)) {
      x = x.trim();
      if (!x) continue;
      let c = false;
      const y = x.replace(/[(\[]?\s*(?:بال|ب)?(?:سيار[ةه]|عربي[ةه])(?:\s*الهيئ[ةه])?\s*[)\]]?/g, () => { c = true; return ""; }).replace(/[()\[\]]/g, " ").trim();
      if (!y || !/[\u0621-\u064aA-Za-z]/.test(y) || y.length > 30) continue;
      if (/^(د|ا|أ|م|مهندس|دكتور|الدكتور|ا\.|د\.)$/.test(y)) continue;
      const nm = y.replace(/^(?:د\s*\/|د\.\s*|أ\s*\/|ا\s*\/|م\s*\/|دكتور\s+|الدكتور\s+|الدكتوره\s+|دكتوره\s+)/, "").trim();
      if (!nm) continue;
      if (!out.includes(nm)) out.push(nm);
      if (c && !car.includes(nm)) car.push(nm);
    }
    return { names: out, car };
  };

  const knownPeople = () => new Set(Object.keys(S.settings.people).map(personKey));
  const knownEnts = () => {
    const s = new Set(Object.keys(ENTITY_INFO));
    for (const k of Object.keys(S.settings.entities || {})) s.add(k);
    for (const c of Object.keys(S.settings.prices)) s.add(NZ(c));
    s.add(NZ(DAMANHOUR));
    return s;
  };
  const TOTAL_RX = /^(الاجمالي|اجمالي|المجموع|مجموع|total|الاجمالى)/;
  const PURPOSE_RX = /خطه|فحص|لجنه|متابعه|نيابه|شكوي|شكوى|تفتيش|مرور|معاينه|اجتماع|تسليم|استلام/;

  function profile(rows, start) {
    const sample = rows.slice(start, start + 400).filter(r => r && r.some(x => x != null && x !== ""));
    const width = Math.min(60, Math.max(0, ...sample.map(r => r.length)));
    const kp = knownPeople(), ke = knownEnts();
    const ekeys = [...ke].filter(k => k.length >= 4);
    const out = [];
    for (let i = 0; i < width; i++) {
      let n = 0, date = 0, bool = 0, purp = 0, multi = 0, text = 0, ppl = 0, ent = 0, num = 0, len = 0, mdy = 0, dmy = 0;
      const distinct = new Set();
      for (const r of sample) {
        const v = r[i];
        if (v == null || v === "") continue;
        n++;
        const z = NZ(v);
        distinct.add(z);
        len += z.length;
        if (typeof v === "number") num++;
        const dp = dateParts(v);
        if (dp) {
          date++;
          if (typeof v === "string") { const m = digits(v).match(/(\d{1,2})\s*[-\/.]\s*(\d{1,2})/); if (m && !/^\d{4}/.test(digits(v).trim())) { if (+m[1] > 12) dmy++; if (+m[2] > 12) mdy++; } }
        }
        if (boolish(v)) bool++;
        if (PURPOSE_RX.test(z) && z.length < 40) purp++;
        if (typeof v === "string" && /[\u0621-\u064a]/.test(v)) {
          text++;
          const sp = splitPeople(v).names;
          if (sp.length > 1) multi++;
          if (sp.some(x => kp.has(personKey(x)))) ppl++;
          if (ke.has(z) || ekeys.some(k => z.includes(k))) ent++;
        }
      }
      const N = n || 1;
      out.push({ i, n, date: date / N, bool: bool / N, purp: purp / N, multi: multi / N, text: text / N, ppl: ppl / N, ent: ent / N, num: num / N, avg: len / N, uniq: distinct.size / N, order: mdy > dmy ? "mdy" : "dmy", fill: n / (sample.length || 1) });
    }
    return out;
  }

  const CONTENT = {
    d: s => s.date * (s.fill > .2 ? 1 : .5),
    e: s => Math.min(1, s.ent * 1.1 + s.text * .5) * (1 - s.date) * (1 - s.ppl * .7) * (s.avg > 2 ? 1 : .3) - s.purp * .25,
    p: s => Math.min(1, s.ppl * 1.2 + s.multi * .6) * (1 - s.date) * (1 - s.ent * .4),
    g: s => s.purp * (1 - s.date) * (s.uniq < .6 ? 1 : .7),
    c: s => s.bool * (1 - s.date)
  };

  function mapColumns(rows, hdr) {
    const prof = profile(rows, hdr + 1);
    const head = hdr >= 0 ? rows[hdr] || [] : [];
    const cand = [];
    for (const k of Object.keys(HEAD)) for (const s of prof) {
      const h = headerHit(head[s.i], HEAD[k]);
      const c = Math.max(0, CONTENT[k](s));
      let sc = h * 1.25 + c;
      if (h >= .8 && c < .08 && k === "d") sc *= .45;
      if (s.n === 0) sc = h * .3;
      cand.push({ k, i: s.i, sc, h, c });
    }
    cand.sort((a, b) => b.sc - a.sc);
    const cols = {}, conf = {}, used = new Set();
    for (const x of cand) {
      if (cols[x.k] != null || used.has(x.i)) continue;
      const min = x.k === "c" ? .55 : x.k === "g" ? .45 : .4;
      if (x.sc < min) continue;
      cols[x.k] = x.i; conf[x.k] = Math.min(1, x.sc / 1.6); used.add(x.i);
    }
    const order = cols.d != null ? prof[cols.d].order : "dmy";
    return { cols, conf, order, prof };
  }

  function yearHint(name) {
    const m = digits(name || "").match(/(20\d{2}|19\d{2})/);
    return m ? +m[1] : null;
  }

  function extract(rows, hdr, cols, order, sheetName) {
    const out = [];
    const stat = { rows: 0, used: 0, noDate: 0, noEnt: 0, noPeople: 0, totals: 0, filled: 0, yearGuess: 0, carMarks: 0, empty: 0, days: 0 };
    const days = new Set();
    let lastDate = "", lastEnt = "", lastYear = yearHint(sheetName);
    if (!lastYear) for (let i = hdr + 1; i < Math.min(rows.length, hdr + 400); i++) { const p = dateParts((rows[i] || [])[cols.d], order); if (p && p.y) { lastYear = p.y; break; } }
    const headE = hdr >= 0 ? NZ((rows[hdr] || [])[cols.e]) : "";
    const txt = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      if (!r.some(x => x != null && x !== "")) continue;
      const rowText = NZ(r.slice(0, 4).join(" "));
      if (TOTAL_RX.test(NZ(r[cols.d])) || TOTAL_RX.test(NZ(r[cols.e])) || (TOTAL_RX.test(rowText) && !NZ(r[cols.p]))) { stat.totals++; continue; }
      const dp = dateParts(r[cols.d], order);
      let d = "", guessed = false;
      if (dp) { if (!dp.y) { guessed = true; dp.y = lastYear || new Date().getFullYear(); } d = iso(dp.y, dp.m, dp.d); if (d) lastYear = dp.y; }
      let ent = txt(r[cols.e]);
      const sp = splitPeople(r[cols.p]);
      if (!ent && !sp.names.length) { if (d) { stat.empty++; days.add(d); lastDate = d; } continue; }
      if (headE && NZ(ent) === headE) continue;
      stat.rows++;
      if (guessed) stat.yearGuess++;
      if (!ent && lastEnt && sp.names.length && !d) ent = lastEnt;
      if (!d && ent && sp.names.length && lastDate) { d = lastDate; stat.filled++; }
      if (!d) { stat.noDate++; continue; }
      if (!ent) { stat.noEnt++; continue; }
      if (!sp.names.length) { stat.noPeople++; continue; }
      days.add(d);
      lastDate = d; lastEnt = ent;
      const car = cols.c != null ? truthy(r[cols.c]) : false;
      if (sp.car.length) stat.carMarks += sp.car.length;
      const row = { d, ent, g: cols.g != null ? String(r[cols.g] == null ? "" : r[cols.g]).trim() : "", car, people: sp.names, src: (sheetName ? sheetName + ":" : "") + (i + 1) };
      if (sp.car.length) row.cp = sp.car;
      out.push(row);
    }
    stat.used = out.length;
    stat.days = days.size;
    stat.active = new Set(out.map(r => r.d)).size;
    return { rows: out, stat };
  }

  const SETTING_SHEETS = ["المدن", "الافراد", "الجهات", "بدون تكلفه", "الدرجات", "استثناءات السيرفيس"].map(NZ);

  const fingerprint = (rows, hdr) => hdr < 0 ? "" : (rows[hdr] || []).map(c => NZ(c)).join("|");
  function rememberCols(res) {
    const fp = fingerprint(res.sheet.rows, res.hdr);
    if (!fp) return;
    const mem = S.settings.colMemory || (S.settings.colMemory = {});
    mem[fp] = { cols: res.cols, order: res.order, t: Date.now() };
    const keys = Object.keys(mem).sort((a, b) => mem[b].t - mem[a].t);
    keys.slice(20).forEach(k => delete mem[k]);
    saveSettings();
  }

  function analyzeSheet(sheet) {
    const rows = sheet.rows || [];
    if (SETTING_SHEETS.includes(NZ(sheet.name)) || !rows.length) return { ok: false };
    const exact = exactHeader(rows);
    const h = exact ? { hdr: exact.hdr, score: 10 } : headerRow(rows);
    const map = mapColumns(rows, h.hdr);
    let remembered = false;
    if (exact) {
      map.cols = { ...exact.cols };
      map.conf = {};
      for (const k in map.cols) map.conf[k] = 1;
      const pd = map.prof[exact.cols.d];
      map.order = pd ? pd.order : "dmy";
    } else {
      const mem = (S.settings.colMemory || {})[fingerprint(rows, h.hdr)];
      if (mem) { map.cols = { ...mem.cols }; map.order = mem.order || map.order; for (const k in map.cols) map.conf[k] = 1; remembered = true; }
    }
    const cols = map.cols;
    const missing = REQ.filter(k => cols[k] == null);
    const res = { name: sheet.name, sheet, hdr: h.hdr, cols, conf: map.conf, order: map.order, missing, rows: [], stat: null, ok: false, remembered, exact: !!exact };
    if (missing.length) return res;
    const ex = extract(rows, h.hdr, cols, map.order, sheet.name);
    res.rows = ex.rows; res.stat = ex.stat;
    res.ok = ex.rows.length > 0;
    const pref = NZ(sheet.name) === NZ(S.settings.sheetPref) ? 1000 : 0;
    const quality = ex.stat.rows ? ex.rows.length / ex.stat.rows : 0;
    res.quality = quality;
    res.months = [...new Set(ex.rows.map(r => r.d.slice(0, 7)))].sort();
    res.score = (exact ? 2000 : 0) + pref + h.score * 10 + quality * 50 + Math.min(ex.rows.length, 999) / 1000;
    return res;
  }

  function remap(res, cols, order) {
    const ex = extract(res.sheet.rows, res.hdr, cols, order || res.order, res.name);
    return { ...res, cols, order: order || res.order, rows: ex.rows, stat: ex.stat, ok: ex.rows.length > 0, quality: ex.stat.rows ? ex.rows.length / ex.stat.rows : 0, missing: REQ.filter(k => cols[k] == null), months: [...new Set(ex.rows.map(r => r.d.slice(0, 7)))].sort() };
  }

  const analyze = sheets => sheets.map(analyzeSheet).filter(a => a.name).sort((a, b) => (b.ok - a.ok) || ((b.score || 0) - (a.score || 0)));

  function headersOf(res) {
    const rows = res.sheet.rows;
    const head = res.hdr >= 0 ? rows[res.hdr] || [] : [];
    const width = Math.max(head.length, ...rows.slice(res.hdr + 1, res.hdr + 60).map(r => (r || []).length));
    const L = n => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
    return [...Array(width).keys()].map(i => ({ i, l: L(i) + (head[i] != null && head[i] !== "" ? " · " + String(head[i]).trim().slice(0, 28) : "") }));
  }

  function mergeRows(list) {
    const seen = new Set(), out = [];
    let dup = 0;
    for (const r of list) {
      const k = r.d + "|" + NZ(r.ent) + "|" + NZ(r.g) + "|" + r.people.map(personKey).sort().join(",");
      if (seen.has(k)) { dup++; continue; }
      seen.add(k); out.push(r);
    }
    return { rows: out, dup };
  }

  function purposeCat(g) {
    const z = NZ(g);
    if (/خطه|مرور|دوري/.test(z)) return "plan";
    if (/فحص|شكو|تفتيش|معاينه/.test(z)) return "insp";
    return "other";
  }

  const PURP_PLAN = "plan", PURP_NONE = "none";
  const purposeKey = (g, cat) => cat === "plan" ? PURP_PLAN : (NZ(g) || PURP_NONE);
  const purposeLabel = (k, g) => k === PURP_PLAN ? "خطة المرور" : k === PURP_NONE ? "غير محدد" : String(g || "").replace(/\s+/g, " ").trim();
  const CAT_LABEL = { plan: "خطة المرور", insp: "فحص وشكاوى", other: "أغراض أخرى" };

  function personKey(n) { return NZ(n).replace(/^ال/, "").replace(/\s+/g, " "); }

  function registerPeople(rows) {
    const st = S.settings;
    const known = new Set(Object.keys(st.people).map(personKey));
    let changed = false;
    for (const r of rows) for (const n of r.people) {
      const k = personKey(n);
      if (!known.has(k)) { st.people[k] = { name: n, cls: st.defaultClass }; known.add(k); changed = true; }
    }
    return changed;
  }

  const bigrams = s => { const o = new Map(); const t = " " + s + " "; for (let i = 0; i < t.length - 1; i++) { const b = t.slice(i, i + 2); o.set(b, (o.get(b) || 0) + 1); } return o; };
  function dice(a, b) {
    if (a === b) return 1;
    const A = bigrams(a), B = bigrams(b);
    let inter = 0, na = 0, nb = 0;
    for (const v of A.values()) na += v;
    for (const v of B.values()) nb += v;
    for (const [k, v] of A) if (B.has(k)) inter += Math.min(v, B.get(k));
    return 2 * inter / (na + nb);
  }
  const strip = s => s.replace(/(^|\s)(ال|مستشفي|مستشفى|مركز|معمل|عياده|جمعيه)(?=\S)/g, "$1").replace(/\s+/g, " ").trim();

  let resolver = null;
  function makeResolver() {
    const st = S.settings;
    const all = { ...CITY_FORMS };
    for (const c of Object.keys(st.prices)) if (!all[c]) all[c] = [c];
    const forms = [];
    for (const [c, fs] of Object.entries(all)) for (const f of fs) { const n = NZ(f); forms.push([c, n]); const s = n.replace(/^ال/, ""); if (s !== n && s.length >= 3) forms.push([c, s]); }
    forms.sort((a, b) => b[1].length - a[1].length);
    const info = { ...ENTITY_INFO };
    for (const [k, o] of Object.entries(st.entities || {})) info[k] = { ...(info[k] || {}), ...o };
    const keys = Object.keys(info).sort((a, b) => b.length - a.length);
    const stripped = keys.map(k => [k, strip(k)]);
    const cache = new Map();
    return ent => {
      const k = NZ(ent);
      if (cache.has(k)) return cache.get(k);
      let r;
      const own = st.entities && st.entities[k];
      let hit = info[k], how = hit ? "map" : "";
      if (!hit) {
        const near = keys.find(x => x.length >= 5 && ((" " + k + " ").includes(" " + x + " ") || (k.length >= 5 && (" " + x + " ").includes(" " + k + " "))));
        if (near) { hit = info[near]; how = "near"; }
      }
      if (!hit && k.length >= 4) {
        const sk = strip(k);
        let best = null, bs = 0;
        for (const [x, sx] of stripped) { const d = dice(sk, sx); if (d > bs) { bs = d; best = x; } }
        if (best && bs >= .82) { hit = info[best]; how = "fuzzy"; }
      }
      const type = hit && hit.type ? hit.type : UNTYPED;
      if (own && own.city) r = { city: own.city, type: own.type || type, how: "manual" };
      else if (st.entityCity && st.entityCity[k]) r = { city: st.entityCity[k], type, how: "manual" };
      else if (hit && hit.city) r = { city: hit.city, type, how };
      else {
        const ex = forms.find(([, n]) => n === k);
        if (ex) r = { city: ex[0], type, how: "name" };
        else {
          const g = forms.find(([, n]) => n.length >= 3 && (" " + k + " ").includes(" " + n + " "));
          if (g) r = { city: g[0], type, how: "guess" };
          else {
            let best = null, bs = 0;
            for (const t of k.split(" ")) if (t.length >= 4) for (const [c, n] of forms) { if (n.length < 4) continue; const d = dice(t, n); if (d > bs) { bs = d; best = c; } }
            r = best && bs >= .8 ? { city: best, type, how: "guess" } : { city: null, type, how: "none" };
          }
        }
      }
      cache.set(k, r);
      return r;
    };
  }

  const kmOf = c => c === DAMANHOUR ? 0 : c && S.settings.km[c] != null ? +S.settings.km[c] : null;
  const isFar = c => {
    if (c === DAMANHOUR) return false;
    if (!c) return null;
    if (S.settings.allowMode === "city") { const a = S.settings.allow[c]; return a == null ? null : !!a; }
    const k = kmOf(c);
    return k == null ? null : k >= S.settings.farKm;
  };
  const zeroSet = () => new Set(S.settings.zeroOn ? S.settings.zeroEntities.filter(Boolean).map(NZ) : []);
  let ZS = new Set();
  const zeroHit = ent => ZS.has(NZ(ent));

  const BANDS = ["in", "b1", "b2", "b3", "far", "?"];
  const bandLabel = b => ({ in: "داخل دمنهور", b1: "حتى 25 كم", b2: "25 – 45 كم", b3: "أكثر من 45 كم", far: "مدن بدل السفر", "?": "مسافة غير معروفة" })[b];
  function bandOf(city, km, far) {
    if (city === DAMANHOUR) return "in";
    if (far) return "far";
    if (km == null) return "?";
    return km > 45 ? "b3" : km > 25 ? "b2" : "b1";
  }

  function serviceCount(ek) {
    const st = S.settings;
    if (st.exceptionsOn) {
      const ex = st.exceptions.find(x => x.name && (ek.includes(NZ(x.name)) || (ek.includes(" ") && NZ(x.name).includes(ek))));
      if (ex) return { n: +ex.count || st.serviceDefault, ex: true };
    }
    return { n: st.serviceDefault, ex: false };
  }

  const CLS_NAME = ["", "الأولى", "الثانية", "الثالثة"];
  function lines(v, p) {
    const st = S.settings;
    const kmT = v.km == null || v.city === DAMANHOUR ? "" : v.km + " كم";
    const to = "من دمنهور إلى " + v.ent;
    if (v.zero) return [{ t: to + (v.city === DAMANHOUR ? " (بدمنهور)" : " والعودة"), note: "جهة بدون تكلفة", a: 0, kind: "zero" }];
    if (v.city === DAMANHOUR) {
      if (p.car && !st.carInDamanhour) return [{ t: to + " (بدمنهور)", note: "بسيارة الهيئة", a: 0, kind: "car" }];
      const sc = serviceCount(v.ek);
      return [{ t: to + " (بدمنهور)", note: "سيرفيس " + UI.fm(st.servicePrice) + " × " + sc.n, q: sc.n, a: st.servicePrice == null ? null : st.servicePrice * sc.n, kind: "service", ex: sc.ex }];
    }
    if (p.car) {
      if (v.far === null) return [{ t: to + " والعودة بدل سفر", note: "بسيارة الهيئة · غير معروف الاستحقاق", a: null, kind: "allow" }];
      if (v.far) return [{ t: to + " والعودة بدل سفر", note: "بسيارة الهيئة" + (kmT ? " · " + kmT : ""), a: st.carAllowance[p.cls], kind: "allow" }];
      if (st.carNearInternal) return [{ t: v.ent + " داخلي", note: "بسيارة الهيئة", a: st.classAmount[p.cls], kind: "class" }];
      return [{ t: to + " والعودة", note: "بسيارة الهيئة · لا يستحق بدل سفر", a: 0, kind: "car" }];
    }
    const price = v.city ? st.prices[v.city] : null;
    return [
      { t: to + " والعودة", note: (price == null ? "سعر غير محدد" : UI.fm(price) + " × 2") + (kmT ? " · " + kmT : ""), q: 2, a: price == null ? null : price * 2, kind: "travel" },
      { t: v.ent + " داخلي", note: "الدرجة " + CLS_NAME[p.cls], a: st.classAmount[p.cls], kind: "class" }
    ];
  }

  const M = { visits: [], items: [], meta: null };

  function build(raw) {
    const st = S.settings;
    resolver = makeResolver();
    ZS = zeroSet();
    const pk = {};
    for (const k of Object.keys(st.people)) pk[personKey(k)] = k;
    const map = new Map();
    for (const r of raw) {
      const cat = purposeCat(r.g);
      const ek = NZ(r.ent);
      const key = r.d + "|" + ek + "|" + (cat === "other" ? NZ(r.g) : cat);
      let v = map.get(key);
      if (!v) {
        const rc = resolver(r.ent);
        v = { id: key, d: r.d, m: r.d.slice(0, 7), ent: r.ent, ek, g: r.g, cat, pk: purposeKey(r.g, cat), city: rc.city, type: rc.type, how: rc.how, parts: new Map(), rows: [] };
        map.set(key, v);
      }
      v.rows.push(r.src);
      const cp = r.cp ? new Set(r.cp) : null;
      for (const n of r.people) {
        const k = pk[personKey(n)] || personKey(n);
        const car = r.car || (cp ? cp.has(n) : false);
        const ex = v.parts.get(k);
        if (ex) ex.car = ex.car && car;
        else { const sp = st.people[k] || { name: n, cls: st.defaultClass }; v.parts.set(k, { key: k, name: sp.name, cls: sp.cls, car }); }
      }
    }
    const visits = [...map.values()].sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.ent.localeCompare(b.ent, "ar"));
    const items = [];
    const meta = { months: {}, people: {}, cities: {}, types: {}, ents: {}, bands: {}, purp: {}, unknown: {}, days: {} };
    const inc = (o, k, l) => { const x = o[k] || (o[k] = { n: 0, l: l == null ? k : l }); x.n++; };
    visits.forEach((v, i) => {
      v.i = i;
      v.people = [...v.parts.values()];
      delete v.parts;
      v.carN = v.people.filter(p => p.car).length;
      v.mode = v.carN === 0 ? "nocar" : v.carN === v.people.length ? "car" : "mixed";
      v.km = kmOf(v.city);
      v.far = isFar(v.city);
      v.zero = ZS.has(v.ek);
      v.band = bandOf(v.city, v.km, v.far);
      v.s = NZ(v.ent + " " + (v.city || "") + " " + v.g + " " + v.type + " " + v.people.map(p => p.name).join(" "));
      v.sum = 0; v.miss = 0;
      for (const p of v.people) {
        const ls = lines(v, p);
        let sum = 0, miss = 0;
        const k = { travel: 0, class: 0, service: 0, allow: 0 };
        for (const l of ls) { if (l.a == null) miss++; else { sum += l.a; if (l.kind in k) k[l.kind] += l.a; } }
        items.push({ id: v.id + "|" + p.key, v, p, ls, sum, miss, k });
        v.sum += sum; v.miss += miss;
        inc(meta.people, p.key, p.name);
      }
      meta.days[v.d] = (meta.days[v.d] || 0) + 1;
      inc(meta.months, v.m);
      inc(meta.cities, v.city || "?", v.city || "غير معروفة");
      inc(meta.types, v.type);
      inc(meta.ents, v.ek, v.ent);
      inc(meta.bands, v.band, bandLabel(v.band));
      inc(meta.purp, v.pk, purposeLabel(v.pk, v.g));
      meta.purp[v.pk].cat = v.cat;
      if (!v.city || v.how === "guess" || v.how === "fuzzy") { inc(meta.unknown, v.ek, v.ent); meta.unknown[v.ek].how = v.how; meta.unknown[v.ek].city = v.city; }
    });
    M.visits = visits; M.items = items; M.meta = meta;
    return M;
  }

  function periodTest(f) {
    if (f.from || f.to) { const a = f.from || "0000", z = f.to || "9999"; return v => v.d >= a && v.d <= z; }
    if (f.months && f.months.length) { const s = new Set(f.months); return v => s.has(v.m); }
    return null;
  }

  const KINDS = [["travel", "انتقال"], ["class", "بدل داخلي"], ["service", "سيرفيس"], ["allow", "بدل سفر"], ["zero", "جهة بدون تكلفة"], ["car", "سيارة بلا بدل"]];
  const amtOf = it => it.miss ? "miss" : it.sum > 0 ? "pos" : "zero";

  function filter(f, opt = {}) {
    const tests = [];
    const pt = opt.skipPeriod ? null : periodTest(f);
    if (pt) tests.push(pt);
    const set = a => a && a.length ? new Set(a) : null;
    const purp = set(f.purp), zone = set(f.zone), cities = set(f.cities), types = set(f.types), ents = set(f.ents), bands = set(f.bands);
    if (purp) tests.push(v => purp.has(v.pk));
    if (zone) tests.push(v => zone.has(v.city === DAMANHOUR ? "in" : "out"));
    if (cities) tests.push(v => cities.has(v.city || "?"));
    if (types) tests.push(v => types.has(v.type));
    if (ents) tests.push(v => ents.has(v.ek));
    if (bands) tests.push(v => bands.has(v.band));
    const q = NZ(f.q || "");
    if (q) tests.push(v => v.s.includes(q));
    const people = set(f.people);
    const car = set(f.car);
    const amt = set(f.amt), kinds = set(f.kinds);
    const excl = !opt.keepExcl && S.excl && S.excl.length ? new Set(S.excl) : null;
    const items = [], excluded = [];
    const vm = new Map();
    for (const it of M.items) {
      if (people && !people.has(it.p.key)) continue;
      if (car && !car.has(it.p.car ? "car" : "nocar")) continue;
      if (amt && !amt.has(amtOf(it))) continue;
      if (kinds && !it.ls.some(l => kinds.has(l.kind))) continue;
      const v = it.v;
      let ok = true;
      for (const t of tests) if (!t(v)) { ok = false; break; }
      if (!ok) continue;
      if (excl && excl.has(it.id)) { excluded.push(it); continue; }
      items.push(it);
      let o = vm.get(v);
      if (!o) vm.set(v, o = { sum: 0, miss: 0, keys: new Set() });
      o.sum += it.sum; o.miss += it.miss; o.keys.add(it.p.key);
    }
    const visits = [...vm.keys()];
    const pm = new Map();
    for (const it of items) {
      let o = pm.get(it.p.key);
      if (!o) pm.set(it.p.key, o = { key: it.p.key, name: it.p.name, cls: it.p.cls, items: [], sum: 0, miss: 0, car: 0, nocar: 0, zero: 0, plan: 0, insp: 0, other: 0, km: 0, far: 0, k: { travel: 0, class: 0, service: 0, allow: 0 } });
      o.items.push(it);
      o.sum += it.sum; o.miss += it.miss;
      if (!it.miss && it.sum === 0) o.zero++;
      o[it.p.car ? "car" : "nocar"]++;
      o[it.v.cat]++;
      o.km += (it.v.km || 0) * 2;
      if (it.v.band === "far" && it.p.car) o.far++;
      for (const k in it.k) o.k[k] += it.k[k];
    }
    const persons = [...pm.values()].sort((a, b) => b.sum - a.sum || b.items.length - a.items.length);
    let total = 0, miss = 0;
    for (const it of items) { total += it.sum; miss += it.miss; }
    return { visits, items, persons, total, miss, vm, excluded };
  }

  const FACETS = {
    purp: it => it.v.pk,
    car: it => it.p.car ? "car" : "nocar",
    zone: it => it.v.city === DAMANHOUR ? "in" : "out",
    amt: it => amtOf(it),
    kinds: it => [...new Set(it.ls.map(l => l.kind))],
    people: it => it.p.key,
    types: it => it.v.type,
    cities: it => it.v.city || "?",
    bands: it => it.v.band,
    ents: it => it.v.ek
  };
  const FACET_KEYS = Object.keys(FACETS);

  function facets(f) {
    const pt = periodTest(f);
    const q = NZ(f.q || "");
    const excl = S.excl && S.excl.length ? new Set(S.excl) : null;
    const sel = {};
    for (const k of FACET_KEYS) sel[k] = f[k] && f[k].length ? new Set(f[k]) : null;
    const out = {};
    for (const k of FACET_KEYS) out[k] = new Map();
    const add = (k, vals, v) => { const m = out[k]; for (const x of Array.isArray(vals) ? vals : [vals]) { let s = m.get(x); if (!s) m.set(x, s = new Set()); s.add(v); } };
    for (const it of M.items) {
      const v = it.v;
      if (pt && !pt(v)) continue;
      if (q && !v.s.includes(q)) continue;
      if (excl && excl.has(it.id)) continue;
      const vals = {};
      let miss = null, n = 0;
      for (const k of FACET_KEYS) {
        const x = vals[k] = FACETS[k](it);
        const s = sel[k];
        if (!s) continue;
        const ok = Array.isArray(x) ? x.some(y => s.has(y)) : s.has(x);
        if (!ok) { n++; miss = k; if (n > 1) break; }
      }
      if (n > 1) continue;
      if (n === 1) add(miss, vals[miss], v);
      else for (const k of FACET_KEYS) add(k, vals[k], v);
    }
    const res = {};
    for (const k of FACET_KEYS) { res[k] = {}; for (const [x, s] of out[k]) res[k][x] = s.size; }
    return res;
  }

  function nocarCost(v, p) {
    let s = 0;
    for (const l of lines(v, { ...p, car: false })) { if (l.a == null) return null; s += l.a; }
    return s;
  }

  return { M, KINDS, CAT_LABEL, FACET_KEYS, facets, purposeLabel, amtOf, nocarCost, analyze, remap, rememberCols, headersOf, mergeRows, build, filter, registerPeople, purposeCat, personKey, toDate, dateParts, splitPeople, BANDS, bandLabel, kmOf, isFar, zeroHit, resolve: e => (resolver || (resolver = makeResolver()))(e), SETTING_SHEETS, HEAD_KEYS: ["d", "e", "g", "p", "c"] };
})();
