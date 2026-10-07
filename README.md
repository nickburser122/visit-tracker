# عدّاد · Addad

Works out travel allowances (بدلات المرور) from the inspection-visits Excel sheet. Plain JS, no libraries, runs entirely in the browser.

## Input format (tailored)
One sheet, header row `اليوم | جهة المرور | الغرض من المرور | القائم بالمرور | سيارة الهيئة`, one row per calendar day, e.g. ` Tue 01 Apr 2025 | | | | FALSE`.
- Exact header match is detected first and imported directly, with no dialog and no guessing.
- Empty days (no entity and no names) are skipped silently and counted as "يوم فارغ".
- Other sheets are ignored unless they share the exact header.
- Fuzzy detection is only a fallback for unfamiliar files, and opens the review dialog.
- Settings sheets (المدن، الافراد، …) are still read when present.

## Features
- **Period picker:** two modes.
  - **شهور:** a year grid. Tap any months, including non-adjacent ones. Year and quarter shortcuts. Double-click applies a single month.
  - **تاريخ محدد:** typed `من` / `إلى` fields with a live parse hint. Accepts `7/4`, `7/4/2025`, `15 مارس`, and `4/2025` (whole month). The year defaults to the data year. Enter applies.
  - ‹ › arrows step to the previous or next period of the same length.
- **People tab · عرض (lenses):** one-tap views with live counts:
  - كل البنود
  - بالسيارة
  - بالسيارة بلا مبلغ
  - بالسيارة بمبلغ
  - بدون سيارة
  - صفر فقط
  - بلا سعر
  - بدل سفر
  - سيرفيس
  - خارج دمنهور بدون سيارة
- **New filters:** المبلغ (له مبلغ / صفر / بلا سعر) and البند (line kind), also in the filter bar, search and chips.
- **Exclusions:** "استبعاد بنود" mode lets you untick individual participations. Excluded items:
  - leave totals, statements, PDF and Excel;
  - show struck-through only in edit mode;
  - can be undone from a chip.
- **WYSIWYG output:** PDF and Excel use exactly the on-screen result. The PDF subtitle states the scope (e.g. "بالسيارة · بلا مبلغ").
- People summary is sortable by any column and has a "بلا مبلغ" column. Visits show amounts for the filtered people only; other people on a visit are dimmed.
- Dashboard, visits table, settings, and import review are unchanged in function.

## Fixes
- Dropdowns opened inside modals (import column mapping, PDF people picker) appeared behind the modal; the z-index is fixed.
- Weekday stripping no longer eats letters inside Arabic words.
- Saved UI state is validated, so corrupt localStorage can't break filters.
- Changing a person's grade refreshes the filter bar and chips as well.
- The template now mirrors the real one-row-per-day sheet.

## Storage
localStorage only: `addad2.settings`, `addad2.data`, `addad3.ui` (filters, excluded items), `addad2.theme`.

## Files
`index.html` · `css/style.css` · `js/{data,xlsx,ui,engine,picker,filters,io,report,views,app}.js` · `images/`

## Not yet
- Old `.xls` format (save as xlsx).
- Per-line (rather than per-participation) exclusion.
