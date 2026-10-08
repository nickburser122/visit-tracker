# عدّاد · Addad

Works out travel allowances (بدلات المرور) from the inspection-visits Excel sheet and produces visit-activity reports. Plain JS, no libraries, runs entirely in the browser.

## What's new
- **Calm palette (iris · clay · sage):** low-chroma muted periwinkle as the single accent, with warm clay for "no car" and cost notes and soft sage for "by car". Light mode uses cool paper; dark mode uses soft slate. Every accent is a CSS variable (`--v1/--v2/--v3`, `--acc*`, `--clay-*`, `--sage-*`) in `css/style.css`.
- **Unified filter board:** replaces the people tabs and the lenses. Every category appears as a row of chips: الغرض · الانتقال · النطاق · الأفراد · المبلغ · نوع البند · نوع الجهة · المسافة · المدينة · الجهة.
  - Within a group, picks combine as **any of** (OR). Across groups they combine as **all of** (AND). You can pick one category, several, or some of each.
  - Each chip shows a live facet count: how many visits you would get if you added it. Chips that would give no results are dimmed.
  - Large groups show the top 8 and a "+N" button that opens a search list.
  - The search box (`/`), active chips, and clear/undo all work the same way.
- **Purposes expanded:** "أخرى" is gone. Every purpose from the sheet (شكوى، لجنة، متابعة …) is its own filterable value. خطة المرور is still grouped.
- **People tab:** follows the filter board. It has a view switch (ملخص / كشف البنود / حسب الزيارة), exclusions, Excel, and PDF statements. Clicking a name filters to that person.
- **Activity report (تقرير النشاط):** opened from the top bar, from the "تقرير لهذا العرض" link under the filters, from the purposes panel, or with `Ctrl R`.
  - Scope: العرض الحالي / الفترة فقط / كل الفترات.
  - Optional sections: overall summary, with/without car (visits and participations, including mixed visits), by purpose, by person (car/no-car and purpose split), person × purpose, by entity type, city, month, and entity.
  - Cost appears only as a **note**: the estimated total at current prices, a breakdown, and a statement of the calculation basis. It says clearly that prices change and that the note is not a payment document. An optional "prices used" table can be added.
  - Live A4 preview with automatic pagination: tables continue across pages, and short tables are not split. Export to **PDF** (print) or **XLSX** (one sheet per section). Your options are remembered.

## Entry points
- `index.html`: the app. `index.html?demo` loads demo data, `#open=report` opens the report dialog, `#open=filters` expands the filter board.

## Input format
One sheet with the header row `اليوم | جهة المرور | الغرض من المرور | القائم بالمرور | سيارة الهيئة`, one row per day. Settings sheets (المدن، الافراد، …) are read when present. Fuzzy column detection is used as a fallback.

## Storage
localStorage only: `addad2.settings`, `addad2.data`, `addad3.ui` (filters, view, exclusions), `addad3.act` (report options), `addad2.theme`. Old `sel` people tabs are migrated into the people filter.

## Files
`index.html` · `css/style.css` · `js/{data,xlsx,ui,engine,picker,filters,io,report,activity,views,app}.js` · `images/`

## Not yet
- Old `.xls` format (save as xlsx).
- Saved named filter presets.
- Charts inside the PDF activity report (tables and bars only).
