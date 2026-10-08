const VIEWS = (() => {
  const { esc, fm, pct, dateCell, icons } = UI;
  const CAT = { plan: "خطة المرور", insp: "فحص", other: "أخرى" };
  const CLS = { 1: "الدرجة الأولى", 2: "الدرجة الثانية", 3: "الدرجة الثالثة" };
  const CLS_S = ["", "الأولى", "الثانية", "الثالثة"];
  const money = (n, miss) => "<span>" + fm(n) + "</span>" + (miss ? ' <span class="nil" title="بنود بلا سعر">+' + miss + "؟</span>" : "");
  const amt = a => a == null ? '<i class="nil">غير محدد</i>' : fm(a);
  const C1 = "var(--c1)", C2 = "var(--c2)", C3 = "var(--c3)";
  const emptyBox = msg => '<div class="panel empty">' + msg + '<br><button class="btn sm" style="margin-top:12px" data-clear-all>' + icons.reset + "مسح التصفية</button></div>";

  document.addEventListener("click", e => {
    const c = e.target.closest("[data-clear-all]");
    if (c) { resetFilters(); saveUi(); FILTERS.sync(); update(); return; }
    if (e.target.closest("[data-act-report]")) { ACT.dialog(); return; }
    if (e.target.closest("#view [data-goset]") && S.tab !== "visits") { S.tab = "prices"; saveUi(); render(); requestAnimationFrame(() => document.getElementById("ent-map")?.scrollIntoView({ behavior: "smooth", block: "start" })); return; }
    const f = e.target.closest("[data-f]");
    if (f && f.closest("#view")) toggleFilter(f.dataset.f, f.dataset.k);
  });

  function welcome(v) {
    v.innerHTML = '<section class="hero-drop"><button type="button" class="drop" id="drop-zone"><img src="images/logo.jpg" alt=""><b>اسحب ملف المرور هنا</b><span>xlsx · csv</span><span class="btn solid">' + icons.upload + 'اختيار ملف</span></button>' +
      '<div class="row center"><button class="btn" id="w-tpl">' + icons.dl + 'القالب</button><button class="btn ghost" id="w-demo">' + icons.spark + "بيانات تجريبية</button></div></section>";
    v.querySelector("#drop-zone").onclick = () => document.getElementById("file-input").click();
    v.querySelector("#w-tpl").onclick = () => IO.template(false);
    v.querySelector("#w-demo").onclick = () => IO.demo();
  }

  function barList(rows, key, max, fmtV) {
    const on = new Set(S.filters[key]);
    return rows.map(r => '<button class="bar-row' + (on.has(r.k) ? " on" : "") + '" data-f="' + key + '" data-k="' + esc(r.k) + '"><span class="nm">' + r.l + '</span><span class="tr">' + r.parts.map((p, i) => '<i class="' + ["", "b", "c"][i] + '" style="width:' + (p / max * 100) + '%"></i>').join("") + '</span><span class="vl">' + fmtV(r) + "</span></button>").join("");
  }

  function group(items, keyFn, byVisit) {
    const o = new Map();
    for (const it of items) {
      const k = keyFn(it.v);
      let g = o.get(k);
      if (!g) o.set(k, g = { n: new Set(), sum: 0, miss: 0, car: new Set(), acts: 0 });
      g.n.add(byVisit ? it.v.V : it.v); g.sum += it.sum; g.miss += it.miss; g.acts++;
      if (it.p.car) g.car.add(it.v);
    }
    return [...o.entries()].sort((a, b) => b[1].n.size - a[1].n.size);
  }

  const KIND = [["travel", "انتقال ذهاب وعودة"], ["class", "بدل داخلي"], ["service", "سيرفيس دمنهور"], ["allow", "بدل سفر بالسيارة"]];
  const KC = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--mk2)"];
  const bySum = list => list.sort((a, b) => b[1].sum - a[1].sum);
  const delta = (cur, prev) => { if (!prev) return ""; const d = Math.round((cur - prev) / prev * 100); return '<span class="dl' + (d > 0 ? " up" : d < 0 ? " dn" : "") + '">' + (d > 0 ? "▲ " : d < 0 ? "▼ " : "") + Math.abs(d) + "%</span>"; };

  function dash(v) {
    const R = currentResult();
    const vis = R.visits;
    if (!vis.length) { v.innerHTML = emptyBox("لا توجد زيارات تطابق التصفية الحالية"); return; }
    const { total, miss } = R;
    const parts = R.items.length;
    const kind = { travel: 0, class: 0, service: 0, allow: 0 };
    let pc = 0, saved = 0, inSum = 0, inN = 0;
    const days = new Set(), months = {};
    for (const x of vis) { days.add(x.d); if (x.inD) inN++; (months[x.m] || (months[x.m] = { n: 0, sum: 0 })).n++; }
    for (const it of R.items) {
      for (const k in it.k) kind[k] += it.k[k];
      months[it.v.m].sum += it.sum;
      if (it.v.city === DAMANHOUR) inSum += it.sum;
      if (it.p.car) { pc++; saved += Math.max(0, it.save); }
    }
    const mk = Object.keys(months).sort(), nM = mk.length;
    const outSum = total - inSum;
    const top = R.persons[0];

    let prev = null;
    const pv = PICKER.prev();
    if (pv && pv.to >= bounds().a) { const P = ENG.filter({ ...S.filters, from: pv.from, to: pv.to, months: [] }); if (P.visits.length) prev = { sum: P.total, n: P.visits.length, label: pv.label }; }

    const unkN = Object.values(ENG.M.meta.unknown).filter(o => !o.city).length;
    let h = "";
    if (unkN || miss) h += '<div class="alert">' + icons.warn + "<span>" + (unkN ? unkN + " جهة بلا مدينة" : "") + (unkN && miss ? " · " : "") + (miss ? miss + " بند بلا سعر" : "") + '</span><button class="btn sm" data-goset>مراجعة</button></div>';

    h += '<div class="kpis">' +
      '<div class="kpi hero"><span class="k-l">إجمالي المستحق</span><span class="k-v">' + fm(total) + "<small>جنيه</small></span><span class=\"k-s\">" + (prev ? delta(total, prev.sum) + " عن " + esc(prev.label) + " · " + fm(prev.sum) : nM > 1 ? fm(total / nM) + " / شهر" : "") + (miss ? " · +" + miss + " بلا سعر" : "") + "</span></div>" +
      '<div class="kpi"><span class="k-l">الزيارات</span><span class="k-v">' + vis.length + '</span><span class="k-s">' + (prev ? delta(vis.length, prev.n) + " · " : "") + parts + " نشاط فردي · " + days.size + " يوم</span></div>" +
      '<div class="kpi"><span class="k-l">تكلفة الزيارة</span><span class="k-v">' + fm(Math.round(total / vis.length)) + '<small>جنيه</small></span><span class="k-s">' + fm(Math.round(total / parts)) + " لكل نشاط فردي</span></div>" +
      '<div class="kpi"><span class="k-l">وفّرته سيارة الهيئة</span><span class="k-v">' + fm(Math.round(saved)) + '<small>جنيه</small></span><span class="k-s">' + pc + " نشاط بالسيارة · " + pct(pc, parts) + '%</span><div class="ratio"><i style="width:' + pct(pc, parts) + '%"></i></div></div>' +
      '<div class="kpi"><span class="k-l">خارج دمنهور</span><span class="k-v">' + pct(outSum, total) + '<small>% من المبلغ</small></span><span class="k-s">' + (vis.length - inN) + " من " + vis.length + ' زيارة</span><div class="ratio"><i style="width:' + pct(outSum, total) + '%"></i></div></div>' +
      '<div class="kpi"><span class="k-l">الأعلى مستحقاً</span><span class="k-v nm">' + esc(top ? top.name : "—") + '</span><span class="k-s">' + (top ? fm(top.sum) + " · " + pct(top.sum, total) + "% من الإجمالي" : "") + "</span></div></div>";

    const maxP = Math.max(1, ...R.persons.map(p => p.sum));
    const mmax = Math.max(1, ...mk.map(k => months[k].sum));
    const msel = new Set(S.filters.months);
    h += '<div class="grid g2"><section class="panel"><div class="panel-hd"><h2>المستحق لكل فرد</h2><p>' + R.persons.length + " فرد · " + fm(total / (R.persons.length || 1)) + ' متوسط</p></div><div class="bars">' +
      barList(R.persons.map(p => ({ k: p.key, l: esc(p.name), parts: [p.sum], p })), "people", maxP, r => money(r.p.sum, r.p.miss) + ' <span class="mut sm">· ' + r.p.visits + " زيارة</span>") + "</div></section>";
    h += '<section class="panel"><div class="panel-hd"><h2>شهرياً</h2><p>' + (nM > 1 ? fm(total / nM) + " جنيه / شهر" : "") + '</p></div><div class="cols">' +
      mk.map(k => { const o = months[k]; return '<button class="col' + (msel.has(k) ? " on" : "") + '" data-f="months" data-k="' + k + '" title="' + UI.mlabel(k) + " · " + o.n + " زيارة · " + fm(o.sum) + ' جنيه"><b>' + fm(Math.round(o.sum)) + '</b><span class="stk" style="height:' + Math.max(2, o.sum / mmax * 100) + '%"><i style="flex:1"></i></span><small>' + MONTH_SHORT[+k.slice(5) - 1] + "<br>" + o.n + "</small></button>"; }).join("") + "</div></section></div>";

    const cities = bySum(group(R.items, x => x.city || "?")).slice(0, 10);
    const cmax = Math.max(1, ...cities.map(c => c[1].sum));
    h += '<div class="grid g2"><section class="panel"><div class="panel-hd"><h2>بنود الصرف</h2></div><div class="kbar">' + KIND.map(([k], i) => kind[k] ? '<i style="flex:' + kind[k] + ";background:" + KC[i] + '"></i>' : "").join("") + '</div><div class="dlist">' +
      KIND.map(([k, l], i) => '<div class="ln"><span><span class="sw" style="background:' + KC[i] + '"></span>' + l + "</span><b>" + fm(kind[k]) + ' <span class="mut sm">' + pct(kind[k], total) + "%</span></b></div>").join("") +
      (miss ? '<div class="ln"><span>بنود بلا سعر</span><b>' + miss + "</b></div>" : "") + "</div></section>";
    h += '<section class="panel"><div class="panel-hd"><h2>المدن حسب التكلفة</h2></div><div class="bars">' +
      barList(cities.map(([c, o]) => ({ k: c, l: c === "?" ? '<span class="mut">غير معروفة</span>' : esc(c), parts: [o.sum], o })), "cities", cmax, r => fm(r.o.sum) + ' <span class="mut sm">· ' + r.o.n.size + " · " + fm(Math.round(r.o.sum / r.o.n.size)) + "/زيارة</span>") + "</div></section></div>";

    if (nM > 1 && R.persons.length) {
      const cm = mk.slice(-12), mat = {};
      for (const it of R.items) { const r = mat[it.p.key] || (mat[it.p.key] = {}); r[it.v.m] = (r[it.v.m] || 0) + it.sum; }
      const hmax = Math.max(1, ...R.persons.flatMap(p => cm.map(m => mat[p.key][m] || 0)));
      h += '<section class="panel"><div class="panel-hd"><h2>الأفراد × الشهور</h2>' + (mk.length > 12 ? '<p>آخر 12 شهراً</p>' : "") + '</div><div class="tw"><table class="hm"><thead><tr><th></th>' + cm.map(m => '<th class="n">' + MONTH_SHORT[+m.slice(5) - 1] + " " + m.slice(2, 4) + "</th>").join("") + '<th class="n">الإجمالي</th></tr></thead><tbody>' +
        R.persons.map(p => '<tr><td><button class="lnk-t" data-f="people" data-k="' + esc(p.key) + '">' + esc(p.name) + "</button></td>" + cm.map(m => { const x = mat[p.key][m] || 0; return '<td class="n hc"' + (x ? ' style="--o:' + (0.06 + 0.3 * x / hmax).toFixed(2) + '"' : "") + "><span>" + (x ? fm(Math.round(x)) : '<i class="mut">·</i>') + "</span></td>"; }).join("") + '<td class="n"><b>' + fm(Math.round(p.sum)) + "</b></td></tr>").join("") +
        '<tr class="sumrow"><td>الإجمالي</td>' + cm.map(m => '<td class="n">' + fm(Math.round(months[m].sum)) + "</td>").join("") + '<td class="n">' + fm(Math.round(total)) + "</td></tr></tbody></table></div></section>";
    }

    const ents = bySum(group(R.items, x => x.ek)).slice(0, 10);
    const emax = Math.max(1, ...ents.map(c => c[1].sum));
    const entName = k => (ENG.M.meta.ents[k] || { l: k }).l;
    const purp = group(R.items, x => x.V.pk, true);
    const pmax = Math.max(1, ...purp.map(p => p[1].n.size));
    const car = { nocar: [0, 0], car: [0, 0] };
    for (const it of R.items) { const c = car[it.p.car ? "car" : "nocar"]; c[0]++; c[1] += it.sum; }
    const carSel = new Set(S.filters.car);
    const pm = ENG.M.meta.purp;
    h += '<div class="grid g2"><section class="panel"><div class="panel-hd"><div><h2>الزيارات حسب الغرض</h2><p>' + purp.length + ' غرض · كل غرض باسمه</p></div><button class="btn sm" data-act-report>' + icons.report + 'تقرير</button></div><div class="bars">' +
      barList(purp.map(([k, o]) => ({ k, l: esc((pm[k] || { l: k }).l), parts: [o.n.size], o })), "purp", pmax, r => r.o.n.size + ' <span class="mut sm">زيارة · ' + r.o.acts + " نشاط</span>") +
      '</div><div class="dlist carlist">' + [["nocar", "بدون سيارة"], ["car", "بسيارة الهيئة"]].map(([k, l]) => '<button data-f="car" data-k="' + k + '" class="' + (carSel.has(k) ? "on" : "") + '"><span><span class="sw ' + k + '"></span>' + l + '</span><span class="mut">' + car[k][0] + " نشاط · " + fm(car[k][1]) + " جنيه</span></button>").join("") + "</div></section>";
    h += '<section class="panel"><div class="panel-hd"><h2>الجهات حسب التكلفة</h2></div><div class="bars">' +
      barList(ents.map(([k, o]) => ({ k, l: esc(entName(k)), parts: [o.sum], o })), "ents", emax, r => fm(r.o.sum) + ' <span class="mut sm">· ' + r.o.n.size + "</span>") + "</div></section></div>";
    v.innerHTML = h;
  }

  const SORTS = { "d-desc": ["الأحدث أولاً", (a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0], "d-asc": ["الأقدم أولاً", (a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0], "sum": ["الأعلى مستحقاً", (a, b) => b.sum - a.sum], "km": ["الأبعد مسافة", (a, b) => (b.km ?? -1) - (a.km ?? -1)], "n": ["الأكثر أفراداً", (a, b) => b.people.length - a.people.length] };
  let vObs = null;
  let VM = null;
  function legCell(x) {
    return '<div class="leg"><button class="lnk-t" data-f="ents" data-k="' + esc(x.ek) + '">' + esc(x.ent) + '</button><div class="mut sm">' + (x.city ? esc(x.city) + (x.city === DAMANHOUR ? " · داخلي" : (x.km != null ? " · " + x.km + " كم" : "") + (x.far ? " · بدل سفر" : "")) : '<button class="tag d" data-goset>مدينة غير معروفة · حدّدها</button>') + " · " + esc(x.type) + (x.zero ? " · بدون تكلفة" : "") + (x.how === "guess" || x.how === "fuzzy" ? ' · <span class="tag d" title="تم الاستنتاج من الاسم">تخمين</span>' : "") + "</div></div>";
  }
  function visitRow(G) {
    const o = VM && VM.get(G) || { sum: G.sum, miss: G.miss, keys: null, legs: null };
    const legs = o.legs ? G.legs.filter(v => o.legs.has(v)) : G.legs;
    const multi = G.legs.length > 1;
    return '<tr' + (multi ? ' class="multi"' : "") + '><td data-l="اليوم">' + dateCell(G.d) + '</td><td data-l="الجهة" class="c-ent">' + (multi ? '<span class="legs-n">' + G.legs.length + " جهات · زيارة واحدة</span>" : "") + legs.map(legCell).join("") + (legs.length < G.legs.length ? '<div class="mut sm">+' + (G.legs.length - legs.length) + " خارج التصفية</div>" : "") + '</td><td data-l="الغرض"><button class="tag' + (G.cat === "plan" ? " w" : "") + '" data-f="purp" data-k="' + esc(G.pk) + '">' + esc(G.cat === "plan" ? "خطة المرور" : G.g || CAT[G.cat]) + '</button></td><td data-l="الأفراد"><div class="people">' + G.people.map(p => '<button class="pc' + (p.car ? " car" : "") + (o.keys && !o.keys.has(p.key) ? " dim" : "") + '" data-person="' + esc(p.key) + '" title="' + (p.car ? "بسيارة الهيئة" : "بدون سيارة") + (o.keys && !o.keys.has(p.key) ? " · خارج التصفية" : "") + '">' + (p.car ? icons.car : "") + esc(p.name) + "</button>").join("") + '</div></td><td class="n c-amt" data-l="المستحق">' + money(o.sum, o.miss) + "</td></tr>";
  }
  function visits(v) {
    const R = currentResult();
    VM = R.vm;
    const sort = SORTS[S.vsort] ? S.vsort : "d-desc";
    const list = sort === "sum" ? [...R.visits].sort((a, b) => R.vm.get(b).sum - R.vm.get(a).sum) : [...R.visits].sort(SORTS[sort][1]);
    let shown = Math.min(list.length, S.vlimit);
    let h = '<section class="panel"><div class="panel-hd"><div><h2>الزيارات</h2><p>' + list.length + " زيارة · " + R.items.length + " نشاط فردي · " + fm(R.total) + ' جنيه</p></div><span id="v-sort"></span></div><p class="note sm defn">' + icons.info + "<span><b>الزيارة</b>: خطة المرور لنفس الفريق في نفس اليوم = زيارة واحدة حتى لو تعددت الجهات والصفوف، وأي غرض آخر = كل صف زيارة. <b>النشاط الفردي</b>: مشاركة فرد واحد في صف واحد، وعليه يُحسب المبلغ والسيارة.</span></p>";
    h += '<div class="tw"><table class="vt"><thead><tr><th>اليوم</th><th>جهة المرور والمدينة</th><th>الغرض</th><th>القائمون بالمرور</th><th class="n">المستحق</th></tr></thead><tbody>';
    if (!list.length) h += '<tr><td colspan="5" class="empty">لا نتائج <button class="btn sm" data-clear-all>مسح التصفية</button></td></tr>';
    h += list.slice(0, shown).map(visitRow).join("");
    h += '</tbody></table></div><div class="more" id="v-more">' + (list.length > shown ? '<span class="mut sm">' + shown + " من " + list.length + "</span>" : "") + "</div></section>";
    v.innerHTML = h;
    v.querySelector("#v-sort").appendChild(UI.single({ label: "ترتيب", value: sort, options: Object.entries(SORTS).map(([k, [l]]) => ({ v: k, l })), onChange: s => { S.vsort = s; S.vlimit = 200; saveUi(); visits(v); } }));
    const tb = v.querySelector(".vt tbody"), more = v.querySelector("#v-more");
    vObs && vObs.disconnect();
    if (list.length > shown) {
      vObs = new IntersectionObserver(es => {
        if (!es[0].isIntersecting) return;
        const next = list.slice(shown, shown + 150);
        tb.insertAdjacentHTML("beforeend", next.map(visitRow).join(""));
        shown += next.length; S.vlimit = shown;
        more.innerHTML = shown < list.length ? '<span class="mut sm">' + shown + " من " + list.length + "</span>" : "";
        if (shown >= list.length) vObs.disconnect();
      }, { rootMargin: "600px" });
      vObs.observe(more);
    }
    tb.onclick = e => {
      const b = e.target.closest("[data-person]");
      if (b) { S.filters.people = [b.dataset.person]; S.pview = "statement"; S.tab = "people"; saveUi(); render(); scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (e.target.closest("[data-goset]")) { S.tab = "prices"; saveUi(); render(); requestAnimationFrame(() => document.getElementById("ent-map")?.scrollIntoView({ behavior: "smooth", block: "start" })); }
    };
  }

  const byDate = (a, b) => a.v.d < b.v.d ? -1 : a.v.d > b.v.d ? 1 : a.v.ent.localeCompare(b.v.ent, "ar");
  const withExcluded = (P, R) => S.editMode ? [...P.items, ...R.excluded.filter(it => it.p.key === P.key)].sort(byDate) : [...P.items].sort(byDate);
  const exBox = it => S.editMode ? '<button type="button" class="exbox" data-ex="' + esc(it.id) + '" aria-pressed="' + !S.excl.includes(it.id) + '" aria-label="' + (S.excl.includes(it.id) ? "إعادة البند" : "استبعاد البند") + '">' + icons.check + "</button>" : "";

  function statement(P, R) {
    const items = withExcluded(P, R);
    let rows = "", n = 0;
    for (const it of items) {
      const out = S.excl.includes(it.id);
      it.ls.forEach((l, i) => {
        if (!out) n++;
        rows += '<tr class="' + (i === 0 ? "first" : "cont") + (it.p.car ? " carline" : "") + (out ? " out" : "") + '">' + (i === 0 ? '<td rowspan="' + it.ls.length + '" class="sd"><div class="sd-in">' + exBox(it) + "<div>" + UI.dlabel(it.v.d) + '<span class="mut sm">' + UI.wday(it.v.d) + " · " + esc(it.v.g || CAT[it.v.cat]) + "</span></div></div></td>" : "") + '<td class="st">' + esc(l.t) + (l.ex ? ' <span class="tag d">استثناء</span>' : "") + '</td><td class="mut sm">' + esc(l.note || "") + '</td><td class="n">' + amt(l.a) + "</td></tr>";
      });
    }
    return '<div class="tw"><table class="statement"><thead><tr><th>التاريخ</th><th>البيان</th><th>التفصيل</th><th class="n">المبلغ</th></tr></thead><tbody>' + rows + '<tr class="sumrow"><td colspan="3">الإجمالي · ' + P.visits + " زيارة · " + P.items.length + " نشاط · " + n + " بند" + (P.miss ? ' · <span class="nil">' + P.miss + " بلا سعر</span>" : "") + '</td><td class="n">' + fm(P.sum) + "</td></tr></tbody></table></div>";
  }

  function ledger(P, R) {
    const items = withExcluded(P, R);
    return '<div class="tw"><table class="ledger"><thead><tr><th>اليوم</th><th>جهة المرور</th><th>الغرض</th><th>البنود</th><th class="n">المبلغ</th></tr></thead><tbody>' + items.map(it => '<tr class="' + (S.excl.includes(it.id) ? "out" : "") + '"><td><div class="sd-in">' + exBox(it) + dateCell(it.v.d) + "</div></td><td><b>" + esc(it.v.ent) + '</b><div class="mut sm">' + esc(it.v.city || "مدينة غير معروفة") + (it.v.people.length > 1 ? " · مع " + it.v.people.filter(p => p.key !== P.key).map(p => esc(p.name)).join("، ") : "") + '</div></td><td><span class="tag' + (it.v.cat === "plan" ? " w" : "") + '">' + esc(it.v.g || CAT[it.v.cat]) + "</span>" + (it.p.car ? ' <span class="tag o">' + icons.car + " سيارة</span>" : "") + '</td><td><div class="ln-list">' + it.ls.map(l => '<div class="ln"><span>' + esc(l.t) + "</span><span>" + amt(l.a) + "</span></div>").join("") + '</div></td><td class="n"><b>' + money(it.sum, it.miss) + "</b></td></tr>").join("") + '<tr class="sumrow"><td colspan="4">الإجمالي · ' + P.visits + ' زيارة · ' + P.items.length + ' نشاط</td><td class="n">' + fm(P.sum) + "</td></tr></tbody></table></div>";
  }

  function personHead(P) {
    return '<div class="ph"><div class="who"><div class="avatar">' + esc(P.name.trim().charAt(0)) + '</div><div><h2>' + esc(P.name) + '</h2><div class="row" style="margin-top:6px"><span data-cls-slot="' + esc(P.key) + '"></span></div></div></div><div class="row tags"><span class="tag">' + P.visits + ' زيارة · ' + P.items.length + ' نشاط</span><span class="tag">' + P.plan + " خطة · " + P.insp + ' فحص</span><span class="tag">' + P.car + ' نشاط بالسيارة</span>' + (P.save > 0 ? '<span class="tag sv">وفّرت السيارة ' + fm(P.save) + '</span>' : "") + (P.zero ? '<span class="tag o">' + P.zero + " بلا مبلغ</span>" : "") + '<span class="tag o">' + fm(P.km) + ' كم</span><span class="tag o">انتقال ' + fm(P.k.travel) + '</span><span class="tag o">بدل سفر ' + fm(P.k.allow) + '</span></div><div class="tot"><span class="mut sm">الإجمالي</span><b>' + fm(P.sum) + "</b>" + (P.miss ? '<span class="nil">' + P.miss + " بلا سعر</span>" : '<span class="mut sm">جنيه</span>') + "</div></div>";
  }

  const PSORT = { sum: p => p.sum, name: p => p.name, v: p => p.visits, save: p => p.save, n: p => p.items.length, car: p => p.car, zero: p => p.zero, travel: p => p.k.travel, class: p => p.k.class, service: p => p.k.service, allow: p => p.k.allow, km: p => p.km };
  let psort = { k: "sum", dir: -1 };
  const z = n => n ? fm(n) : '<i class="zdot">·</i>';

  const SHEET_CAP = 8;
  function people(v) {
    const R = currentResult();
    const ps = R.persons;
    const pv = ["table", "statement", "ledger"].includes(S.pview) ? S.pview : "table";
    const picked = S.filters.people.length;
    const scope = IO.scopeLabel();
    let h = '<section class="p-bar" aria-label="عرض الأفراد"><div class="p-info"><b>' + (picked ? picked + " فرد محدد" : "كل الأفراد") + '</b><span class="mut sm">' + (scope ? esc(scope) : "بدون تصفية إضافية") + ' · غيّر ما يظهر من لوحة <button type="button" class="lnk-t" data-open-filters>التصفية</button></span></div><div class="row p-acts"><div class="seg" id="pview" role="group" aria-label="طريقة العرض"><button data-pv="table" aria-pressed="' + (pv === "table") + '">ملخص</button><button data-pv="statement" aria-pressed="' + (pv === "statement") + '">كشف البنود</button><button data-pv="ledger" aria-pressed="' + (pv === "ledger") + '">حسب الزيارة</button></div><button type="button" class="btn sm' + (S.editMode ? " solid" : "") + '" id="p-edit" aria-pressed="' + S.editMode + '">' + icons.sliders + (S.editMode ? "إنهاء الاستبعاد" : "استبعاد بنود") + '</button><button class="btn sm" id="p-xl">' + icons.sheet + 'Excel</button><button class="btn sm solid" id="p-pdf">' + icons.pdf + "كشوف PDF</button></div>" +
      (S.editMode ? '<p class="note sm lens-tip">' + icons.info + "اضغط علامة الصح بجوار أي زيارة لاستبعادها من المبلغ والكشف والطباعة. المستبعد يظهر مشطوباً هنا فقط.</p>" : "") + "</section>";
    if (!ps.length) { v.innerHTML = h + emptyBox("لا يوجد أفراد في هذا العرض"); bindPeople(v, pv); return; }
    const tot = ps.reduce((s, p) => s + p.sum, 0);
    if (pv === "table") {
      const get = PSORT[psort.k] || PSORT.sum;
      const list = [...ps].sort((a, b) => { const x = get(a), y = get(b); return (typeof x === "string" ? x.localeCompare(y, "ar") : x - y) * psort.dir; });
      const th = (k, l, n) => '<th class="' + (n ? "n " : "") + 'sortable' + (psort.k === k ? " on" : "") + '" data-ps="' + k + '" aria-sort="' + (psort.k === k ? (psort.dir > 0 ? "ascending" : "descending") : "none") + '">' + l + (psort.k === k ? '<i class="sd-ar">' + (psort.dir > 0 ? "▲" : "▼") + "</i>" : "") + "</th>";
      const sumK = k => ps.reduce((s, p) => s + p.k[k], 0);
      h += '<section class="panel"><div class="panel-hd"><div><h2>الأفراد</h2><p>' + ps.length + " فرد · " + R.visits.length + " زيارة · " + R.items.length + " نشاط فردي · " + fm(tot) + ' جنيه</p></div></div><div class="tw"><table class="ptbl"><thead><tr>' + th("name", "الاسم") + "<th>الدرجة</th>" + th("v", "زيارات", 1) + th("n", "أنشطة", 1) + th("car", "بالسيارة", 1) + th("save", "وفّرته السيارة", 1) + th("zero", "بلا مبلغ", 1) + th("travel", "انتقال", 1) + th("class", "داخلي", 1) + th("service", "سيرفيس", 1) + th("allow", "بدل سفر", 1) + th("km", "كم", 1) + th("sum", "الإجمالي", 1) + "</tr></thead><tbody>" +
        list.map(p => '<tr><td><button class="lnk-t" data-go="' + esc(p.key) + '">' + esc(p.name) + "</button></td><td>" + CLS_S[p.cls] + '</td><td class="n">' + p.visits + '</td><td class="n">' + p.items.length + '</td><td class="n">' + p.car + '</td><td class="n sv">' + z(Math.round(p.save)) + '</td><td class="n">' + z(p.zero) + '</td><td class="n">' + z(p.k.travel) + '</td><td class="n">' + z(p.k.class) + '</td><td class="n">' + z(p.k.service) + '</td><td class="n">' + z(p.k.allow) + '</td><td class="n mut">' + z(p.km) + '</td><td class="n"><b>' + money(p.sum, p.miss) + "</b></td></tr>").join("") +
        '<tr class="sumrow"><td colspan="2">الإجمالي</td><td class="n">' + R.visits.length + '</td><td class="n">' + R.items.length + '</td><td class="n">' + ps.reduce((s, p) => s + p.car, 0) + '</td><td class="n">' + fm(Math.round(ps.reduce((s, p) => s + p.save, 0))) + '</td><td class="n">' + ps.reduce((s, p) => s + p.zero, 0) + '</td><td class="n">' + fm(sumK("travel")) + '</td><td class="n">' + fm(sumK("class")) + '</td><td class="n">' + fm(sumK("service")) + '</td><td class="n">' + fm(sumK("allow")) + '</td><td class="n">' + fm(ps.reduce((s, p) => s + p.km, 0)) + '</td><td class="n">' + fm(tot) + "</td></tr></tbody></table></div></section>";
    } else {
      const list = ps.slice(0, S.sheetCap || SHEET_CAP);
      for (const P of list) h += '<section class="panel person-sheet">' + personHead(P) + (pv === "ledger" ? ledger(P, R) : statement(P, R)) + "</section>";
      if (ps.length > list.length) h += '<div class="more"><button class="btn" id="p-more">عرض ' + Math.min(SHEET_CAP, ps.length - list.length) + " أفراد آخرين · متبقٍ " + (ps.length - list.length) + "</button></div>";
    }
    v.innerHTML = h;
    bindPeople(v, pv);
  }

  function bindPeople(v, pv) {
    v.querySelector("#p-edit").onclick = () => { S.editMode = !S.editMode; if (S.editMode && S.pview === "table") S.pview = "statement"; saveUi(); people(v); };
    v.onclick = e => {
      const x = e.target.closest("[data-ex]");
      if (x) { const id = x.dataset.ex; toggleExcl([id], !S.excl.includes(id)); return; }
      const t = e.target.closest("[data-ps]");
      if (t) { const k = t.dataset.ps; psort = psort.k === k ? { k, dir: -psort.dir } : { k, dir: k === "name" ? 1 : -1 }; people(v); return; }
      if (e.target.closest("[data-open-filters]")) { S.advOpen = true; saveUi(); FILTERS.sync(); document.getElementById("filter-bar").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (e.target.closest("#p-more")) { S.sheetCap = (S.sheetCap || SHEET_CAP) + SHEET_CAP; people(v); }
    };
    v.querySelector("#pview").onclick = e => { const b = e.target.closest("[data-pv]"); if (b) { S.pview = b.dataset.pv; S.sheetCap = SHEET_CAP; saveUi(); people(v); } };
    v.querySelector("#p-pdf").onclick = () => REPORT.dialog({ summary: true, statements: true, people: [] });
    v.querySelector("#p-xl").onclick = () => IO.exportExcel(currentResult());
    v.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { S.filters.people = [b.dataset.go]; S.pview = "statement"; saveUi(); FILTERS.sync(); update(); scrollTo({ top: 0, behavior: "smooth" }); });
    v.querySelectorAll("[data-cls-slot]").forEach(s => {
      const k = s.dataset.clsSlot;
      s.appendChild(UI.single({ value: S.settings.people[k]?.cls || 3, options: [1, 2, 3].map(c => ({ v: c, l: CLS[c] })), onChange: c => { if (!S.settings.people[k]) S.settings.people[k] = { name: k, cls: c }; S.settings.people[k].cls = c; saveSettings(); rebuild(); update(); UI.toast("✓ " + CLS[c]); } }));
    });
  }

  const numInput = (val, attrs) => '<input class="num" type="text" inputmode="decimal" placeholder="—" ' + attrs + ' value="' + (val == null ? "" : val) + '">';
  const parseNum = s => { s = String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫,]/g, ".").trim(); return s === "" || isNaN(+s) ? null : Math.max(0, +s); };

  function prices(v) {
    const st = S.settings;
    const used = {};
    for (const x of ENG.M.visits) if (x.city) used[x.city] = (used[x.city] || 0) + 1;
    const cities = Object.keys(st.prices).sort((a, b) => (st.prices[b] ?? -1) - (st.prices[a] ?? -1) || a.localeCompare(b, "ar"));
    const cityMode = st.allowMode === "city";
    const ic = icons;
    let h = '<section class="panel io-bar"><div class="panel-hd"><div><h2>الملفات</h2></div><div class="row"><button class="btn sm" id="s-tpl">' + ic.dl + 'قالب</button><button class="btn sm" id="s-full">' + ic.sheet + 'تصدير الكل</button><button class="btn sm solid" id="s-imp">' + ic.upload + "استيراد</button></div></div></section>";

    h += '<div class="grid g3">';
    h += '<section class="panel"><div class="panel-hd"><div><h2>الدرجات</h2></div></div><table class="mini"><thead><tr><th></th><th>داخلي</th><th>بدل سفر</th></tr></thead><tbody>' + [1, 2, 3].map(c => "<tr><td>" + CLS[c] + "</td><td>" + numInput(st.classAmount[c], 'data-cls="' + c + '"') + "</td><td>" + numInput(st.carAllowance[c], 'data-allow="' + c + '"') + "</td></tr>").join("") + "</tbody></table>" +
      '<label class="toggle" style="margin-top:12px"><input type="checkbox" id="s-nearint"' + (st.carNearInternal ? " checked" : "") + '><span class="sw"></span>بالسيارة لمدينة بلا بدل سفر: صرف الداخلي</label><label class="toggle" style="margin-top:8px"><input type="checkbox" id="s-carin"' + (st.carInDamanhour ? " checked" : "") + '><span class="sw"></span>داخل دمنهور بالسيارة: صرف سيرفيس</label></section>';
    h += '<section class="panel"><div class="panel-hd"><div><h2>سيرفيس دمنهور</h2></div></div><div class="stack"><div class="pf set"><label>سعر السيرفيس الواحد</label>' + numInput(st.servicePrice, 'id="s-svc"') + '</div><div class="pf set"><label>العدد الافتراضي</label>' + numInput(st.serviceDefault, 'id="s-svcn"') + '</div><label class="toggle"><input type="checkbox" id="s-exon"' + (st.exceptionsOn ? " checked" : "") + '><span class="sw"></span>استثناءات (عدد مختلف)</label><div class="stack"' + (st.exceptionsOn ? "" : ' style="opacity:.45"') + ">" + st.exceptions.map((x, i) => '<div class="ex-row"><input class="txt" data-exn="' + i + '" value="' + esc(x.name) + '" placeholder="اسم الجهة">' + numInput(x.count, 'data-exc="' + i + '" style="width:60px"') + '<button class="icon-btn sm" data-exd="' + i + '" aria-label="حذف">' + ic.x + "</button></div>").join("") + '<button class="lnk" id="s-exadd">+ إضافة استثناء</button></div></div></section>';
    const zc = {};
    for (const x of ENG.M.visits) if (x.zero) zc[x.ek] = (zc[x.ek] || 0) + 1;
    h += '<section class="panel"><div class="panel-hd"><div><h2>جهات بدون تكلفة</h2></div><label class="toggle"><input type="checkbox" id="s-zon"' + (st.zeroOn ? " checked" : "") + '><span class="sw"></span></label></div><div class="stack"' + (st.zeroOn ? "" : ' style="opacity:.45"') + ">" + st.zeroEntities.map((z, i) => '<div class="ex-row"><input class="txt" data-zn="' + i + '" value="' + esc(z) + '" placeholder="اسم الجهة"><span class="mut sm nw">' + (zc[NZ(z)] || 0) + '</span><button class="icon-btn sm" data-zd="' + i + '" aria-label="حذف">' + ic.x + "</button></div>").join("") + '<button class="lnk" id="s-zadd">+ إضافة جهة</button></div></section></div>';

    h += '<section class="panel"><div class="panel-hd"><div><h2>المدن</h2><p>السعر اتجاه واحد</p></div><div class="row"><div class="seg" id="s-amode"><button data-m="city" aria-pressed="' + cityMode + '">البدل حسب المدينة</button><button data-m="km" aria-pressed="' + !cityMode + '">حسب المسافة</button></div>' + (cityMode ? "" : '<span class="pf set"><label>الحد كم</label>' + numInput(st.farKm, 'id="s-far" style="width:64px"') + "</span>") + '<input class="txt" id="s-newcity" placeholder="مدينة جديدة" style="width:140px"><button class="btn sm" id="s-addcity">إضافة</button></div></div>' +
      '<div class="tw"><table class="city-tbl"><thead><tr><th>المدينة</th><th>السعر</th><th>المسافة كم</th><th>بدل سفر</th><th class="n">زيارات</th></tr></thead><tbody>' +
      cities.map(c => { const f = ENG.isFar(c); return "<tr" + (f ? ' class="far"' : "") + "><td><b>" + esc(c) + "</b></td><td>" + numInput(st.prices[c], 'data-city="' + esc(c) + '"') + "</td><td>" + numInput(st.km[c], 'data-km="' + esc(c) + '"') + "</td><td>" + (cityMode ? '<label class="toggle"><input type="checkbox" data-al="' + esc(c) + '"' + (st.allow[c] ? " checked" : "") + '><span class="sw"></span></label>' : f == null ? '<span class="nil">؟</span>' : f ? '<span class="tag w">يستحق</span>' : '<span class="mut sm">لا</span>') + '</td><td class="n mut">' + (used[c] || "—") + "</td></tr>"; }).join("") + "</tbody></table></div></section>";

    const unk = Object.entries(ENG.M.meta.unknown).sort((a, b) => (a[1].city ? 1 : 0) - (b[1].city ? 1 : 0) || b[1].n - a[1].n);
    const nNone = unk.filter(([, o]) => !o.city).length;
    h += '<section class="panel' + (nNone ? " attn" : "") + '" id="ent-map"><div class="panel-hd"><div><h2>ربط الجهات بالمدن</h2><p>' + (unk.length ? (nNone ? nNone + " جهة بلا مدينة · " : "") + (unk.length - nNone) + " جهة مستنتجة تحتاج تأكيد" : Object.keys(ENTITY_INFO).length + " جهة مدمجة") + (Object.keys(st.entities || {}).length ? " · " + Object.keys(st.entities).length + " معدّلة يدوياً" : "") + "</p></div></div>" + (unk.length ? '<div class="map-grid">' + unk.map(([k, o]) => '<div class="map-item' + (o.city ? " guess" : " none") + '"><span>' + esc(o.l) + "<small>" + o.n + " زيارة" + (o.city ? " · مستنتجة: " + esc(o.city) : "") + '</small></span><span class="row nw">' + (o.city ? '<button class="icon-btn sm" data-okent="' + esc(k) + '" data-city="' + esc(o.city) + '" title="تأكيد" aria-label="تأكيد">' + icons.check + "</button>" : "") + '<span data-ent="' + esc(k) + '"></span></span></div>').join("") + "</div>" : '<p class="note">كل الجهات في الملف مربوطة بمدنها ✓</p>') + "</section>";

    const ppl = Object.entries(st.people).sort((a, b) => a[1].name.localeCompare(b[1].name, "ar"));
    h += '<div class="grid g2"><section class="panel"><div class="panel-hd"><div><h2>درجات الأفراد</h2></div><span id="s-defcls"></span></div><div class="map-grid">' + ppl.map(([k, p]) => '<div class="map-item"><span>' + esc(p.name) + '</span><span data-pcls="' + esc(k) + '"></span></div>').join("") + "</div></section>";
    h += '<section class="panel"><div class="panel-hd"><div><h2>الملف</h2></div></div><div class="stack"><p class="note">«' + esc(S.sheet) + "» · " + S.raw.length + " صف ← " + ENG.M.visits.length + ' زيارة</p><div class="row"><span class="mut">الورقة المفضلة:</span><input class="txt" id="s-pref" value="' + esc(st.sheetPref) + '"></div><div class="row"><button class="btn sm" id="s-clear">مسح الملف المحمل</button><button class="btn sm" id="s-reset">' + ic.reset + "استعادة الإعدادات الافتراضية</button></div></div></section></div>";
    v.innerHTML = h;

    const save = () => { saveSettings(); rebuild(); };
    const redraw = () => { save(); UI.schedule(() => prices(v)); };
    const bind = (sel, fn, re) => v.querySelectorAll(sel).forEach(i => { i.onchange = () => { fn(i, parseNum(i.value)); re ? redraw() : save(); }; i.onkeydown = e => { if (e.key === "Enter") i.blur(); }; });
    bind("[data-cls]", (i, n) => st.classAmount[i.dataset.cls] = n);
    bind("[data-allow]", (i, n) => st.carAllowance[i.dataset.allow] = n);
    bind("[data-city]", (i, n) => st.prices[i.dataset.city] = n);
    bind("[data-km]", (i, n) => st.km[i.dataset.km] = n, !cityMode);
    bind("#s-far", (i, n) => st.farKm = n == null ? FAR_KM : n, true);
    bind("#s-svc", (i, n) => st.servicePrice = n);
    bind("#s-svcn", (i, n) => st.serviceDefault = Math.max(1, Math.round(n || 2)));
    bind("[data-exc]", (i, n) => st.exceptions[+i.dataset.exc].count = Math.max(1, Math.round(n || 4)));
    const chk = (sel, fn) => v.querySelectorAll(sel).forEach(i => i.onchange = () => { fn(i); redraw(); });
    chk("[data-al]", i => st.allow[i.dataset.al] = i.checked);
    chk("#s-nearint", i => st.carNearInternal = i.checked);
    chk("#s-carin", i => st.carInDamanhour = i.checked);
    chk("#s-exon", i => st.exceptionsOn = i.checked);
    chk("#s-zon", i => st.zeroOn = i.checked);
    v.querySelectorAll("[data-exn]").forEach(i => i.onchange = () => { st.exceptions[+i.dataset.exn].name = i.value.trim(); save(); });
    v.querySelectorAll("[data-zn]").forEach(i => i.onchange = () => { st.zeroEntities[+i.dataset.zn] = i.value.trim(); redraw(); });
    v.querySelectorAll("[data-exd]").forEach(b => b.onclick = () => { st.exceptions.splice(+b.dataset.exd, 1); redraw(); });
    v.querySelectorAll("[data-zd]").forEach(b => b.onclick = () => { st.zeroEntities.splice(+b.dataset.zd, 1); redraw(); });
    v.querySelector("#s-exadd").onclick = () => { st.exceptions.push({ name: "", count: 4 }); saveSettings(); prices(v); v.querySelectorAll("[data-exn]").forEach((i, n, a) => n === a.length - 1 && i.focus()); };
    v.querySelector("#s-zadd").onclick = () => { st.zeroEntities.push(""); saveSettings(); prices(v); v.querySelectorAll("[data-zn]").forEach((i, n, a) => n === a.length - 1 && i.focus()); };
    v.querySelector("#s-amode").onclick = e => { const b = e.target.closest("[data-m]"); if (b) { st.allowMode = b.dataset.m; redraw(); } };
    const addCity = () => { const n = v.querySelector("#s-newcity").value.trim(); if (n && !(n in st.prices)) { st.prices[n] = null; st.km[n] = null; st.allow[n] = false; redraw(); } };
    v.querySelector("#s-addcity").onclick = addCity;
    v.querySelector("#s-newcity").onkeydown = e => { if (e.key === "Enter") addCity(); };
    const cityOpts = () => [{ v: DAMANHOUR, l: "دمنهور (داخلي)" }, ...Object.keys(st.prices).sort((a, b) => a.localeCompare(b, "ar")).map(c => ({ v: c, l: c }))];
    const setEnt = (k, c) => {
      st.entities = st.entities || {};
      const unknown = ENG.M.meta.unknown;
      const tok = t => t.split(" ").filter(w => w.length >= 4 && !/^(مستشفي|مركز|معمل|عياده|جمعيه|مدرسه|مدارس|اداره|طلاب|مسائي|عامله|الشامله|التخصصي|المركزي|للاشعه|الطبيه|الحديثه)$/.test(w));
      const mine = tok(k);
      let n = 0;
      st.entities[k] = { ...(st.entities[k] || {}), name: unknown[k]?.l || k, city: c };
      for (const [o, u] of Object.entries(unknown)) {
        if (o === k || u.city || st.entities[o]?.city) continue;
        if (tok(o).some(w => mine.includes(w))) { st.entities[o] = { name: u.l, city: c }; n++; }
      }
      redraw();
      UI.toast("✓ " + c + (n ? " · +" + n + " مشابهة" : ""));
    };
    v.querySelectorAll("[data-ent]").forEach(s => s.appendChild(UI.single({ value: ENG.M.meta.unknown[s.dataset.ent]?.city || null, placeholder: "اختر المدينة", options: cityOpts, onChange: c => setEnt(s.dataset.ent, c) })));
    v.querySelectorAll("[data-okent]").forEach(b => b.onclick = () => setEnt(b.dataset.okent, b.dataset.city));
    const clsOpts = [1, 2, 3].map(c => ({ v: c, l: CLS[c] }));
    v.querySelectorAll("[data-pcls]").forEach(s => s.appendChild(UI.single({ value: st.people[s.dataset.pcls].cls, options: clsOpts, onChange: c => { st.people[s.dataset.pcls].cls = c; save(); } })));
    v.querySelector("#s-defcls").appendChild(UI.single({ label: "للأسماء الجديدة", value: st.defaultClass, options: clsOpts, onChange: c => { st.defaultClass = c; saveSettings(); } }));
    v.querySelector("#s-pref").onchange = e => { st.sheetPref = e.target.value.trim() || "الاصلي"; saveSettings(); };
    v.querySelector("#s-tpl").onclick = () => IO.template(false);
    v.querySelector("#s-full").onclick = () => IO.template(true);
    v.querySelector("#s-imp").onclick = () => document.getElementById("file-input").click();
    v.querySelector("#s-clear").onclick = async () => { if (await UI.confirm("مسح الملف المحمل؟", "ستُحذف بيانات الزيارات من هذا المتصفح. الإعدادات والأسعار تبقى كما هي.", "مسح", true)) { const snap = { raw: S.raw, file: S.file, sheet: S.sheet }; S.raw = []; localStorage.removeItem(KEY.data); S.tab = "dash"; rebuild(); render(); UI.toast("تم مسح الملف", { action: "تراجع", onAction: () => { Object.assign(S, snap); saveData(); rebuild(); render(); } }); } };
    v.querySelector("#s-reset").onclick = async () => { if (await UI.confirm("استعادة الإعدادات الافتراضية؟", "ستعود الأسعار والمسافات والدرجات والقوائم للقيم الافتراضية. درجات الأفراد تبقى.", "استعادة", true)) { const snap = JSON.stringify(st); const people = st.people; S.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); S.settings.people = people; redraw(); UI.toast("تمت الاستعادة", { action: "تراجع", onAction: () => { S.settings = JSON.parse(snap); saveSettings(); rebuild(); render(); } }); } };
  }

  return { welcome, dash, visits, people, prices };
})();
