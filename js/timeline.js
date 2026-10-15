const TLUI = (() => {
  const { esc, icons } = UI;
  const GRADES = ["", "الأولى", "الثانية", "الثالثة"];
  const parse = s => { s = String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫,]/g, ".").trim(); return s === "" || isNaN(+s) ? null : Math.max(0, +s); };
  const count = n => n === 2 ? "فترتان" : n + " فترات";

  const btn = (path, val) => '<button class="icon-btn sm tl-btn' + (TL.dated(val) ? " on" : "") + '" data-tl="' + esc(path) + '" title="حسب التاريخ" aria-label="حسب التاريخ">' + icons.cal + "</button>";
  const chip = (path, val, text, fmt) => '<button class="btn sm tl-chip" data-tl="' + esc(path) + '" title="' + esc(TL.label(val, fmt)) + '">' + esc(text) + "<small>" + count(val.length) + "</small></button>";
  const cell = (path, val, input, text, fmt) => '<span class="tl-cell">' + (TL.dated(val) ? chip(path, val, text, fmt) : input + btn(path, val)) + "</span>";

  const rowHtml = (p, kind) => '<tr><td><input class="txt dt" type="date" data-f value="' + (p.from || "") + '" aria-label="من"></td><td><input class="txt dt" type="date" data-t value="' + (p.to || "") + '" aria-label="إلى"></td><td>' +
    (kind === "grade"
      ? '<select class="txt" data-v>' + [1, 2, 3].map(c => '<option value="' + c + '"' + (p.v === c ? " selected" : "") + ">" + GRADES[c] + "</option>").join("") + "</select>"
      : kind === "flag"
      ? '<select class="txt" data-v><option value="1"' + (p.v === true ? " selected" : "") + '>يستحق</option><option value="0"' + (p.v === true ? "" : " selected") + ">لا</option></select>"
      : '<input class="num" type="text" inputmode="decimal" placeholder="—" data-v value="' + (p.v == null ? "" : p.v) + '">') +
    '</td><td><button class="icon-btn sm" data-del aria-label="حذف">' + icons.x + "</button></td></tr>";

  function edit(target, done) {
    if (!target) return;
    const kind = target.kind;
    const rows = TL.periods(target.value);
    const m = UI.modal(target.title,
      '<table class="mini tl-t"><thead><tr><th>من</th><th>إلى</th><th>' + (kind === "grade" ? "الدرجة" : kind === "flag" ? "بدل السفر" : "القيمة") + '</th><th></th></tr></thead><tbody>' + rows.map(p => rowHtml(p, kind)).join("") + '</tbody></table><button class="lnk" data-add>+ فترة جديدة</button><p class="note tl-note" data-note></p>',
      '<button class="btn" data-x>إلغاء</button>' + (TL.dated(target.value) ? '<button class="btn" data-flat>قيمة واحدة بلا تواريخ</button>' : "") + '<button class="btn solid" data-ok>حفظ</button>',
      { cls: "small", sub: "فترة بلا «من» تبدأ من البداية، وبلا «إلى» مستمرة. عند التداخل تُطبَّق الفترة الأحدث بداية." });
    const tb = m.querySelector("tbody"), note = m.querySelector("[data-note]");
    const read = () => [...tb.rows].map(r => {
      const f = r.querySelector("[data-f]").value, t = r.querySelector("[data-t]").value, x = r.querySelector("[data-v]");
      return { ...(f ? { from: f } : {}), ...(t ? { to: t } : {}), v: kind === "grade" ? +x.value : kind === "flag" ? x.value === "1" : parse(x.value) };
    });
    const check = () => {
      const a = read();
      const bad = a.some(p => p.from && p.to && p.from > p.to);
      const gap = !bad && a.length > 1 && TL.at(TL.clean(a), UI.today()) == null;
      note.textContent = bad ? "تاريخ النهاية قبل تاريخ البداية في إحدى الفترات" : gap ? "اليوم خارج كل الفترات: القيمة غير محددة" : "";
      note.classList.toggle("bad", bad);
      return !bad;
    };
    const wire = () => {
      tb.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { if (tb.rows.length > 1) { b.closest("tr").remove(); check(); } });
      tb.querySelectorAll("input,select").forEach(i => i.onchange = check);
    };
    wire();
    m.querySelector("[data-add]").onclick = () => {
      const last = read().pop() || {};
      tb.insertAdjacentHTML("beforeend", rowHtml({ from: UI.today(), v: last.v == null ? (kind === "grade" ? 3 : kind === "flag" ? false : null) : last.v }, kind));
      wire(); check();
      const r = tb.rows[tb.rows.length - 1].querySelector("[data-v]"); r && r.focus();
    };
    const finish = val => { m.close(); target.apply(val); done && done(); };
    m.querySelector("[data-ok]").onclick = () => { if (!check()) return; finish(TL.clean(read())); };
    const flat = m.querySelector("[data-flat]");
    if (flat) flat.onclick = () => finish(TL.latest(target.value));
  }

  const wire = (root, resolve, done) => root.querySelectorAll("[data-tl]").forEach(b => b.onclick = () => edit(resolve(b.dataset.tl), done));

  return { btn, cell, wire };
})();
