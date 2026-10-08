const REPORT = (() => {
  const { esc, fm2, icons } = UI;
  const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const HUND = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  const CLS = ["", "الأولى", "الثانية", "الثالثة"];

  function under1000(n) {
    const h = Math.floor(n / 100), r = n % 100, parts = [];
    if (h) parts.push(HUND[h]);
    if (r) {
      if (r < 20) parts.push(ONES[r]);
      else { const o = r % 10, t = Math.floor(r / 10); parts.push(o ? ONES[o] + " و" + TENS[t] : TENS[t]); }
    }
    return parts.join(" و");
  }
  function scale(n, one, two, few, many) {
    if (!n) return "";
    if (n === 1) return one;
    if (n === 2) return two;
    if (n <= 10) return under1000(n) + " " + few;
    return under1000(n) + " " + many;
  }
  function words(n) {
    n = Math.floor(n);
    if (!n) return "صفر";
    const mil = Math.floor(n / 1e6), th = Math.floor(n % 1e6 / 1000), rest = n % 1000;
    return [scale(mil, "مليون", "مليونان", "ملايين", "مليون"), scale(th, "ألف", "ألفان", "آلاف", "ألف"), rest ? under1000(rest) : ""].filter(Boolean).join(" و");
  }
  function tafqit(v) {
    const cents = Math.round(v * 100), pounds = Math.floor(cents / 100), pi = cents % 100;
    let s = "فقط " + words(pounds) + " جنيهاً";
    if (pi) s += " و" + words(pi) + " قرشاً";
    return s + " لا غير";
  }

  const ROWS_FIRST = 24, ROWS_CONT = 31, CLOSE_ROWS = 8, SUM_FIRST = 18, SUM_CONT = 28;
  const amt = a => a == null ? '<span class="r-nil">غير محدد</span>' : fm2(a);

  function refNo(R) {
    let h = 0;
    for (const it of R.items) { const s = it.v.id + it.p.key; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; }
    return "ADD-" + UI.today().slice(0, 7).replace("-", "") + "-" + (h % 46656).toString(36).toUpperCase().padStart(3, "0");
  }

  function header(st, title, sub, ref) {
    return '<header class="r-head"><div class="r-org">' + UI.logo() + '<div><b>' + esc(st.org.name) + "</b><span>" + esc(st.org.branch) + '</span></div></div><div class="r-title"><h1>' + esc(title) + "</h1><p>" + esc(sub) + '</p></div><div class="r-meta"><div><span>رقم المرجع</span><b>' + esc(ref) + '</b></div><div><span>تاريخ الإصدار</span><b>' + UI.dlabel(UI.today()) + "</b></div></div></header>";
  }
  const footer = (st, n, tot) => '<footer class="r-foot"><span>' + esc(st.org.name) + " · " + esc(st.org.branch) + "</span><span>صفحة " + n + " من " + tot + "</span></footer>";
  const signs = (list, extra) => '<div class="r-signs">' + [...(extra ? [extra] : []), ...list.filter(Boolean)].map(s => '<div><span>' + esc(s) + "</span><i></i><small>الاسم: ............................</small></div>").join("") + "</div>";

  function summaryPages(R, st, period, ref) {
    const t = R.persons.reduce((o, p) => { for (const k in p.k) o[k] += p.k[k]; o.n += p.items.length; o.car += p.car; o.miss += p.miss; return o; }, { travel: 0, class: 0, service: 0, allow: 0, n: 0, car: 0, miss: 0 });
    const chunks = [];
    let i = 0;
    while (i < R.persons.length || !chunks.length) { const size = chunks.length ? SUM_CONT : SUM_FIRST; chunks.push(R.persons.slice(i, i + size)); i += size; }
    const lastRoom = (chunks.length === 1 ? SUM_FIRST : SUM_CONT) - chunks[chunks.length - 1].length;
    const closeSeparate = lastRoom < 9;
    const pages = [];
    let idx = 0;
    const thead = '<thead><tr><th class="c-n">م</th><th>الاسم</th><th>الدرجة</th><th class="c-r">الزيارات</th><th class="c-r">انتقال</th><th class="c-r">داخلي</th><th class="c-r">سيرفيس</th><th class="c-r">بدل سفر</th><th class="c-r">الإجمالي</th><th class="c-sig">التوقيع</th></tr></thead>';
    const tfoot = '<tfoot><tr><td colspan="3">الإجمالي العام</td><td class="c-r">' + t.n + '</td><td class="c-r">' + fm2(t.travel) + '</td><td class="c-r">' + fm2(t.class) + '</td><td class="c-r">' + fm2(t.service) + '</td><td class="c-r">' + fm2(t.allow) + '</td><td class="c-r">' + fm2(R.total) + "</td><td></td></tr></tfoot>";
    const closing = '<div class="r-close"><div class="r-words"><span>المبلغ الإجمالي</span><b>' + fm2(R.total) + " جنيه</b><p>" + tafqit(R.total) + "</p></div>" + (t.miss ? '<p class="r-warn">ملاحظة: يوجد ' + t.miss + " بند بلا سعر محدد ولم يُحتسب ضمن الإجمالي.</p>" : "") + signs(st.org.signs) + "</div>";
    chunks.forEach((ch, ci) => {
      let h = '<section class="r-page">' + header(st, st.org.title, period + (ci ? " · تابع" : ""), ref) + '<div class="r-body">';
      if (ci === 0) {
        h += '<div class="r-kpis"><div><span>عدد الزيارات</span><b>' + R.visits.length + "</b></div><div><span>عدد الأفراد</span><b>" + R.persons.length + "</b></div><div><span>مشاركات بالسيارة</span><b>" + t.car + " <small>من " + t.n + '</small></b></div><div class="hero"><span>إجمالي المستحق</span><b>' + fm2(R.total) + " <small>جنيه</small></b></div></div>";
        h += '<div class="r-break">' + [["انتقال ذهاب وعودة", t.travel], ["بدل داخلي", t.class], ["سيرفيس دمنهور", t.service], ["بدل سفر بالسيارة", t.allow]].map(([l, a]) => "<div><span>" + l + "</span><b>" + fm2(a) + '</b><i style="--w:' + (R.total ? Math.round(a / R.total * 100) : 0) + '%"></i></div>').join("") + "</div>";
      }
      h += '<table class="r-tbl r-sum">' + thead + "<tbody>" + ch.map(p => { idx++; return '<tr><td class="c-n">' + idx + "</td><td><b>" + esc(p.name) + "</b></td><td>" + CLS[p.cls] + '</td><td class="c-r">' + p.items.length + '</td><td class="c-r">' + fm2(p.k.travel) + '</td><td class="c-r">' + fm2(p.k.class) + '</td><td class="c-r">' + fm2(p.k.service) + '</td><td class="c-r">' + fm2(p.k.allow) + '</td><td class="c-r"><b>' + fm2(p.sum) + "</b>" + (p.miss ? '<small class="r-nil">+' + p.miss + " بلا سعر</small>" : "") + '</td><td class="c-sig"></td></tr>'; }).join("") + "</tbody>" + (ci === chunks.length - 1 ? tfoot : "") + "</table>";
      if (ci === chunks.length - 1 && !closeSeparate) h += closing;
      h += "</div>";
      pages.push(h);
    });
    if (closeSeparate) pages.push('<section class="r-page">' + header(st, st.org.title, period + " · تابع", ref) + '<div class="r-body">' + closing + "</div>");
    return pages;
  }

  function personPages(P, st, period, ref) {
    const items = [...P.items].sort((a, b) => a.v.d < b.v.d ? -1 : a.v.d > b.v.d ? 1 : a.v.ent.localeCompare(b.v.ent, "ar"));
    const chunks = [[]];
    let room = ROWS_FIRST;
    for (const it of items) {
      const n = it.ls.length;
      if (n > room) { chunks.push([]); room = ROWS_CONT; }
      chunks[chunks.length - 1].push(it);
      room -= n;
    }
    const closeSeparate = room < CLOSE_ROWS;
    const nLines = items.reduce((s, it) => s + it.ls.length, 0);
    const carry = [];
    let run = 0;
    chunks.forEach(ch => { for (const it of ch) run += it.sum; carry.push(run); });
    const thead = '<thead><tr><th class="c-n">م</th><th class="c-date">التاريخ</th><th>البيان</th><th>التفصيل</th><th class="c-r">المبلغ</th></tr></thead>';
    const closing = '<div class="r-close"><div class="r-words"><span>صافي المستحق</span><b>' + fm2(P.sum) + " جنيه</b><p>" + tafqit(P.sum) + "</p></div>" + (P.miss ? '<p class="r-warn">ملاحظة: ' + P.miss + " بند بلا سعر محدد ولم يُحتسب.</p>" : "") + '<p class="r-decl">أقر بصحة البيانات الواردة أعلاه وأن الانتقالات تمت فعلياً لأداء أعمال رسمية.</p>' + signs(st.org.signs, "توقيع المستحق") + "</div>";
    let seq = 0;
    const pages = chunks.map((ch, ci) => {
      let h = '<section class="r-page">' + header(st, "كشف بدل انتقال · " + P.name, period + (ci ? " · تابع" : ""), ref) + '<div class="r-body">';
      if (ci === 0) h += '<div class="r-person"><div class="big"><span>الاسم</span><b>' + esc(P.name) + "</b></div><div><span>الدرجة</span><b>" + CLS[P.cls] + "</b></div><div><span>الزيارات</span><b>" + items.length + "</b></div><div><span>بسيارة الهيئة</span><b>" + P.car + "</b></div><div><span>المسافة</span><b>" + UI.fm(P.km) + " <small>كم</small></b></div></div>";
      h += '<table class="r-tbl r-stmt">' + thead + "<tbody>";
      if (ci > 0) h += '<tr class="r-carry"><td colspan="4">رصيد منقول من الصفحة السابقة</td><td class="c-r">' + fm2(carry[ci - 1]) + "</td></tr>";
      for (const it of ch) {
        seq++;
        it.ls.forEach((l, i) => {
          h += '<tr class="' + (i ? "cont" : "first") + '">' + (i === 0 ? '<td class="c-n" rowspan="' + it.ls.length + '">' + seq + '</td><td class="c-date" rowspan="' + it.ls.length + '"><b>' + UI.dlabel(it.v.d) + "</b><small>" + UI.wday(it.v.d) + (it.v.g ? " · " + esc(it.v.g) : "") + "</small></td>" : "") + '<td class="c-t">' + esc(l.t) + '</td><td class="r-note">' + esc(l.note || "") + '</td><td class="c-r">' + amt(l.a) + "</td></tr>";
        });
      }
      h += "</tbody>";
      if (ci < chunks.length - 1) h += '<tfoot class="sub"><tr><td colspan="4">يُنقل إلى الصفحة التالية</td><td class="c-r">' + fm2(carry[ci]) + "</td></tr></tfoot>";
      else h += '<tfoot><tr><td colspan="4">الإجمالي · ' + items.length + " زيارة · " + nLines + ' بند</td><td class="c-r">' + fm2(P.sum) + "</td></tr></tfoot>";
      h += "</table>";
      if (ci === chunks.length - 1 && !closeSeparate) h += closing;
      return h + "</div>";
    });
    if (closeSeparate) pages.push('<section class="r-page">' + header(st, "كشف بدل انتقال · " + P.name, period + " · تابع", ref) + '<div class="r-body">' + closing + "</div>");
    return pages;
  }

  const AR_DIG = "٠١٢٣٤٥٦٧٨٩";
  function arabicDigits(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.parentElement && n.parentElement.closest(".r-ref-latin")) continue;
      n.nodeValue = n.nodeValue.replace(/(\d),(\d)/g, "$1٬$2").replace(/(\d)\.(\d)/g, "$1٫$2").replace(/\d/g, d => AR_DIG[d]);
    }
  }

  function build(R, opts) {
    const st = S.settings, scope = IO.scopeLabel(), period = IO.periodLabel() + (scope ? " · " + scope : "");
    const people = opts.people.length ? R.persons.filter(p => opts.people.includes(p.key)) : R.persons;
    const vs = new Set(), items = [];
    for (const p of people) for (const it of p.items) { vs.add(it.v); items.push(it); }
    const R2 = { ...R, persons: people, visits: [...vs], items, total: people.reduce((s, p) => s + p.sum, 0) };
    const ref = refNo(R2);
    let pages = [];
    if (opts.summary) pages = pages.concat(summaryPages(R2, st, period, ref));
    if (opts.statements) for (const p of people) pages = pages.concat(personPages(p, st, period, ref));
    const tot = pages.length;
    return { html: pages.map((p, i) => p + footer(st, i + 1, tot) + "</section>").join(""), pages: tot, ref };
  }

  function render(host, R, opts) {
    const out = build(R, opts);
    host.innerHTML = out.html;
    host.querySelectorAll(".r-meta b").forEach(b => { if (/^ADD-/.test(b.textContent)) b.classList.add("r-ref-latin"); });
    if (opts.arabic) arabicDigits(host);
    return out;
  }

  async function printReport(opts) {
    const R = currentResult();
    let host = document.getElementById("report");
    if (!host) { host = document.createElement("div"); host.id = "report"; document.body.appendChild(host); }
    const o = { summary: true, statements: true, people: [], arabic: !!S.settings.org.arabicDigits, ...opts };
    const out = render(host, R, o);
    document.body.classList.add("printing");
    const prevTitle = document.title;
    document.title = (S.settings.org.title || "report") + " - " + IO.periodName();
    const done = () => { document.body.classList.remove("printing"); host.innerHTML = ""; document.title = prevTitle; removeEventListener("afterprint", done); };
    addEventListener("afterprint", done);
    const imgs = [...host.querySelectorAll("img")];
    await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    setTimeout(() => print(), 60);
    return out;
  }

  function dialog(preset = {}) {
    const R = currentResult();
    if (!R.persons.length) return UI.toast("لا توجد بيانات في التصفية الحالية", { error: true });
    const st = S.settings;
    const o = { summary: preset.summary ?? true, statements: preset.statements ?? true, people: preset.people || [], arabic: !!st.org.arabicDigits };
    const m = UI.modal("PDF", '<div class="rp"><aside class="rp-side">' +
      '<div class="rp-sec"><h4>المحتوى</h4><label class="toggle"><input type="checkbox" id="rp-sum"' + (o.summary ? " checked" : "") + '><span class="sw"></span>الملخص</label><label class="toggle"><input type="checkbox" id="rp-stm"' + (o.statements ? " checked" : "") + '><span class="sw"></span>كشف لكل فرد</label><label class="toggle"><input type="checkbox" id="rp-ar"' + (o.arabic ? " checked" : "") + '><span class="sw"></span>أرقام عربية (١٢٣)</label></div>' +
      '<div class="rp-sec"><h4>الأفراد</h4><div id="rp-people"></div></div>' +
      '<div class="rp-sec"><h4>الترويسة</h4><label class="fl"><span>الجهة</span><input class="txt" id="rp-org" value="' + esc(st.org.name) + '"></label><label class="fl"><span>الفرع / الإدارة</span><input class="txt" id="rp-br" value="' + esc(st.org.branch) + '"></label><label class="fl"><span>عنوان الكشف</span><input class="txt" id="rp-title" value="' + esc(st.org.title) + '"></label><label class="fl"><span>التوقيعات (مفصولة بفاصلة)</span><input class="txt" id="rp-signs" value="' + esc(st.org.signs.join("، ")) + '"></label></div>' +
      '</aside><div class="rp-prev"><div class="rp-bar"><span id="rp-info" class="mut sm"></span><span class="row"><button type="button" class="icon-btn sm" data-z="-1" aria-label="تصغير">−</button><button type="button" class="icon-btn sm" data-z="1" aria-label="تكبير">+</button></span></div><div class="rp-scroll"><div id="rp-pages" class="rp-pages"></div></div></div></div>',
      '<button class="btn" id="rp-xl">' + icons.sheet + 'Excel</button><button class="btn solid" id="rp-go">' + icons.print + "طباعة / PDF</button>", { cls: "xl", onClose: () => removeEventListener("resize", fit), sub: esc(IO.periodLabel()) + (IO.scopeLabel() ? " · " + esc(IO.scopeLabel()) : "") + " · " + R.visits.length + " زيارة · " + R.items.length + " مشاركة · " + R.persons.length + " فرد" });
    const pagesEl = m.querySelector("#rp-pages");
    let zoom = UI.mobile() ? .42 : .62;
    const fit = () => { const w = m.querySelector(".rp-scroll").clientWidth - 24; const base = w / (210 * 3.78); zoom = Math.max(.3, Math.min(1, base)); pagesEl.style.setProperty("--z", zoom); };
    const refresh = UI.debounce(() => {
      const out = render(pagesEl, R, o);
      m.querySelector("#rp-info").textContent = out.pages + " صفحة · A4";
      m.querySelector("#rp-go").disabled = !o.summary && !o.statements;
    }, 60);
    m.querySelector("#rp-people").appendChild(UI.multi({ label: "", allLabel: "كل الأفراد (" + R.persons.length + ")", value: o.people, cls: "block", options: () => R.persons.map(p => ({ v: p.key, l: p.name, sub: UI.fm(p.sum) })), onChange: v => { o.people = v; refresh(); } }));
    const saveOrg = () => {
      st.org = { ...st.org, name: m.querySelector("#rp-org").value.trim(), branch: m.querySelector("#rp-br").value.trim(), title: m.querySelector("#rp-title").value.trim() || "كشف بدلات الانتقال والسفر", signs: m.querySelector("#rp-signs").value.split(/[،,]/).map(s => s.trim()).filter(Boolean), arabicDigits: o.arabic };
      saveSettings();
    };
    m.querySelector(".rp-side").addEventListener("input", UI.debounce(() => { saveOrg(); refresh(); }, 200));
    m.querySelector("#rp-sum").onchange = e => { o.summary = e.target.checked; refresh(); };
    m.querySelector("#rp-stm").onchange = e => { o.statements = e.target.checked; refresh(); };
    m.querySelector("#rp-ar").onchange = e => { o.arabic = e.target.checked; saveOrg(); refresh(); };
    m.querySelector(".rp-bar").onclick = e => { const b = e.target.closest("[data-z]"); if (!b) return; zoom = Math.max(.25, Math.min(1.4, zoom + +b.dataset.z * .1)); pagesEl.style.setProperty("--z", zoom); };
    m.querySelector("#rp-go").onclick = () => { saveOrg(); if (!o.summary && !o.statements) return UI.toast("اختر صفحة واحدة على الأقل", { error: true }); m.close(); printReport({ ...o }); };
    m.querySelector("#rp-xl").onclick = () => { saveOrg(); const r = currentResult(); if (o.people.length) r.persons = r.persons.filter(p => o.people.includes(p.key)); IO.exportExcel(r); };
    requestAnimationFrame(() => { fit(); refresh(); });
    addEventListener("resize", fit);
  }

  return { dialog, printReport, tafqit, header, footer, arabicDigits };
})();
