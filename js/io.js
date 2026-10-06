const IO = (() => {
  const { esc, icons } = UI;
  const CLS_AR = { 1: "الأولى", 2: "الثانية", 3: "الثالثة" };
  const clsFrom = v => { const z = NZ(v); if (/^1$|اول/.test(z)) return 1; if (/^2$|ثان|تان/.test(z)) return 2; if (/^3$|ثالث/.test(z)) return 3; return null; };
  const num = v => { if (v == null || v === "") return null; const n = +String(v).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫,]/g, "."); return isNaN(n) ? null : n; };
  const bool = v => v === true || v === 1 || /^(true|1|yes|نعم|✓|صح)$/i.test(String(v == null ? "" : v).trim());
  const stamp = () => UI.today();
  const FIELD = { d: "التاريخ", e: "جهة المرور", g: "الغرض", p: "القائمون بالمرور", c: "سيارة الهيئة" };

  function settingsSheets() {
    const st = S.settings;
    const cities = Object.keys(st.prices).sort((a, b) => (st.km[b] ?? -1) - (st.km[a] ?? -1));
    const ents = { ...Object.fromEntries(Object.entries(ENTITY_INFO).map(([k, o]) => [k, o])) };
    for (const [k, o] of Object.entries(st.entities || {})) ents[k] = { ...(ents[k] || { name: o.name || k }), ...o };
    return [
      { name: "المدن", cols: [22, 12, 12, 10], rows: [["المدينة", "السعر", "المسافة", "بدل سفر"], ...cities.map(c => [c, st.prices[c], st.km[c], !!st.allow[c]])] },
      { name: "الجهات", cols: [36, 18, 16], rows: [["الجهة", "النوع", "المدينة"], ...Object.values(ents).sort((a, b) => String(a.city).localeCompare(String(b.city), "ar")).map(o => [o.name, o.type || "", o.city || ""])] },
      { name: "الافراد", cols: [20, 10], rows: [["الاسم", "الدرجة"], ...Object.values(st.people).sort((a, b) => a.name.localeCompare(b.name, "ar")).map(p => [p.name, p.cls])] },
      { name: "الدرجات", cols: [12, 14, 14], rows: [["الدرجة", "بدل داخلي", "بدل سفر"], ...[1, 2, 3].map(c => [c, st.classAmount[c], st.carAllowance[c]])] },
      { name: "بدون تكلفة", cols: [30], rows: [["الجهة"], ...st.zeroEntities.filter(Boolean).map(z => [z])] },
      { name: "استثناءات السيرفيس", cols: [30, 12], rows: [["الجهة", "عدد السيرفيس"], ...st.exceptions.filter(x => x.name).map(x => [x.name, x.count])] }
    ];
  }

  function template(withData) {
    const head = ["اليوم", "جهة المرور", "الغرض من المرور", "القائم بالمرور", "سيارة الهيئة"];
    const rows = withData && S.raw.length
      ? S.raw.map(r => [r.d, r.ent, r.g, r.people.join(" - "), !!r.car])
      : [["2026-04-07", "ابو المطامير", "خطة المرور", "هنداوي - اديب", true], ["2026-04-09", "المخازن الغير طبية", "خطة المرور", "اماني - اباظة", false], ["2026-04-10", "مستشفي ايتاي", "فحص", "مريم", false]];
    const sheets = [{ name: "الاصلي", cols: [14, 30, 20, 40, 12], rows: [head, ...rows] }, ...settingsSheets()];
    UI.download((withData ? "addad-data_" : "addad-template_") + stamp() + ".xlsx", XL.write(sheets));
    UI.toast("✓ تم التنزيل");
  }

  function findSheet(sheets, name) { return sheets.find(s => NZ(s.name) === NZ(name)); }
  const body = s => (s.rows || []).slice(1).filter(r => r && r.some(x => x != null && x !== ""));

  function readSettings(sheets) {
    const out = [];
    const c = findSheet(sheets, "المدن");
    if (c) out.push({ key: "cities", label: "المدن (السعر · المسافة · بدل السفر)", n: body(c).length, apply: st => { for (const r of body(c)) { const n = String(r[0] || "").trim(); if (!n) continue; const name = canonCity(n); st.prices[name] = num(r[1]); st.km[name] = num(r[2]); st.allow[name] = bool(r[3]); } } });
    const e = findSheet(sheets, "الجهات");
    if (e) out.push({ key: "ents", label: "الجهات (النوع · المدينة)", n: body(e).length, apply: st => { st.entities = st.entities || {}; for (const r of body(e)) { const n = String(r[0] || "").trim(); if (!n) continue; const k = NZ(n); const base = ENTITY_INFO[k]; const o = { name: n, type: String(r[1] || "").trim() || (base && base.type) || UNTYPED, city: r[2] ? canonCity(String(r[2]).trim()) : (base && base.city) || null }; if (!base || base.type !== o.type || base.city !== o.city) st.entities[k] = o; } } });
    const p = findSheet(sheets, "الافراد");
    if (p) out.push({ key: "people", label: "الأفراد ودرجاتهم", n: body(p).length, apply: st => { for (const r of body(p)) { const n = String(r[0] || "").trim(); if (!n) continue; st.people[ENG.personKey(n)] = { name: n, cls: clsFrom(r[1]) || st.defaultClass }; } } });
    const g = findSheet(sheets, "الدرجات");
    if (g) out.push({ key: "grades", label: "مبالغ الدرجات", n: body(g).length, apply: st => { for (const r of body(g)) { const c = clsFrom(r[0]); if (!c) continue; st.classAmount[c] = num(r[1]); st.carAllowance[c] = num(r[2]); } } });
    const z = findSheet(sheets, "بدون تكلفة");
    if (z) out.push({ key: "zero", label: "جهات بدون تكلفة", n: body(z).length, apply: st => { st.zeroEntities = body(z).map(r => String(r[0] || "").trim()).filter(Boolean); } });
    const x = findSheet(sheets, "استثناءات السيرفيس");
    if (x) out.push({ key: "exc", label: "استثناءات السيرفيس", n: body(x).length, apply: st => { st.exceptions = body(x).map(r => ({ name: String(r[0] || "").trim(), count: num(r[1]) || 4 })).filter(o => o.name); } });
    return out;
  }

  async function readFile(f) {
    const isCsv = /\.(csv|txt|tsv)$/i.test(f.name);
    if (/\.xls$/i.test(f.name)) throw new Error("xls");
    const sheets = isCsv ? XL.csv(await f.text()) : await XL.read(await f.arrayBuffer());
    return { sheets, isCsv };
  }

  async function load(f) {
    let data;
    try { data = await readFile(f); }
    catch (e) {
      console.error(e);
      UI.toast(e.message === "xls" ? "صيغة xls القديمة غير مدعومة — احفظ الملف بصيغة xlsx" : "تعذّر قراءة الملف — تأكد أنه xlsx أو csv", { error: true });
      return;
    }
    const res = ENG.analyze(data.sheets);
    const sets = data.isCsv ? [] : readSettings(data.sheets);
    const good = res.filter(r => r.ok);
    if (!res.length && !sets.length) return UI.toast("لم أجد جدول زيارات أو إعدادات في الملف", { error: true });
    const highConf = good.length === 1 && !sets.length && (good[0].remembered || ["d", "e", "p"].every(k => (good[0].conf[k] || 0) >= .6)) && good[0].quality > .85;
    if (highConf && !S.raw.length) return commit([good[0]], f.name, [], "replace");
    review(f.name, res, sets);
  }

  function review(file, res, sets) {
    const state = res.map((r, i) => ({ r, on: r.ok && (i === 0 || (r.quality > .8 && r.rows.length > 5)), open: !r.ok || (i === 0 && ENG.HEAD_KEYS.some(k => (k === "d" || k === "e" || k === "p") && (r.conf[k] || 0) < .6)) }));
    let mode = "replace";
    const m = UI.modal("استيراد «" + file + "»", '<div id="imp-body"></div>', '<button class="btn" data-x>إلغاء</button><button class="btn solid" id="imp-go">استيراد</button>', { cls: "wide" });
    const host = m.querySelector("#imp-body");

    function sheetCard(s, i) {
      const r = s.r, st = r.stat;
      const hdrs = ENG.headersOf(r);
      const conf = k => r.cols[k] == null ? "miss" : (r.conf[k] || 0) >= .6 ? "ok" : "low";
      const months = r.months || [];
      const issues = [];
      if (r.missing.length) issues.push("ينقص: " + r.missing.map(k => FIELD[k]).join("، "));
      if (st) {
        if (st.noDate) issues.push(st.noDate + " بلا تاريخ");
        if (st.noPeople) issues.push(st.noPeople + " بلا أسماء");
        if (st.totals) issues.push(st.totals + " إجمالي مُتجاهَل");
        if (st.filled) issues.push(st.filled + " تاريخ مُكمَل");
        if (st.yearGuess) issues.push(st.yearGuess + " سنة مُستنتجة");
        if (st.carMarks) issues.push(st.carMarks + " «بالسيارة» من الأسماء");
        if (r.remembered) issues.push("أعمدة محفوظة من ملف سابق");
      }
      const sample = r.rows.slice(0, 4);
      return '<article class="imp-sheet' + (s.on ? " on" : "") + (r.ok ? "" : " bad") + '" data-si="' + i + '">' +
        '<header><label class="chk"><input type="checkbox" data-on="' + i + '"' + (s.on ? " checked" : "") + (r.ok ? "" : " disabled") + '><span class="box">' + icons.check + '</span><span><b>' + esc(r.name) + '</b><small>' + (r.ok ? r.rows.length + "/" + (st ? st.rows : r.rows.length) + " صف" + (months.length ? " · " + (months.length === 1 ? UI.mlabel(months[0]) : UI.mlabel(months[0]) + " ← " + UI.mlabel(months[months.length - 1])) : "") : "ليست جدول زيارات") + "</small></span></label>" +
        (r.ok ? '<span class="q-badge ' + (r.quality > .9 ? "hi" : r.quality > .6 ? "md" : "lo") + '">' + Math.round(r.quality * 100) + "%</span>" : "") +
        '<button type="button" class="lnk" data-tog="' + i + '">' + "الأعمدة" + icons.chevD + "</button></header>" +
        (s.open ? '<div class="imp-map">' + ENG.HEAD_KEYS.map(k => '<div class="map-f ' + conf(k) + '"><span><i></i>' + FIELD[k] +  + '</span><span data-col="' + i + ":" + k + '"></span></div>').join("") + '<div class="map-f"><span>التاريخ</span><span class="seg sm" data-ord="' + i + '"><button type="button" data-o="dmy" aria-pressed="' + (r.order !== "mdy") + '">يوم/شهر</button><button type="button" data-o="mdy" aria-pressed="' + (r.order === "mdy") + '">شهر/يوم</button></span></div></div>' +
          (sample.length ? '<div class="tw imp-prev"><table><thead><tr><th>التاريخ</th><th>الجهة</th><th>الغرض</th><th>الأفراد</th><th>سيارة</th></tr></thead><tbody>' + sample.map(x => "<tr><td>" + esc(UI.dlabel(x.d)) + "</td><td>" + esc(x.ent) + "</td><td>" + esc(x.g) + "</td><td>" + esc(x.people.join("، ")) + "</td><td>" + (x.car ? "✓" : x.cp ? esc(x.cp.join("، ")) : "—") + "</td></tr>").join("") + "</tbody></table></div>" : "") : "") +
        (issues.length ? '<ul class="imp-issues">' + issues.map(t => "<li>" + esc(t) + "</li>").join("") + "</ul>" : "") +
        "</article>";
    }

    function draw() {
      const picked = state.filter(s => s.on);
      const total = picked.reduce((a, s) => a + s.r.rows.length, 0);
      let h = "";
      if (res.length) h += '<div class="imp-list">' + state.map(sheetCard).join("") + "</div>";
      if (S.raw.length && picked.length) h += '<div class="imp-mode"><span class="mut">الحالي (' + S.raw.length + '):</span><div class="seg" id="imp-mode"><button type="button" data-md="replace" aria-pressed="' + (mode === "replace") + '">استبدال</button><button type="button" data-md="append" aria-pressed="' + (mode === "append") + '">دمج</button></div></div>';
      if (sets.length) h += '<h3 class="imp-h">إعدادات</h3><div class="stack">' + sets.map((s, i) => '<label class="toggle"><input type="checkbox" data-set="' + i + '" checked><span class="sw"></span>' + esc(s.label) + ' <span class="mut sm">(' + s.n + " صف)</span></label>").join("") + "</div>";
      const keepSets = [...host.querySelectorAll("[data-set]")].map(x => x.checked);
      host.innerHTML = h;
      keepSets.forEach((v, i) => { const x = host.querySelector('[data-set="' + i + '"]'); if (x) x.checked = v; });
      host.querySelectorAll("[data-col]").forEach(slot => {
        const [i, k] = slot.dataset.col.split(":");
        const r = state[+i].r;
        slot.appendChild(UI.single({ value: r.cols[k] ?? -1, placeholder: "غير موجود", options: () => [{ v: -1, l: "— بدون —" }, ...ENG.headersOf(r).map(o => ({ v: o.i, l: o.l }))], onChange: v => { const cols = { ...r.cols }; if (v === -1) delete cols[k]; else { for (const kk in cols) if (cols[kk] === v) delete cols[kk]; cols[k] = v; } const nr = ENG.remap(r, cols); nr.conf = { ...r.conf, [k]: 1 }; state[+i].r = nr; state[+i].on = nr.ok; draw(); } }));
      });
      const go = m.querySelector("#imp-go");
      const nSets = [...host.querySelectorAll("[data-set]")].filter(x => x.checked).length;
      go.disabled = !total && !nSets;
      go.textContent = "استيراد" + (total ? " " + total : "") + (nSets ? " + " + nSets : "");
    }
    draw();
    host.addEventListener("click", e => {
      const t = e.target.closest("[data-tog]");
      if (t) { state[+t.dataset.tog].open = !state[+t.dataset.tog].open; return draw(); }
      const o = e.target.closest("[data-o]");
      if (o) { const i = +o.closest("[data-ord]").dataset.ord; const r = state[i].r; state[i].r = { ...ENG.remap(r, r.cols, o.dataset.o), conf: r.conf }; return draw(); }
      const md = e.target.closest("[data-md]");
      if (md) { mode = md.dataset.md; return draw(); }
    });
    host.addEventListener("change", e => {
      const c = e.target.closest("[data-on]");
      if (c) { state[+c.dataset.on].on = c.checked; draw(); }
      if (e.target.closest("[data-set]")) draw();
    });
    m.querySelector("#imp-go").onclick = () => {
      const chosen = [...host.querySelectorAll("[data-set]")].filter(i => i.checked).map(i => sets[+i.dataset.set]);
      const picked = state.filter(s => s.on && s.r.ok).map(s => s.r);
      picked.forEach(r => ENG.rememberCols(r));
      m.close();
      commit(picked, file, chosen, mode);
    };
  }

  function commit(picked, file, sets, mode) {
    const snap = { raw: S.raw, file: S.file, sheet: S.sheet, settings: JSON.stringify(S.settings), filters: JSON.stringify(S.filters) };
    sets.forEach(s => s.apply(S.settings));
    if (sets.length) saveSettings();
    if (!picked.length) { rebuild(); render(); UI.toast("✓ " + sets.length + " قائمة"); return; }
    const incoming = picked.flatMap(r => r.rows);
    const merged = ENG.mergeRows(mode === "append" ? [...S.raw, ...incoming] : incoming);
    S.raw = merged.rows;
    S.file = mode === "append" && snap.file ? snap.file + " + " + file : file;
    S.sheet = picked.map(r => r.name).join("، ");
    resetFilters(); S.sel = []; S.vlimit = 200;
    rebuild(); saveData(); saveUi();
    if (S.tab === "prices") S.tab = "dash";
    render();
    const unk = Object.keys(ENG.M.meta.unknown).length;
    UI.toast("✓ " + ENG.M.visits.length + " زيارة" + (merged.dup ? " · " + merged.dup + " مكرر" : "") + (unk ? " · " + unk + " للمراجعة" : ""), { action: "تراجع", onAction: () => { S.raw = snap.raw; S.file = snap.file; S.sheet = snap.sheet; S.settings = JSON.parse(snap.settings); S.filters = JSON.parse(snap.filters); saveSettings(); saveData(); saveUi(); rebuild(); render(); } });
  }

  function demo() {
    const ents = ["مستشفي ايتاي", "ابو المطامير", "دمنهور الشاملة", "كفر الدوار طلاب", "مستشفي كونكورد", "المحمودية", "حوش عيسي قوي عاملة", "معمل البرج", "رشيد طلاب", "مركز دمنهور للكلي", "نيابة كوم حمادة", "بدر", "مستشفي الاندلس", "الدلنجات مسائي", "المخازن الغير طبية", "وادي النطرون", "الصفوة اسكندرية", "عيادة دمنهور الشاملة", "شبراخيت طلاب", "ادكو طلاب"];
    const ppl = ["هنداوي", "أديب", "أماني", "اباظة", "لبنى", "غادة", "شوقي", "شلتوت", "صبحي"];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const rows = [];
    const end = new Date(Date.UTC(2026, 8, 30));
    for (let d = new Date(Date.UTC(2026, 0, 4)); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const wd = d.getUTCDay();
      if (wd === 5 || wd === 6) continue;
      const n = rnd() < .25 ? 0 : rnd() < .7 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const team = [...new Set([pick(ppl), pick(ppl), rnd() < .4 ? pick(ppl) : ""].filter(Boolean))];
        rows.push({ d: d.toISOString().slice(0, 10), ent: pick(ents), g: rnd() < .62 ? "خطة المرور" : rnd() < .85 ? "فحص" : "شكوى", car: rnd() < .33, people: team, src: "تجريبي:" + (rows.length + 2) });
      }
    }
    commit([{ name: "بيانات تجريبية", rows }], "بيانات تجريبية", [], "replace");
  }

  function exportExcel(R) {
    const head = ["الاسم", "الدرجة", "الزيارات", "بالسيارة", "انتقال", "داخلي", "سيرفيس", "بدل سفر", "الإجمالي", "بنود بلا سعر"];
    const sum = R.persons.map(p => [p.name, CLS_AR[p.cls], p.items.length, p.car, p.k.travel, p.k.class, p.k.service, p.k.allow, p.sum, p.miss]);
    const tot = ["الإجمالي", "", sum.reduce((s, r) => s + r[2], 0), sum.reduce((s, r) => s + r[3], 0), ...[4, 5, 6, 7, 8, 9].map(i => sum.reduce((s, r) => s + r[i], 0))];
    const lines = [["الاسم", "التاريخ", "اليوم", "جهة المرور", "نوع الجهة", "المدينة", "المسافة", "الغرض", "سيارة الهيئة", "البيان", "التفصيل", "المبلغ"]];
    for (const p of R.persons) for (const it of [...p.items].sort((a, b) => a.v.d < b.v.d ? -1 : 1)) for (const l of it.ls) lines.push([p.name, it.v.d, UI.wday(it.v.d), it.v.ent, it.v.type, it.v.city || "", it.v.km, it.v.g, it.p.car, l.t, l.note || "", l.a]);
    const vis = [["التاريخ", "جهة المرور", "المدينة", "الغرض", "الأفراد", "بالسيارة", "المستحق"], ...R.visits.map(v => [v.d, v.ent, v.city || "", v.g, v.people.map(p => p.name).join(" - "), v.people.filter(p => p.car).map(p => p.name).join(" - "), v.sum])];
    UI.download("addad-report_" + periodName() + ".xlsx", XL.write([
      { name: "ملخص", cols: [18, 10, 10, 10, 12, 12, 12, 12, 14, 12], rows: [head, ...sum, tot], total: true },
      { name: "البنود", cols: [16, 12, 10, 30, 14, 14, 10, 16, 10, 46, 30, 10], rows: lines },
      { name: "الزيارات", cols: [12, 30, 14, 16, 44, 30, 12], rows: vis }
    ]));
    UI.toast("✓ Excel");
  }

  function periodName() {
    const f = S.filters;
    if (f.from) return f.from + "_" + f.to;
    if (f.months.length) return f.months[0] + (f.months.length > 1 ? "_" + f.months[f.months.length - 1] : "");
    return "all";
  }

  function periodLabel() {
    const f = S.filters;
    if (f.from) {
      const a = f.from, z = f.to || f.from;
      if (a.slice(8) === "01" && z.slice(0, 7) === a.slice(0, 7) && +z.slice(8) === UI.lastDay(+z.slice(0, 4), +z.slice(5, 7))) return "شهر " + UI.mlabel(a.slice(0, 7));
      return a === z ? "يوم " + UI.dlabel(a) : "من " + UI.dlabel(a) + " إلى " + UI.dlabel(z);
    }
    if (f.months.length) {
      const ms = f.months;
      const contiguous = ms.every((m, i) => !i || PICKER.shiftMonth(ms[i - 1], 1) === m);
      if (ms.length === 1) return "شهر " + UI.mlabel(ms[0]);
      if (contiguous) return "من " + UI.mlabel(ms[0]) + " إلى " + UI.mlabel(ms[ms.length - 1]);
      return ms.map(UI.mlabel).join("، ");
    }
    const b = bounds();
    return b.a ? "من " + UI.dlabel(b.a) + " إلى " + UI.dlabel(b.z) : "";
  }

  return { template, readSettings, load, demo, exportExcel, periodLabel, periodName, settingsSheets };
})();
