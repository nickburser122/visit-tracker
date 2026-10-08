const ACT = (() => {
  const { esc, fm, fm2, pct, icons } = UI;
  const SECTIONS = [
    ["overview", "الملخص العام", true, "a"],
    ["car", "السيارة: الزيارات والأنشطة", true, "a"],
    ["purp", "حسب الغرض", true, "a"],
    ["people", "حسب الفرد", true, "a"],
    ["peoplePurp", "الأفراد × الغرض", false, "a"],
    ["types", "حسب نوع الجهة", true, "a"],
    ["cities", "حسب المدينة", true, "a"],
    ["months", "حسب الشهر", true, "a"],
    ["ents", "حسب الجهة", false, "a"],
    ["costSum", "ملخص التكلفة والتوفير", true, "c"],
    ["costPeople", "تكلفة كل فرد", true, "c"],
    ["carRank", "الأكثر استخداماً للسيارة", true, "c"],
    ["costPurp", "التكلفة حسب الغرض", false, "c"],
    ["costMonths", "التكلفة حسب الشهر", false, "c"],
    ["prices", "جدول الأسعار المستخدمة", false, "c"]
  ];
  const SCOPES = [["view", "العرض الحالي"], ["period", "الفترة فقط"], ["all", "كل الفترات"]];
  const KIND_ROWS = [["travel", "انتقال ذهاب وعودة"], ["class", "بدل داخلي"], ["service", "سيرفيس دمنهور"], ["allow", "بدل سفر بالسيارة"]];
  const CLS = ["", "الأولى", "الثانية", "الثالثة"];
  const KEY = "addad3.act";
  const PRICE_TAG = "بالأسعار الحالية";

  function loadOpts() {
    const base = { scope: "view", sections: Object.fromEntries(SECTIONS.map(([k, , on]) => [k, on])), arabic: !!S.settings.org.arabicDigits, title: "تقرير نشاط المرور", v: 2 };
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || "null");
      if (o) {
        const sec = { ...base.sections, ...(o.sections || {}) };
        if (o.v !== 2) { if (o.cost === false) ["costSum", "costPeople", "carRank"].forEach(k => sec[k] = false); if (o.prices) sec.prices = true; }
        return { ...base, scope: o.scope || base.scope, arabic: o.arabic ?? base.arabic, title: o.title || base.title, sections: sec };
      }
    } catch (e) {}
    return base;
  }
  const saveOpts = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };

  function resultFor(scope) {
    if (scope === "view") return currentResult();
    const f = BLANK_FILTERS();
    if (scope === "period") { f.months = [...S.filters.months]; f.from = S.filters.from; f.to = S.filters.to; }
    return ENG.filter(f);
  }
  function periodOf(scope, R) {
    if (scope !== "all" && (S.filters.from || S.filters.to || S.filters.months.length)) return IO.periodLabel();
    const ds = R.visits.map(v => v.d).sort();
    return ds.length ? "من " + UI.dlabel(ds[0]) + " إلى " + UI.dlabel(ds[ds.length - 1]) : "";
  }
  const scopeText = scope => scope === "view" ? IO.scopeLabel(true) : "";
  const scopeName = (o, scope) => o.scope === "all" ? "كل البيانات المحمّلة" : o.scope === "period" ? "كل الزيارات في الفترة" : scope || "كل الزيارات في الفترة";

  function compute(R) {
    const VM = R.vm;
    const mode = G => { const o = VM.get(G); return o.car === 0 ? "nocar" : o.car === o.n ? "car" : "mixed"; };
    const kind = { travel: 0, class: 0, service: 0, allow: 0 };
    const T = { visits: R.visits.length, acts: R.items.length, days: new Set(R.visits.map(v => v.d)).size, people: R.persons.length, ents: new Set(R.items.map(it => it.v.ek)).size, cities: new Set(R.items.map(it => it.v.city || "?")).size, car: 0, nocar: 0, mixed: 0, carA: 0, nocarA: 0, inV: 0, outV: 0, multi: 0, sum: R.total, miss: R.miss, kind, carSum: 0, nocarSum: 0, alt: 0, save: 0, altMiss: 0 };
    for (const G of R.visits) { T[mode(G)]++; const o = VM.get(G); [...o.legs].every(v => v.city === DAMANHOUR) ? T.inV++ : T.outV++; if (o.legs.size > 1) T.multi++; }
    for (const it of R.items) {
      for (const k in it.k) kind[k] += it.k[k];
      if (it.p.car) { T.carA++; T.carSum += it.sum; if (it.alt == null) T.altMiss++; else { T.alt += it.alt; T.save += it.save; } }
      else { T.nocarA++; T.nocarSum += it.sum; }
    }

    function group(keyFn, labelFn) {
      const m = new Map();
      for (const it of R.items) {
        const k = keyFn(it);
        let g = m.get(k);
        if (!g) m.set(k, g = { k, l: labelFn(k, it), vs: new Set(), carV: new Set(), a: 0, car: 0, nocar: 0, sum: 0, miss: 0, save: 0 });
        g.vs.add(it.v.V); g.a++; g.sum += it.sum; g.miss += it.miss;
        if (it.p.car) { g.car++; g.save += it.save; } else g.nocar++;
      }
      return [...m.values()].map(g => ({ ...g, v: g.vs.size }));
    }
    const pm = ENG.M.meta.purp, catRank = { plan: 0, insp: 1, other: 2 };
    const purp = group(it => it.v.V.pk, (k, it) => (pm[k] || { l: ENG.purposeLabel(k, it.v.g) }).l).map(g => ({ ...g, cat: (pm[g.k] || {}).cat || "other" })).sort((a, b) => catRank[a.cat] - catRank[b.cat] || b.v - a.v);
    const types = group(it => it.v.type, k => k).sort((a, b) => b.a - a.a);
    const cities = group(it => it.v.city || "?", k => k === "?" ? "غير معروفة" : k).sort((a, b) => b.a - a.a);
    const months = group(it => it.v.m, k => UI.mlabel(k)).sort((a, b) => a.k < b.k ? -1 : 1);
    const ents = group(it => it.v.ek, (k, it) => it.v.ent).sort((a, b) => b.a - a.a);
    const people = R.persons.map(p => ({ k: p.key, l: p.name, cls: p.cls, v: p.visits, a: p.items.length, car: p.car, nocar: p.nocar, plan: p.plan, insp: p.insp, other: p.other, sum: p.sum, miss: p.miss, carSum: p.carSum, nocarSum: p.sum - p.carSum, alt: p.alt, save: p.save, altMiss: p.altMiss, k4: p.k, items: p.items })).sort((a, b) => b.v - a.v || b.a - a.a);
    const pcols = purp.slice(0, purp.length > 8 ? 7 : 8);
    const prestN = purp.length - pcols.length;
    const keep = new Set(pcols.map(x => x.k));
    const ppMatrix = people.map(p => { const c = {}; let rest = 0; for (const it of p.items) { const k = it.v.V.pk; if (keep.has(k)) c[k] = (c[k] || 0) + 1; else rest++; } return { ...p, c, rest }; });
    return { tot: T, purp, types, cities, months, ents, people, pcols, prestN, ppMatrix };
  }

  const bar = (n, max, cls) => '<span class="a-bar' + (cls ? " " + cls : "") + '"><i style="width:' + (max ? Math.max(2, Math.round(Math.abs(n) / max * 100)) : 0) + '%"></i></span>';
  const num = n => n ? fm(n) : '<span class="a-z">—</span>';
  const money = n => n ? fm2(n) : '<span class="a-z">—</span>';
  const signed = n => !n ? '<span class="a-z">—</span>' : (n < 0 ? '<span class="a-neg">−' + fm2(-n) + "</span>" : fm2(n));

  function blocks(R, C, o, st) {
    const B = [], T = C.tot, X = o.sections;
    const grpTable = (title, sub, rows, firstCol) => {
      const max = Math.max(1, ...rows.map(r => r.a));
      B.push({ t: "table", title, sub,
        head: '<tr><th class="c-n">م</th><th>' + firstCol + '</th><th class="c-r">الزيارات</th><th class="c-r">الأنشطة</th><th class="a-bc"></th><th class="c-r">نشاط بالسيارة</th><th class="c-r">نشاط بدون سيارة</th><th class="c-r">النسبة</th></tr>',
        rows: rows.map((r, i) => '<tr><td class="c-n">' + (i + 1) + "</td><td>" + esc(r.l) + '</td><td class="c-r"><b>' + r.v + '</b></td><td class="c-r">' + r.a + "</td><td>" + bar(r.a, max) + '</td><td class="c-r">' + num(r.car) + '</td><td class="c-r">' + num(r.nocar) + '</td><td class="c-r">' + pct(r.a, T.acts) + "%</td></tr>"),
        foot: '<tr><td></td><td>الإجمالي</td><td class="c-r">' + T.visits + '</td><td class="c-r">' + T.acts + '</td><td></td><td class="c-r">' + T.carA + '</td><td class="c-r">' + T.nocarA + '</td><td class="c-r">100%</td></tr>' });
    };
    B.push({ t: "html", html: '<section class="a-sec a-defs"><div><b>الزيارة</b><span>خطة المرور لنفس الفريق في نفس اليوم تُعد زيارة واحدة حتى لو شملت أكثر من جهة أو صف. أي غرض آخر: كل صف زيارة مستقلة.</span></div><div><b>النشاط الفردي</b><span>مشاركة فرد واحد في صف واحد. كل صف لكل فرد نشاط، وعليه يُحسب استخدام السيارة والمبلغ.</span></div></section>' });
    if (X.overview) {
      B.push({ t: "html", html: '<section class="a-sec"><h3>الملخص العام</h3><div class="a-kpis">' +
        [["الزيارات", T.visits, T.multi ? T.multi + " منها متعددة الجهات" : ""], ["الأنشطة الفردية", T.acts, "فرد × صف"], ["أيام العمل", T.days, ""], ["الأفراد", T.people, ""], ["الجهات", T.ents, ""], ["المدن", T.cities, ""]].map(([l, v, s]) => "<div><span>" + l + "</span><b>" + v + "</b>" + (s ? "<small>" + s + "</small>" : "") + "</div>").join("") +
        '</div><div class="a-split"><div><span>زيارات داخل دمنهور</span><b>' + T.inV + "</b><small>" + pct(T.inV, T.visits) + '%</small></div><div><span>زيارات خارج دمنهور</span><b>' + T.outV + "</b><small>" + pct(T.outV, T.visits) + "%</small></div><div><span>متوسط الأنشطة لكل زيارة</span><b>" + (T.visits ? (T.acts / T.visits).toFixed(1) : "0") + "</b></div><div><span>متوسط الزيارات لكل يوم</span><b>" + (T.days ? (T.visits / T.days).toFixed(1) : "0") + "</b></div></div></section>" });
    }
    if (X.car) {
      const row = (l, n, of) => "<div><span>" + l + "</span><b>" + n + "</b><small>" + pct(n, of) + "%</small>" + '<i style="--w:' + pct(n, of) + '%"></i></div>';
      B.push({ t: "html", html: '<section class="a-sec"><h3>السيارة: الزيارات والأنشطة</h3><div class="a-car"><div class="a-car-g"><h4>الأنشطة الفردية</h4><div class="a-car-r">' + row("بسيارة الهيئة", T.carA, T.acts) + row("بدون سيارة", T.nocarA, T.acts) + '</div></div><div class="a-car-g"><h4>الزيارات</h4><div class="a-car-r">' + row("كل الفريق بالسيارة", T.car, T.visits) + row("كل الفريق بدون سيارة", T.nocar, T.visits) + (T.mixed ? row("مختلطة", T.mixed, T.visits) : "") + "</div></div></div>" + (T.mixed ? '<p class="a-fn">«مختلطة»: زيارة ذهب فيها بعض الفريق أو بعض الصفوف بسيارة الهيئة والباقي بدونها. الاستخدام الفعلي يُتابَع على مستوى النشاط الفردي.</p>' : "") + "</section>" });
    }
    if (X.purp) grpTable("حسب الغرض", C.purp.length + " غرض · كل غرض باسمه كما ورد في الملف", C.purp, "الغرض");
    if (X.people) {
      const max = Math.max(1, ...C.people.map(r => r.a));
      B.push({ t: "table", title: "حسب الفرد", sub: C.people.length + " فرد · الزيارات بعد الدمج، والأنشطة بعدد الصفوف",
        head: '<tr><th class="c-n">م</th><th>الاسم</th><th>الدرجة</th><th class="c-r">الزيارات</th><th class="c-r">الأنشطة</th><th class="a-bc"></th><th class="c-r">بالسيارة</th><th class="c-r">بدونها</th><th class="c-r">خطة</th><th class="c-r">فحص</th><th class="c-r">أخرى</th></tr>',
        rows: C.people.map((r, i) => '<tr><td class="c-n">' + (i + 1) + "</td><td><b>" + esc(r.l) + "</b></td><td>" + CLS[r.cls] + '</td><td class="c-r"><b>' + r.v + '</b></td><td class="c-r">' + r.a + "</td><td>" + bar(r.a, max) + '</td><td class="c-r">' + num(r.car) + '</td><td class="c-r">' + num(r.nocar) + '</td><td class="c-r">' + num(r.plan) + '</td><td class="c-r">' + num(r.insp) + '</td><td class="c-r">' + num(r.other) + "</td></tr>"),
        foot: '<tr><td></td><td colspan="3">الإجمالي</td><td class="c-r">' + T.acts + '</td><td></td><td class="c-r">' + T.carA + '</td><td class="c-r">' + T.nocarA + '</td><td colspan="3" class="c-r a-fn2">خطة/فحص/أخرى بعدد الزيارات</td></tr>' });
    }
    if (X.peoplePurp && C.pcols.length) {
      B.push({ t: "table", title: "الأفراد × الغرض", sub: "عدد الأنشطة الفردية لكل فرد في كل غرض" + (C.prestN ? " · «باقي الأغراض» تضم " + C.prestN + " غرض أقل تكراراً" : ""),
        head: "<tr><th>الاسم</th>" + C.pcols.map(c => '<th class="c-r a-vh">' + esc(c.l) + "</th>").join("") + (C.prestN ? '<th class="c-r a-vh">باقي الأغراض</th>' : "") + '<th class="c-r">الإجمالي</th></tr>',
        rows: C.ppMatrix.map(p => "<tr><td><b>" + esc(p.l) + "</b></td>" + C.pcols.map(c => '<td class="c-r">' + num(p.c[c.k] || 0) + "</td>").join("") + (C.prestN ? '<td class="c-r">' + num(p.rest) + "</td>" : "") + '<td class="c-r"><b>' + p.a + "</b></td></tr>"),
        foot: "<tr><td>الإجمالي</td>" + C.pcols.map(c => '<td class="c-r">' + C.ppMatrix.reduce((s, p) => s + (p.c[c.k] || 0), 0) + "</td>").join("") + (C.prestN ? '<td class="c-r">' + C.ppMatrix.reduce((s, p) => s + p.rest, 0) + "</td>" : "") + '<td class="c-r">' + T.acts + "</td></tr>" });
    }
    if (X.types) grpTable("حسب نوع الجهة", C.types.length + " نوع · زيارة خطة متعددة الجهات تُحسب ضمن كل نوع زارته", C.types, "نوع الجهة");
    if (X.cities) grpTable("حسب المدينة", C.cities.length + " مدينة · زيارة خطة متعددة المدن تُحسب ضمن كل مدينة زارتها", C.cities, "المدينة");
    if (X.months) grpTable("حسب الشهر", C.months.length + " شهر", C.months, "الشهر");
    if (X.ents) grpTable("حسب الجهة", C.ents.length + " جهة", C.ents, "الجهة");

    const anyCost = X.costSum || X.costPeople || X.carRank || X.costPurp || X.costMonths;
    if (anyCost) {
      B.push({ t: "html", html: '<section class="a-sec a-cost a-cost-hd"><h3>التكلفة · ملاحظة للشفافية</h3><p class="a-fn">كل المبالغ التالية محسوبة آلياً <b>بالأسعار والبدلات المسجّلة يوم إصدار التقرير (' + UI.dlabel(UI.today()) + ")</b> وليست أسعار يوم الزيارة. الأسعار تتغير، لذا تُعرض للشفافية فقط ولا تُعد مستند صرف؛ الكشوف الفردية هي المرجع. <b>التوفير</b> = ما كان سيُصرف لو تمت أنشطة السيارة بدونها (انتقال ذهاب وعودة + بدل داخلي) ناقص ما يُصرف فعلاً بالسيارة.</p></section>" });
    }
    if (X.costSum) {
      const noCarTotal = T.sum + T.save;
      B.push({ t: "html", html: '<section class="a-sec a-cost"><h3>ملخص التكلفة والتوفير <small>(' + PRICE_TAG + ')</small></h3><div class="a-cost-in"><div class="a-cost-tot"><span>إجمالي التكلفة التقديرية</span><b>' + fm2(T.sum) + " <small>جنيه</small></b>" + (T.miss ? "<em>+ " + T.miss + " بند بلا سعر لم يُحتسب</em>" : "") + '</div><div class="a-cost-k">' + KIND_ROWS.map(([k, l]) => "<div><span>" + l + "</span><b>" + fm2(T.kind[k]) + "</b><small>" + pct(T.kind[k], T.sum) + "%</small></div>").join("") + "</div></div>" +
        '<div class="a-save"><div><span>تكلفة أنشطة السيارة (' + T.carA + ")</span><b>" + fm2(T.carSum) + "</b></div><div><span>تكلفة الأنشطة بدون سيارة (" + T.nocarA + ")</span><b>" + fm2(T.nocarSum) + "</b></div><div><span>لو تمت كلها بدون سيارة</span><b>" + fm2(noCarTotal) + '</b></div><div class="hl"><span>وفّرته سيارة الهيئة</span><b>' + signed(T.save) + "</b><small>" + pct(T.save, noCarTotal) + "% من التكلفة البديلة</small></div></div>" +
        (T.altMiss ? '<p class="a-fn">' + T.altMiss + " نشاط بالسيارة لم يُحسب له توفير لعدم وجود سعر للمدينة.</p>" : "") +
        '<p class="a-fn">أساس الحساب: سيرفيس دمنهور ' + fm(st.servicePrice) + " جنيه للمرة · بدل داخلي " + [1, 2, 3].map(c => CLS[c] + " " + fm(st.classAmount[c])).join("، ") + " · بدل سفر بالسيارة " + [1, 2, 3].map(c => CLS[c] + " " + fm(st.carAllowance[c])).join("، ") + ".</p></section>" });
    }
    if (X.costPeople) {
      const ps = [...C.people].sort((a, b) => b.sum - a.sum);
      B.push({ t: "table", title: "تكلفة كل فرد", sub: PRICE_TAG + " · مرتبة من الأعلى تكلفة", cls: "a-cost-t",
        head: '<tr><th class="c-n">م</th><th>الاسم</th><th class="c-r">الأنشطة</th><th class="c-r">انتقال</th><th class="c-r">داخلي</th><th class="c-r">سيرفيس</th><th class="c-r">بدل سفر</th><th class="c-r">الإجمالي</th><th class="c-r">النسبة</th><th class="c-r">متوسط النشاط</th></tr>',
        rows: ps.map((p, i) => '<tr><td class="c-n">' + (i + 1) + "</td><td><b>" + esc(p.l) + '</b></td><td class="c-r">' + p.a + '</td><td class="c-r">' + money(p.k4.travel) + '</td><td class="c-r">' + money(p.k4.class) + '</td><td class="c-r">' + money(p.k4.service) + '</td><td class="c-r">' + money(p.k4.allow) + '</td><td class="c-r"><b>' + fm2(p.sum) + "</b>" + (p.miss ? '<small class="r-nil">+' + p.miss + " بلا سعر</small>" : "") + '</td><td class="c-r">' + pct(p.sum, T.sum) + '%</td><td class="c-r">' + fm2(p.a ? p.sum / p.a : 0) + "</td></tr>"),
        foot: '<tr><td></td><td>الإجمالي</td><td class="c-r">' + T.acts + '</td><td class="c-r">' + fm2(T.kind.travel) + '</td><td class="c-r">' + fm2(T.kind.class) + '</td><td class="c-r">' + fm2(T.kind.service) + '</td><td class="c-r">' + fm2(T.kind.allow) + '</td><td class="c-r">' + fm2(T.sum) + '</td><td class="c-r">100%</td><td class="c-r">' + fm2(T.acts ? T.sum / T.acts : 0) + "</td></tr>" });
    }
    if (X.carRank) {
      const ps = [...C.people].sort((a, b) => b.car - a.car || b.save - a.save);
      const max = Math.max(1, ...ps.map(p => p.car));
      B.push({ t: "table", title: "الأكثر استخداماً للسيارة", sub: PRICE_TAG + " · التوفير = تكلفته البديلة بدون سيارة − تكلفته الفعلية بالسيارة", cls: "a-cost-t",
        head: '<tr><th class="c-n">م</th><th>الاسم</th><th class="c-r">أنشطة بالسيارة</th><th class="a-bc"></th><th class="c-r">من أنشطته</th><th class="c-r">تكلفته بالسيارة</th><th class="c-r">لو بدون سيارة</th><th class="c-r">التوفير</th><th class="c-r">لكل نشاط</th></tr>',
        rows: ps.map((p, i) => '<tr><td class="c-n">' + (i + 1) + "</td><td><b>" + esc(p.l) + '</b></td><td class="c-r"><b>' + num(p.car) + "</b></td><td>" + bar(p.car, max, "sage") + '</td><td class="c-r">' + pct(p.car, p.a) + '%</td><td class="c-r">' + money(p.carSum) + '</td><td class="c-r">' + money(p.alt) + "</td>" + '<td class="c-r"><b>' + signed(p.save) + "</b>" + (p.altMiss ? '<small class="r-nil">' + p.altMiss + " بلا سعر</small>" : "") + '</td><td class="c-r">' + (p.car ? signed(p.save / (p.car - p.altMiss || 1)) : '<span class="a-z">—</span>') + "</td></tr>"),
        foot: '<tr><td></td><td>الإجمالي</td><td class="c-r">' + T.carA + '</td><td></td><td class="c-r">' + pct(T.carA, T.acts) + '%</td><td class="c-r">' + fm2(T.carSum) + '</td><td class="c-r">' + fm2(T.alt) + '</td><td class="c-r">' + signed(T.save) + '</td><td class="c-r">' + (T.carA ? signed(T.save / (T.carA - T.altMiss || 1)) : "—") + "</td></tr>" });
    }
    const costGrp = (title, rows, firstCol) => {
      const max = Math.max(1, ...rows.map(r => r.sum));
      B.push({ t: "table", title, sub: PRICE_TAG, cls: "a-cost-t",
        head: '<tr><th class="c-n">م</th><th>' + firstCol + '</th><th class="c-r">الزيارات</th><th class="c-r">الأنشطة</th><th class="c-r">التكلفة</th><th class="a-bc"></th><th class="c-r">النسبة</th><th class="c-r">متوسط الزيارة</th><th class="c-r">توفير السيارة</th></tr>',
        rows: rows.map((r, i) => '<tr><td class="c-n">' + (i + 1) + "</td><td>" + esc(r.l) + '</td><td class="c-r">' + r.v + '</td><td class="c-r">' + r.a + '</td><td class="c-r"><b>' + fm2(r.sum) + "</b></td><td>" + bar(r.sum, max, "clay") + '</td><td class="c-r">' + pct(r.sum, T.sum) + '%</td><td class="c-r">' + fm2(r.v ? r.sum / r.v : 0) + '</td><td class="c-r">' + signed(r.save) + "</td></tr>"),
        foot: '<tr><td></td><td>الإجمالي</td><td class="c-r">' + T.visits + '</td><td class="c-r">' + T.acts + '</td><td class="c-r">' + fm2(T.sum) + '</td><td></td><td class="c-r">100%</td><td class="c-r">' + fm2(T.visits ? T.sum / T.visits : 0) + '</td><td class="c-r">' + signed(T.save) + "</td></tr>" });
    };
    if (X.costPurp) costGrp("التكلفة حسب الغرض", C.purp, "الغرض");
    if (X.costMonths) costGrp("التكلفة حسب الشهر", C.months, "الشهر");
    if (X.prices) {
      const used = [...new Set(R.items.map(it => it.v.city).filter(c => c && c !== DAMANHOUR))].sort((a, b) => (st.prices[b] ?? -1) - (st.prices[a] ?? -1));
      B.push({ t: "table", title: "الأسعار المستخدمة في الحساب", sub: "سعر الاتجاه الواحد للمدن الواردة في هذا التقرير · " + PRICE_TAG,
        head: '<tr><th class="c-n">م</th><th>المدينة</th><th class="c-r">السعر (اتجاه)</th><th class="c-r">ذهاب وعودة</th><th class="c-r">المسافة كم</th><th>بدل سفر بالسيارة</th></tr>',
        rows: used.map((c, i) => '<tr><td class="c-n">' + (i + 1) + "</td><td>" + esc(c) + '</td><td class="c-r">' + (st.prices[c] == null ? "غير محدد" : fm2(st.prices[c])) + '</td><td class="c-r">' + (st.prices[c] == null ? "—" : fm2(st.prices[c] * 2)) + '</td><td class="c-r">' + (st.km[c] == null ? "—" : fm(st.km[c])) + "</td><td>" + (ENG.isFar(c) ? "يستحق" : "لا") + "</td></tr>"), foot: "" });
    }
    return B;
  }

  function measureHost() {
    let h = document.getElementById("act-measure");
    if (!h) { h = document.createElement("div"); h.id = "act-measure"; document.body.appendChild(h); }
    return h;
  }

  function paginate(B, head, st) {
    const host = measureHost();
    host.innerHTML = "";
    const pages = [];
    let page, body;
    const newPage = () => {
      page = document.createElement("section");
      page.className = "r-page a-page";
      page.innerHTML = head(pages.length > 0) + '<div class="r-body"></div>' + REPORT.footer(st, 1, 1);
      host.appendChild(page);
      body = page.querySelector(".r-body");
      pages.push(page);
    };
    const over = () => body.scrollHeight > body.clientHeight + 1;
    newPage();
    for (const b of B) {
      if (b.t === "html") {
        const w = document.createElement("div");
        w.innerHTML = b.html;
        const el = w.firstChild;
        body.appendChild(el);
        if (over() && body.children.length > 1) { el.remove(); newPage(); body.appendChild(el); }
        continue;
      }
      let i = 0, cont = false;
      while (i < b.rows.length || (!b.rows.length && !cont)) {
        const sec = document.createElement("section");
        sec.className = "a-sec" + (b.cls ? " " + b.cls : "");
        sec.innerHTML = "<h3>" + esc(b.title) + (cont ? " <small>(تابع)</small>" : "") + "</h3>" + (b.sub && !cont ? '<p class="a-sub">' + esc(b.sub) + "</p>" : "") + '<table class="r-tbl a-tbl"><thead>' + b.head + "</thead><tbody></tbody>" + (b.foot ? "<tfoot>" + b.foot + "</tfoot>" : "") + "</table>";
        body.appendChild(sec);
        const tb = sec.querySelector("tbody"), tf = sec.querySelector("tfoot");
        if (tf) tf.style.display = "none";
        let added = 0;
        while (i < b.rows.length) {
          tb.insertAdjacentHTML("beforeend", b.rows[i]);
          if (over()) { tb.lastElementChild.remove(); break; }
          i++; added++;
        }
        if (!cont && i < b.rows.length && b.rows.length <= 14 && body.children.length > 1) { sec.remove(); i = 0; newPage(); continue; }
        if (!added && b.rows.length) {
          if (body.children.length > 1) { sec.remove(); newPage(); continue; }
          tb.insertAdjacentHTML("beforeend", b.rows[i]); i++;
        }
        if (i >= b.rows.length) {
          if (tf) { tf.style.display = ""; if (over() && added > 1) { tf.style.display = "none"; tb.lastElementChild.remove(); i--; } else break; }
          else break;
        }
        cont = true;
        newPage();
      }
    }
    const tot = pages.length;
    const html = pages.map((p, n) => { p.querySelector(".r-foot").outerHTML = REPORT.footer(st, n + 1, tot); return p.outerHTML; }).join("");
    host.innerHTML = "";
    return { html, pages: tot };
  }

  async function build(o) {
    const st = S.settings;
    const R = resultFor(o.scope);
    const C = compute(R);
    const period = periodOf(o.scope, R);
    const scope = scopeText(o.scope);
    const ref = "ACT-" + UI.today().replace(/-/g, "").slice(2) + "-" + (R.visits.length + R.items.length * 7).toString(36).toUpperCase();
    const scopeBox = '<div class="a-scope"><div><span>الفترة</span><b>' + esc(period) + "</b></div><div><span>نطاق التقرير</span><b>" + esc(scopeName(o, scope)) + "</b></div>" + (S.excl.length && R.excluded.length ? "<div><span>مستبعد</span><b>" + R.excluded.length + " نشاط</b></div>" : "") + "</div>";
    const head = cont => REPORT.header(st, o.title || "تقرير نشاط المرور", period + (cont ? " · تابع" : ""), ref);
    const B = blocks(R, C, o, st);
    B.unshift({ t: "html", html: scopeBox });
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const out = paginate(B, head, st);
    return { ...out, R, C, period, scope, ref };
  }

  function fixRefs(host, arabic) {
    host.querySelectorAll(".r-meta b").forEach(b => { if (/^(ADD|ACT)-/.test(b.textContent)) b.classList.add("r-ref-latin"); });
    if (arabic) REPORT.arabicDigits(host);
  }

  async function print(o) {
    const out = await build(o);
    let host = document.getElementById("report");
    if (!host) { host = document.createElement("div"); host.id = "report"; document.body.appendChild(host); }
    host.innerHTML = out.html;
    fixRefs(host, o.arabic);
    document.body.classList.add("printing");
    const prevTitle = document.title;
    document.title = (o.title || "تقرير نشاط المرور") + " - " + (o.scope === "all" ? "all" : IO.periodName());
    const done = () => { document.body.classList.remove("printing"); host.innerHTML = ""; document.title = prevTitle; removeEventListener("afterprint", done); };
    addEventListener("afterprint", done);
    await Promise.all([...host.querySelectorAll("img")].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    setTimeout(() => window.print(), 60);
  }

  function excel(o) {
    const st = S.settings, X = o.sections;
    const R = resultFor(o.scope);
    const C = compute(R), T = C.tot;
    const period = periodOf(o.scope, R), scope = scopeText(o.scope);
    const sheets = [];
    const r2 = n => Math.round(n * 100) / 100;
    const sum = [["البند", "القيمة"], ["التقرير", o.title || "تقرير نشاط المرور"], ["الفترة", period], ["النطاق", scopeName(o, scope)], ["تاريخ الإصدار", UI.today()], [],
      ["تعريف الزيارة", "خطة المرور لنفس الفريق في نفس اليوم = زيارة واحدة · أي غرض آخر: كل صف زيارة"], ["تعريف النشاط الفردي", "مشاركة فرد واحد في صف واحد"], [],
      ["الزيارات", T.visits], ["منها متعددة الجهات", T.multi], ["الأنشطة الفردية", T.acts], ["أيام العمل", T.days], ["الأفراد", T.people], ["الجهات", T.ents], ["المدن", T.cities], ["زيارات داخل دمنهور", T.inV], ["زيارات خارج دمنهور", T.outV], [],
      ["أنشطة بسيارة الهيئة", T.carA], ["أنشطة بدون سيارة", T.nocarA], ["زيارات كل الفريق بالسيارة", T.car], ["زيارات كل الفريق بدون سيارة", T.nocar], ["زيارات مختلطة", T.mixed]];
    if (X.costSum) sum.push([], ["ملاحظة التكلفة", "تقديرية بالأسعار الحالية في " + UI.today() + " · للشفافية فقط وليست مستند صرف"], ["إجمالي التكلفة التقديرية", r2(T.sum)], ...KIND_ROWS.map(([k, l]) => [l, r2(T.kind[k])]), ["بنود بلا سعر", T.miss], ["تكلفة أنشطة السيارة", r2(T.carSum)], ["تكلفة الأنشطة بدون سيارة", r2(T.nocarSum)], ["لو تمت كلها بدون سيارة", r2(T.sum + T.save)], ["وفّرته سيارة الهيئة", r2(T.save)]);
    sheets.push({ name: "الملخص", cols: [30, 70], rows: sum });
    const g = (k, name, rows, first) => { if (!X[k]) return; sheets.push({ name, cols: [30, 10, 10, 14, 14, 10], total: true, rows: [[first, "الزيارات", "الأنشطة", "نشاط بالسيارة", "نشاط بدون سيارة", "النسبة %"], ...rows.map(r => [r.l, r.v, r.a, r.car, r.nocar, pct(r.a, T.acts)]), ["الإجمالي", T.visits, T.acts, T.carA, T.nocarA, 100]] }); };
    g("purp", "حسب الغرض", C.purp, "الغرض");
    if (X.people) sheets.push({ name: "حسب الفرد", cols: [18, 10, 10, 10, 10, 10, 10, 10, 10], total: true, rows: [["الاسم", "الدرجة", "الزيارات", "الأنشطة", "بالسيارة", "بدون سيارة", "خطة (زيارات)", "فحص (زيارات)", "أخرى (زيارات)"], ...C.people.map(p => [p.l, CLS[p.cls], p.v, p.a, p.car, p.nocar, p.plan, p.insp, p.other]), ["الإجمالي", "", "", T.acts, T.carA, T.nocarA, "", "", ""]] });
    if (X.peoplePurp) {
      const all = C.purp;
      sheets.push({ name: "الأفراد × الغرض", cols: [18, ...all.map(() => 14), 10], total: true, rows: [["الاسم", ...all.map(c => c.l), "الإجمالي"], ...C.people.map(p => { const c = {}; for (const it of p.items) c[it.v.V.pk] = (c[it.v.V.pk] || 0) + 1; return [p.l, ...all.map(x => c[x.k] || 0), p.a]; }), ["الإجمالي", ...all.map(x => x.a), T.acts]] });
    }
    g("types", "حسب نوع الجهة", C.types, "نوع الجهة");
    g("cities", "حسب المدينة", C.cities, "المدينة");
    g("months", "حسب الشهر", C.months, "الشهر");
    g("ents", "حسب الجهة", C.ents, "الجهة");
    if (X.costPeople) sheets.push({ name: "تكلفة كل فرد", cols: [18, 10, 12, 12, 12, 12, 14, 10, 12], total: true, rows: [["الاسم", "الأنشطة", "انتقال", "داخلي", "سيرفيس", "بدل سفر", "الإجمالي", "النسبة %", "متوسط النشاط"], ...[...C.people].sort((a, b) => b.sum - a.sum).map(p => [p.l, p.a, r2(p.k4.travel), r2(p.k4.class), r2(p.k4.service), r2(p.k4.allow), r2(p.sum), pct(p.sum, T.sum), r2(p.a ? p.sum / p.a : 0)]), ["الإجمالي", T.acts, r2(T.kind.travel), r2(T.kind.class), r2(T.kind.service), r2(T.kind.allow), r2(T.sum), 100, r2(T.acts ? T.sum / T.acts : 0)]] });
    if (X.carRank) sheets.push({ name: "استخدام السيارة", cols: [18, 14, 12, 16, 16, 14], total: true, rows: [["الاسم", "أنشطة بالسيارة", "من أنشطته %", "تكلفته بالسيارة", "لو بدون سيارة", "التوفير"], ...[...C.people].sort((a, b) => b.car - a.car || b.save - a.save).map(p => [p.l, p.car, pct(p.car, p.a), r2(p.carSum), r2(p.alt), r2(p.save)]), ["الإجمالي", T.carA, pct(T.carA, T.acts), r2(T.carSum), r2(T.alt), r2(T.save)]] });
    const cg = (k, name, rows, first) => { if (!X[k]) return; sheets.push({ name, cols: [28, 10, 10, 14, 10, 14, 14], total: true, rows: [[first, "الزيارات", "الأنشطة", "التكلفة", "النسبة %", "متوسط الزيارة", "توفير السيارة"], ...rows.map(r => [r.l, r.v, r.a, r2(r.sum), pct(r.sum, T.sum), r2(r.v ? r.sum / r.v : 0), r2(r.save)]), ["الإجمالي", T.visits, T.acts, r2(T.sum), 100, r2(T.visits ? T.sum / T.visits : 0), r2(T.save)]] }); };
    cg("costPurp", "التكلفة حسب الغرض", C.purp, "الغرض");
    cg("costMonths", "التكلفة حسب الشهر", C.months, "الشهر");
    if (X.prices) {
      const used = [...new Set(R.items.map(it => it.v.city).filter(c => c && c !== DAMANHOUR))];
      sheets.push({ name: "الأسعار المستخدمة", cols: [26, 14, 12, 10], rows: [["المدينة", "السعر (اتجاه)", "المسافة كم", "بدل سفر"], ...used.map(c => [c, st.prices[c], st.km[c], !!ENG.isFar(c)]), [], ["سيرفيس دمنهور", st.servicePrice], ...[1, 2, 3].map(c => ["بدل داخلي · " + CLS[c], st.classAmount[c]]), ...[1, 2, 3].map(c => ["بدل سفر بالسيارة · " + CLS[c], st.carAllowance[c]])] });
    }
    UI.download("addad-activity_" + (o.scope === "all" ? "all" : IO.periodName()) + ".xlsx", XL.write(sheets));
    UI.toast("✓ Excel");
  }

  function dialog() {
    if (!ENG.M.visits.length) return;
    const o = loadOpts();
    const secList = grp => SECTIONS.filter(s => s[3] === grp).map(([k, l]) => '<label class="toggle"><input type="checkbox" data-sec="' + k + '"><span class="sw"></span>' + l + "</label>").join("");
    const side = '<aside class="rp-side">' +
      '<div class="rp-sec"><h4>النطاق</h4><div class="seg a-scopes" id="ac-scope">' + SCOPES.map(([k, l]) => '<button type="button" data-sc="' + k + '">' + l + "</button>").join("") + '</div><p class="note sm" id="ac-scope-d"></p></div>' +
      '<div class="rp-sec"><h4>النشاط <button type="button" class="lnk" data-all="a">الكل</button></h4><div class="a-opts">' + secList("a") + "</div></div>" +
      '<div class="rp-sec"><h4>التكلفة · بالأسعار الحالية <button type="button" class="lnk" data-all="c">الكل</button></h4><div class="a-opts">' + secList("c") + "</div></div>" +
      '<div class="rp-sec"><h4>الشكل</h4><label class="fl"><span>عنوان التقرير</span><input class="txt" id="ac-title"></label><label class="toggle"><input type="checkbox" id="ac-ar"><span class="sw"></span>أرقام عربية (١٢٣)</label></div></aside>';
    const m = UI.modal("تقرير النشاط", '<div class="rp">' + side + '<div class="rp-prev"><div class="rp-bar"><span id="ac-info" class="mut sm"></span><span class="row"><button type="button" class="icon-btn sm" data-z="-1" aria-label="تصغير">−</button><button type="button" class="icon-btn sm" data-z="1" aria-label="تكبير">+</button></span></div><div class="rp-scroll"><div id="ac-pages" class="rp-pages"></div></div></div></div>',
      '<span class="ft-note mut sm">الزيارات والأنشطة أولاً · التكلفة ملاحظة بالأسعار الحالية</span><button class="btn" id="ac-xl">' + icons.sheet + 'Excel</button><button class="btn solid" id="ac-go">' + icons.print + "طباعة / PDF</button>", { cls: "xl", onClose: () => removeEventListener("resize", fit), sub: "تقرير مُجمّع قابل للتخصيص" });
    const pagesEl = m.querySelector("#ac-pages");
    let zoom = .6;
    const fit = () => { const w = m.querySelector(".rp-scroll").clientWidth - 24; zoom = Math.max(.3, Math.min(1, w / (210 * 3.78))); pagesEl.style.setProperty("--z", zoom); };
    const q = s => m.querySelector(s);
    const paintSide = () => {
      m.querySelectorAll("[data-sc]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sc === o.scope)));
      const R = resultFor(o.scope);
      q("#ac-scope-d").textContent = (o.scope === "view" ? (IO.scopeLabel(true) || "بدون تصفية إضافية") + " · " : o.scope === "period" ? "يتجاهل التصفية ويحترم الفترة · " : "كل البيانات المحمّلة · ") + R.visits.length + " زيارة · " + R.items.length + " نشاط";
      m.querySelectorAll("[data-sec]").forEach(i => i.checked = !!o.sections[i.dataset.sec]);
      q("#ac-ar").checked = o.arabic; q("#ac-title").value = o.title;
    };
    let tok = 0;
    const refresh = UI.debounce(async () => {
      const my = ++tok;
      const out = await build(o);
      if (my !== tok) return;
      pagesEl.innerHTML = out.html;
      fixRefs(pagesEl, o.arabic);
      q("#ac-info").textContent = out.pages + " صفحة · A4 · " + out.R.visits.length + " زيارة · " + out.R.items.length + " نشاط";
      saveOpts(o);
    }, 80);
    q(".rp-side").addEventListener("click", e => {
      const b = e.target.closest("[data-sc]");
      if (b) { o.scope = b.dataset.sc; paintSide(); refresh(); return; }
      const a = e.target.closest("[data-all]");
      if (a) { const ks = SECTIONS.filter(s => s[3] === a.dataset.all).map(s => s[0]); const on = !ks.every(k => o.sections[k]); ks.forEach(k => o.sections[k] = on); paintSide(); refresh(); }
    });
    q(".rp-side").addEventListener("change", e => {
      const t = e.target;
      if (t.dataset.sec) o.sections[t.dataset.sec] = t.checked;
      else if (t.id === "ac-ar") o.arabic = t.checked;
      refresh();
    });
    q("#ac-title").addEventListener("input", () => { o.title = q("#ac-title").value; refresh(); });
    q(".rp-bar").onclick = e => { const b = e.target.closest("[data-z]"); if (!b) return; zoom = Math.max(.25, Math.min(1.4, zoom + +b.dataset.z * .1)); pagesEl.style.setProperty("--z", zoom); };
    q("#ac-go").onclick = () => { saveOpts(o); m.close(); print({ ...o }); };
    q("#ac-xl").onclick = () => { saveOpts(o); excel(o); };
    paintSide();
    requestAnimationFrame(() => { fit(); refresh(); });
    addEventListener("resize", fit);
  }

  return { dialog, excel, print, compute };
})();
