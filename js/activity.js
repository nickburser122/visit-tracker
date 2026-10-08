const ACT = (() => {
  const { esc, fm, fm2, pct, icons } = UI;
  const SECTIONS = [
    ["overview", "الملخص العام", true],
    ["car", "الزيارات بالسيارة وبدونها", true],
    ["purp", "الزيارات حسب الغرض", true],
    ["people", "الزيارات حسب الفرد", true],
    ["peoplePurp", "الأفراد × الغرض", false],
    ["types", "حسب نوع الجهة", true],
    ["cities", "حسب المدينة", true],
    ["months", "حسب الشهر", true],
    ["ents", "حسب الجهة", false]
  ];
  const SCOPES = [["view", "العرض الحالي"], ["period", "الفترة فقط"], ["all", "كل الفترات"]];
  const KIND_ROWS = [["travel", "انتقال ذهاب وعودة"], ["class", "بدل داخلي"], ["service", "سيرفيس دمنهور"], ["allow", "بدل سفر بالسيارة"]];
  const CLS = ["", "الأولى", "الثانية", "الثالثة"];
  const KEY = "addad3.act";

  function loadOpts() {
    const base = { scope: "view", sections: Object.fromEntries(SECTIONS.map(([k, , on]) => [k, on])), cost: true, prices: false, arabic: !!S.settings.org.arabicDigits, title: "تقرير نشاط المرور" };
    try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o) return { ...base, ...o, sections: { ...base.sections, ...(o.sections || {}) } }; } catch (e) {}
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

  function compute(R) {
    const vagg = new Map();
    const kind = { travel: 0, class: 0, service: 0, allow: 0 };
    for (const it of R.items) {
      let o = vagg.get(it.v);
      if (!o) vagg.set(it.v, o = { n: 0, car: 0, sum: 0 });
      o.n++; if (it.p.car) o.car++; o.sum += it.sum;
      for (const k in it.k) kind[k] += it.k[k];
    }
    const mode = v => { const o = vagg.get(v); return o.car === 0 ? "nocar" : o.car === o.n ? "car" : "mixed"; };
    const tot = { visits: R.visits.length, parts: R.items.length, days: new Set(R.visits.map(v => v.d)).size, people: R.persons.length, ents: new Set(R.visits.map(v => v.ek)).size, cities: new Set(R.visits.map(v => v.city || "?")).size, car: 0, nocar: 0, mixed: 0, carP: 0, nocarP: 0, inV: 0, outV: 0, sum: R.total, miss: R.miss, kind };
    for (const v of R.visits) { tot[mode(v)]++; v.city === DAMANHOUR ? tot.inV++ : tot.outV++; }
    for (const it of R.items) it.p.car ? tot.carP++ : tot.nocarP++;

    function group(keyFn, labelFn) {
      const m = new Map();
      for (const v of R.visits) {
        const k = keyFn(v);
        let g = m.get(k);
        if (!g) m.set(k, g = { k, l: labelFn(k, v), v: 0, car: 0, nocar: 0, mixed: 0, parts: 0, sum: 0 });
        const o = vagg.get(v);
        g.v++; g[mode(v)]++; g.parts += o.n; g.sum += o.sum;
      }
      return [...m.values()];
    }
    const purpMeta = ENG.M.meta.purp;
    const catRank = { plan: 0, insp: 1, other: 2 };
    const purp = group(v => v.pk, (k, v) => (purpMeta[k] || { l: ENG.purposeLabel(k, v.g) }).l).map(g => ({ ...g, cat: (purpMeta[g.k] || {}).cat || "other" })).sort((a, b) => catRank[a.cat] - catRank[b.cat] || b.v - a.v);
    const types = group(v => v.type, k => k).sort((a, b) => b.v - a.v);
    const cities = group(v => v.city || "?", k => k === "?" ? "غير معروفة" : k).sort((a, b) => b.v - a.v);
    const months = group(v => v.m, k => UI.mlabel(k)).sort((a, b) => a.k < b.k ? -1 : 1);
    const ents = group(v => v.ek, (k, v) => v.ent).sort((a, b) => b.v - a.v);
    const people = R.persons.map(p => { const vs = new Set(p.items.map(it => it.v)); return { k: p.key, l: p.name, cls: p.cls, v: vs.size, car: p.car, nocar: p.nocar, plan: p.plan, insp: p.insp, other: p.other, sum: p.sum, km: p.km, items: p.items }; }).sort((a, b) => b.v - a.v);
    const pcols = purp.slice(0, purp.length > 8 ? 7 : 8);
    const prestN = purp.length - pcols.length;
    const ppMatrix = people.map(p => { const c = {}; let rest = 0; const keep = new Set(pcols.map(x => x.k)); for (const it of p.items) { if (keep.has(it.v.pk)) c[it.v.pk] = (c[it.v.pk] || 0) + 1; else rest++; } return { ...p, c, rest }; });
    return { tot, purp, types, cities, months, ents, people, pcols, prestN, ppMatrix };
  }

  const bar = (n, max) => '<span class="a-bar"><i style="width:' + (max ? Math.max(2, Math.round(n / max * 100)) : 0) + '%"></i></span>';
  const num = n => n ? fm(n) : '<span class="a-z">—</span>';

  function blocks(R, C, o, st) {
    const B = [];
    const T = C.tot;
    const S_ = o.sections;
    const grpTable = (title, sub, rows, firstCol) => {
      const max = Math.max(1, ...rows.map(r => r.v));
      const hasMixed = rows.some(r => r.mixed);
      B.push({ t: "table", title, sub,
        head: "<tr><th class=\"c-n\">م</th><th>" + firstCol + '</th><th class="c-r">الزيارات</th><th class="a-bc"></th><th class="c-r">بالسيارة</th><th class="c-r">بدون سيارة</th>' + (hasMixed ? '<th class="c-r">مختلطة</th>' : "") + '<th class="c-r">المشاركات</th><th class="c-r">النسبة</th></tr>',
        rows: rows.map((r, i) => '<tr><td class="c-n">' + (i + 1) + "</td><td>" + esc(r.l) + '</td><td class="c-r"><b>' + r.v + "</b></td><td>" + bar(r.v, max) + '</td><td class="c-r">' + num(r.car) + '</td><td class="c-r">' + num(r.nocar) + "</td>" + (hasMixed ? '<td class="c-r">' + num(r.mixed) + "</td>" : "") + '<td class="c-r">' + r.parts + '</td><td class="c-r">' + pct(r.v, T.visits) + "%</td></tr>"),
        foot: '<tr><td></td><td>الإجمالي</td><td class="c-r">' + T.visits + '</td><td></td><td class="c-r">' + T.car + '</td><td class="c-r">' + T.nocar + "</td>" + (hasMixed ? '<td class="c-r">' + T.mixed + "</td>" : "") + '<td class="c-r">' + T.parts + '</td><td class="c-r">100%</td></tr>' });
    };
    if (S_.overview) {
      B.push({ t: "html", html: '<section class="a-sec"><h3>الملخص العام</h3><div class="a-kpis">' +
        [["الزيارات", T.visits, ""], ["أيام العمل", T.days, ""], ["المشاركات", T.parts, "فرد × زيارة"], ["الأفراد", T.people, ""], ["الجهات", T.ents, ""], ["المدن", T.cities, ""]].map(([l, v, s]) => "<div><span>" + l + "</span><b>" + v + "</b>" + (s ? "<small>" + s + "</small>" : "") + "</div>").join("") +
        '</div><div class="a-split"><div><span>داخل دمنهور</span><b>' + T.inV + "</b><small>" + pct(T.inV, T.visits) + '%</small></div><div><span>خارج دمنهور</span><b>' + T.outV + "</b><small>" + pct(T.outV, T.visits) + "%</small></div><div><span>متوسط الأفراد لكل زيارة</span><b>" + (T.visits ? (T.parts / T.visits).toFixed(1) : "0") + "</b></div><div><span>متوسط الزيارات لكل يوم</span><b>" + (T.days ? (T.visits / T.days).toFixed(1) : "0") + "</b></div></div></section>" });
    }
    if (S_.car) {
      const row = (l, n, of) => '<div><span>' + l + "</span><b>" + n + "</b><small>" + pct(n, of) + "%</small>" + '<i style="--w:' + pct(n, of) + '%"></i></div>';
      B.push({ t: "html", html: '<section class="a-sec"><h3>الزيارات بالسيارة وبدونها</h3><div class="a-car"><div class="a-car-g"><h4>الزيارات</h4><div class="a-car-r">' + row("بسيارة الهيئة", T.car, T.visits) + row("بدون سيارة", T.nocar, T.visits) + (T.mixed ? row("مختلطة", T.mixed, T.visits) : "") + '</div></div><div class="a-car-g"><h4>المشاركات (فرد × زيارة)</h4><div class="a-car-r">' + row("بسيارة الهيئة", T.carP, T.parts) + row("بدون سيارة", T.nocarP, T.parts) + "</div></div></div>" + (T.mixed ? '<p class="a-fn">«مختلطة»: زيارة ذهب فيها بعض الأفراد بسيارة الهيئة والباقون بدونها.</p>' : "") + "</section>" });
    }
    if (S_.purp) grpTable("الزيارات حسب الغرض", C.purp.length + " غرض مختلف · كل غرض مذكور باسمه كما ورد في الملف", C.purp, "الغرض");
    if (S_.people) {
      const max = Math.max(1, ...C.people.map(r => r.v));
      B.push({ t: "table", title: "الزيارات حسب الفرد", sub: C.people.length + " فرد",
        head: '<tr><th class="c-n">م</th><th>الاسم</th><th>الدرجة</th><th class="c-r">الزيارات</th><th class="a-bc"></th><th class="c-r">بالسيارة</th><th class="c-r">بدون سيارة</th><th class="c-r">خطة المرور</th><th class="c-r">فحص وشكاوى</th><th class="c-r">أغراض أخرى</th></tr>',
        rows: C.people.map((r, i) => '<tr><td class="c-n">' + (i + 1) + "</td><td><b>" + esc(r.l) + "</b></td><td>" + CLS[r.cls] + '</td><td class="c-r"><b>' + r.v + "</b></td><td>" + bar(r.v, max) + '</td><td class="c-r">' + num(r.car) + '</td><td class="c-r">' + num(r.nocar) + '</td><td class="c-r">' + num(r.plan) + '</td><td class="c-r">' + num(r.insp) + '</td><td class="c-r">' + num(r.other) + "</td></tr>"),
        foot: '<tr><td></td><td colspan="2">الإجمالي (مشاركات)</td><td class="c-r">' + T.parts + '</td><td></td><td class="c-r">' + T.carP + '</td><td class="c-r">' + T.nocarP + '</td><td class="c-r">' + C.people.reduce((s, p) => s + p.plan, 0) + '</td><td class="c-r">' + C.people.reduce((s, p) => s + p.insp, 0) + '</td><td class="c-r">' + C.people.reduce((s, p) => s + p.other, 0) + "</td></tr>" });
    }
    if (S_.peoplePurp && C.pcols.length) {
      B.push({ t: "table", title: "الأفراد × الغرض", sub: "عدد مشاركات كل فرد في كل غرض" + (C.prestN ? " · «باقي الأغراض» تضم " + C.prestN + " غرض أقل تكراراً، وتفصيلها في جدول الغرض" : ""),
        head: '<tr><th>الاسم</th>' + C.pcols.map(c => '<th class="c-r a-vh">' + esc(c.l) + "</th>").join("") + (C.prestN ? '<th class="c-r a-vh">باقي الأغراض</th>' : "") + '<th class="c-r">الإجمالي</th></tr>',
        rows: C.ppMatrix.map(p => "<tr><td><b>" + esc(p.l) + "</b></td>" + C.pcols.map(c => '<td class="c-r">' + num(p.c[c.k] || 0) + "</td>").join("") + (C.prestN ? '<td class="c-r">' + num(p.rest) + "</td>" : "") + '<td class="c-r"><b>' + p.v + "</b></td></tr>"),
        foot: "<tr><td>الإجمالي</td>" + C.pcols.map(c => '<td class="c-r">' + C.ppMatrix.reduce((s, p) => s + (p.c[c.k] || 0), 0) + "</td>").join("") + (C.prestN ? '<td class="c-r">' + C.ppMatrix.reduce((s, p) => s + p.rest, 0) + "</td>" : "") + '<td class="c-r">' + T.parts + "</td></tr>" });
    }
    if (S_.types) grpTable("حسب نوع الجهة", C.types.length + " نوع", C.types, "نوع الجهة");
    if (S_.cities) grpTable("حسب المدينة", C.cities.length + " مدينة", C.cities, "المدينة");
    if (S_.months) grpTable("حسب الشهر", C.months.length + " شهر", C.months, "الشهر");
    if (S_.ents) grpTable("حسب الجهة", C.ents.length + " جهة", C.ents, "الجهة");
    if (o.cost) {
      B.push({ t: "html", html: '<section class="a-sec a-cost"><h3>ملاحظة: التكلفة التقديرية بالأسعار الحالية</h3><div class="a-cost-in"><div class="a-cost-tot"><span>إجمالي التكلفة التقديرية</span><b>' + fm2(T.sum) + " <small>جنيه</small></b>" + (T.miss ? "<em>+ " + T.miss + " بند بلا سعر لم يُحتسب</em>" : "") + '</div><div class="a-cost-k">' + KIND_ROWS.map(([k, l]) => "<div><span>" + l + "</span><b>" + fm2(T.kind[k]) + "</b><small>" + pct(T.kind[k], T.sum) + "%</small></div>").join("") + '</div></div><p class="a-fn">هذه القيمة محسوبة آلياً بالأسعار والبدلات المسجّلة في الإعدادات يوم إصدار التقرير (' + UI.dlabel(UI.today()) + ")، وليست أسعار يوم الزيارة. الأسعار تتغير، لذا تُعرض هنا للشفافية فقط ولا تُعد مستند صرف؛ الكشوف الفردية هي المرجع. أساس الحساب: سيرفيس دمنهور " + fm(st.servicePrice) + " جنيه للمرة · بدل داخلي " + [1, 2, 3].map(c => CLS[c] + " " + fm(st.classAmount[c])).join("، ") + " · بدل سفر بالسيارة " + [1, 2, 3].map(c => CLS[c] + " " + fm(st.carAllowance[c])).join("، ") + ".</p></section>" });
    }
    if (o.prices) {
      const used = [...new Set(R.visits.map(v => v.city).filter(c => c && c !== DAMANHOUR))].sort((a, b) => (st.prices[b] ?? -1) - (st.prices[a] ?? -1));
      B.push({ t: "table", title: "الأسعار المستخدمة في الحساب", sub: "سعر الاتجاه الواحد للمدن الواردة في هذا التقرير",
        head: '<tr><th class="c-n">م</th><th>المدينة</th><th class="c-r">السعر (اتجاه)</th><th class="c-r">المسافة كم</th><th>بدل سفر</th></tr>',
        rows: used.map((c, i) => '<tr><td class="c-n">' + (i + 1) + "</td><td>" + esc(c) + '</td><td class="c-r">' + (st.prices[c] == null ? "غير محدد" : fm2(st.prices[c])) + '</td><td class="c-r">' + (st.km[c] == null ? "—" : fm(st.km[c])) + "</td><td>" + (ENG.isFar(c) ? "يستحق" : "لا") + "</td></tr>"), foot: "" });
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
        sec.className = "a-sec";
        sec.innerHTML = "<h3>" + esc(b.title) + (cont ? ' <small>(تابع)</small>' : "") + "</h3>" + (b.sub && !cont ? '<p class="a-sub">' + esc(b.sub) + "</p>" : "") + '<table class="r-tbl a-tbl"><thead>' + b.head + "</thead><tbody></tbody>" + (b.foot ? "<tfoot>" + b.foot + "</tfoot>" : "") + "</table>";
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
    const scopeBox = '<div class="a-scope"><div><span>الفترة</span><b>' + esc(period) + "</b></div><div><span>نطاق التقرير</span><b>" + esc(o.scope === "all" ? "كل البيانات المحمّلة" : o.scope === "period" ? "كل الزيارات في الفترة" : scope || "كل الزيارات في الفترة") + "</b></div>" + (S.excl.length && R.excluded.length ? "<div><span>مستبعد</span><b>" + R.excluded.length + " مشاركة</b></div>" : "") + "</div>";
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
    setTimeout(() => print_(), 60);
  }
  const print_ = () => window.print();

  function excel(o) {
    const st = S.settings;
    const R = resultFor(o.scope);
    const C = compute(R), T = C.tot;
    const period = periodOf(o.scope, R), scope = scopeText(o.scope);
    const sheets = [];
    const sum = [["البند", "القيمة"], ["التقرير", o.title || "تقرير نشاط المرور"], ["الفترة", period], ["النطاق", o.scope === "all" ? "كل البيانات المحمّلة" : o.scope === "period" ? "كل الزيارات في الفترة" : scope || "كل الزيارات في الفترة"], ["تاريخ الإصدار", UI.today()], [], ["الزيارات", T.visits], ["أيام العمل", T.days], ["المشاركات", T.parts], ["الأفراد", T.people], ["الجهات", T.ents], ["المدن", T.cities], ["داخل دمنهور", T.inV], ["خارج دمنهور", T.outV], [], ["زيارات بسيارة الهيئة", T.car], ["زيارات بدون سيارة", T.nocar], ["زيارات مختلطة", T.mixed], ["مشاركات بالسيارة", T.carP], ["مشاركات بدون سيارة", T.nocarP]];
    if (o.cost) sum.push([], ["ملاحظة التكلفة", "تقديرية بالأسعار الحالية في " + UI.today() + " · للشفافية فقط وليست مستند صرف"], ["إجمالي التكلفة التقديرية", T.sum], ...KIND_ROWS.map(([k, l]) => [l, T.kind[k]]), ["بنود بلا سعر", T.miss]);
    sheets.push({ name: "الملخص", cols: [28, 60], rows: sum });
    const g = (name, rows, first) => { if (!o.sections[name.k]) return; sheets.push({ name: name.l, cols: [30, 10, 10, 12, 10, 12, 10], total: true, rows: [[first, "الزيارات", "بالسيارة", "بدون سيارة", "مختلطة", "المشاركات", "النسبة %"], ...rows.map(r => [r.l, r.v, r.car, r.nocar, r.mixed, r.parts, pct(r.v, T.visits)]), ["الإجمالي", T.visits, T.car, T.nocar, T.mixed, T.parts, 100]] }); };
    g({ k: "purp", l: "حسب الغرض" }, C.purp, "الغرض");
    if (o.sections.people) sheets.push({ name: "حسب الفرد", cols: [18, 10, 10, 10, 12, 12, 12, 12], total: true, rows: [["الاسم", "الدرجة", "الزيارات", "بالسيارة", "بدون سيارة", "خطة المرور", "فحص وشكاوى", "أغراض أخرى"], ...C.people.map(p => [p.l, CLS[p.cls], p.v, p.car, p.nocar, p.plan, p.insp, p.other]), ["الإجمالي", "", T.parts, T.carP, T.nocarP, C.people.reduce((s, p) => s + p.plan, 0), C.people.reduce((s, p) => s + p.insp, 0), C.people.reduce((s, p) => s + p.other, 0)]] });
    if (o.sections.peoplePurp) {
      const all = C.purp;
      sheets.push({ name: "الأفراد × الغرض", cols: [18, ...all.map(() => 14), 10], total: true, rows: [["الاسم", ...all.map(c => c.l), "الإجمالي"], ...C.people.map(p => { const c = {}; for (const it of p.items) c[it.v.pk] = (c[it.v.pk] || 0) + 1; return [p.l, ...all.map(x => c[x.k] || 0), p.v]; }), ["الإجمالي", ...all.map(x => x.parts), T.parts]] });
    }
    g({ k: "types", l: "حسب نوع الجهة" }, C.types, "نوع الجهة");
    g({ k: "cities", l: "حسب المدينة" }, C.cities, "المدينة");
    g({ k: "months", l: "حسب الشهر" }, C.months, "الشهر");
    g({ k: "ents", l: "حسب الجهة" }, C.ents, "الجهة");
    if (o.prices) {
      const used = [...new Set(R.visits.map(v => v.city).filter(c => c && c !== DAMANHOUR))];
      sheets.push({ name: "الأسعار المستخدمة", cols: [22, 14, 12, 10], rows: [["المدينة", "السعر (اتجاه)", "المسافة كم", "بدل سفر"], ...used.map(c => [c, st.prices[c], st.km[c], !!ENG.isFar(c)]), [], ["سيرفيس دمنهور", st.servicePrice], ...[1, 2, 3].map(c => ["بدل داخلي · " + CLS[c], st.classAmount[c]]), ...[1, 2, 3].map(c => ["بدل سفر بالسيارة · " + CLS[c], st.carAllowance[c]])] });
    }
    UI.download("addad-activity_" + (o.scope === "all" ? "all" : IO.periodName()) + ".xlsx", XL.write(sheets));
    UI.toast("✓ Excel");
  }

  function dialog() {
    if (!ENG.M.visits.length) return;
    const o = loadOpts();
    const side = '<aside class="rp-side">' +
      '<div class="rp-sec"><h4>النطاق</h4><div class="seg a-scopes" id="ac-scope">' + SCOPES.map(([k, l]) => '<button type="button" data-sc="' + k + '">' + l + "</button>").join("") + '</div><p class="note sm" id="ac-scope-d"></p></div>' +
      '<div class="rp-sec"><h4>الأقسام</h4><div class="a-opts">' + SECTIONS.map(([k, l]) => '<label class="toggle"><input type="checkbox" data-sec="' + k + '"><span class="sw"></span>' + l + "</label>").join("") + '</div></div>' +
      '<div class="rp-sec"><h4>التكلفة</h4><label class="toggle"><input type="checkbox" id="ac-cost"><span class="sw"></span>ملاحظة التكلفة بالأسعار الحالية</label><label class="toggle"><input type="checkbox" id="ac-prices"><span class="sw"></span>جدول الأسعار المستخدمة</label></div>' +
      '<div class="rp-sec"><h4>الشكل</h4><label class="fl"><span>عنوان التقرير</span><input class="txt" id="ac-title"></label><label class="toggle"><input type="checkbox" id="ac-ar"><span class="sw"></span>أرقام عربية (١٢٣)</label></div></aside>';
    const m = UI.modal("تقرير النشاط", '<div class="rp">' + side + '<div class="rp-prev"><div class="rp-bar"><span id="ac-info" class="mut sm"></span><span class="row"><button type="button" class="icon-btn sm" data-z="-1" aria-label="تصغير">−</button><button type="button" class="icon-btn sm" data-z="1" aria-label="تكبير">+</button></span></div><div class="rp-scroll"><div id="ac-pages" class="rp-pages"></div></div></div></div>',
      '<span class="ft-note mut sm">يصدر عدد الزيارات والتصنيفات · التكلفة ملاحظة فقط</span><button class="btn" id="ac-xl">' + icons.sheet + 'Excel</button><button class="btn solid" id="ac-go">' + icons.print + "طباعة / PDF</button>", { cls: "xl", onClose: () => removeEventListener("resize", fit), sub: "تقرير مُجمّع لعدد الزيارات · قابل للتخصيص" });
    const pagesEl = m.querySelector("#ac-pages");
    let zoom = .6;
    const fit = () => { const w = m.querySelector(".rp-scroll").clientWidth - 24; zoom = Math.max(.3, Math.min(1, w / (210 * 3.78))); pagesEl.style.setProperty("--z", zoom); };
    const q = s => m.querySelector(s);
    const paintSide = () => {
      m.querySelectorAll("[data-sc]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sc === o.scope)));
      const R = resultFor(o.scope);
      q("#ac-scope-d").textContent = (o.scope === "view" ? (IO.scopeLabel(true) || "بدون تصفية إضافية") + " · " : o.scope === "period" ? "يتجاهل التصفية ويحترم الفترة · " : "كل الزيارات المحمّلة · ") + R.visits.length + " زيارة";
      m.querySelectorAll("[data-sec]").forEach(i => i.checked = !!o.sections[i.dataset.sec]);
      q("#ac-cost").checked = o.cost; q("#ac-prices").checked = o.prices; q("#ac-ar").checked = o.arabic; q("#ac-title").value = o.title;
    };
    let tok = 0;
    const refresh = UI.debounce(async () => {
      const my = ++tok;
      const out = await build(o);
      if (my !== tok) return;
      pagesEl.innerHTML = out.html;
      fixRefs(pagesEl, o.arabic);
      q("#ac-info").textContent = out.pages + " صفحة · A4 · " + out.R.visits.length + " زيارة";
      saveOpts(o);
    }, 80);
    q(".rp-side").addEventListener("click", e => { const b = e.target.closest("[data-sc]"); if (b) { o.scope = b.dataset.sc; paintSide(); refresh(); } });
    q(".rp-side").addEventListener("change", e => {
      const t = e.target;
      if (t.dataset.sec) o.sections[t.dataset.sec] = t.checked;
      else if (t.id === "ac-cost") o.cost = t.checked;
      else if (t.id === "ac-prices") o.prices = t.checked;
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
