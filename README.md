# عدّاد · Addad

Works out travel allowances (بدلات المرور) from the inspection-visits Excel file. Plain JS, no libraries, runs entirely in the browser.

## Features
- **Import:** xlsx or csv, from a button, Ctrl+O, or drag-and-drop.
  - Opens straight away when detection is confident.
  - Otherwise shows a review dialog: per-sheet quality %, column mapping with confidence dots, a sample preview, and an issue list.
- **Smart detection:**
  - Finds the header row and columns by name and by content (known people and entities, dates, purpose words, yes/no values).
  - Works with any header wording, or no header at all.
  - Dates: serial numbers, date-formatted cells, d/m/y, m/d/y (auto-detected), 2-digit years, "15 مارس", weekday prefixes, Arabic digits. Missing years are inferred from the sheet name or neighbouring rows.
  - Merged cells are expanded. Blank dates and entities are carried down from the row above.
  - Total rows are skipped.
  - Names: split on any separator; titles such as د/ and أ/ are removed; «بالسيارة» written inside a name marks that person as travelling by car.
  - Multiple sheets can be merged and de-duplicated, and imports can replace or append to existing data.
  - The column mapping is remembered per header layout.
  - Fuzzy (bigram) matching links entities to cities. Linking one entity also auto-links similar unknown ones.
- **Period picker:**
  - Opens in months mode: tap a month, or drag across months to pick a range. Shift+click extends the range.
  - Days mode: tap twice or drag. Shows two months on desktop, one on mobile, with visit-density dots.
  - Preset chips. A live footer shows the label, visit count and amount.
  - Slide transitions, keyboard navigation, bottom sheet on mobile.
  - ‹ › arrows beside the period button (or the `[` and `]` keys) step to the previous or next period of the same length.
- **Month strip:** click selects one month, Ctrl or right-click adds months, Shift selects a range.
- **Dashboard:**
  - KPIs: total with % change against the previous equal period, visits, cost per visit and per participation, money saved by the authority car, share spent outside Damanhour, top earner.
  - Panels: amount per person, monthly amounts, spending breakdown, cities and entities ranked by cost, a people × months heatmap, purpose and car splits.
  - Clicking any bar applies a filter.
- **Filters:**
  - Search with typed suggestions.
  - Collapsible advanced filters with a count badge.
  - Removable chips, with undo.
- **PDF:**
  - Live A4 preview.
  - Paginated summary and per-person statements, with carry-forward subtotals.
  - Reference number, page x/y, amount in words, signatures.
  - Optional Arabic digits.
- **Excel:** report export, backup, and template.
- **UX:**
  - Undo toasts.
  - Bottom sheets on mobile.
  - Visits shown as cards on mobile, with infinite scroll.
  - Alt+1–4 or the arrow keys switch tabs, Ctrl+P opens the PDF dialog, / focuses search.

## Files
`index.html` · `css/style.css` · `js/data.js` · `js/xlsx.js` · `js/ui.js` · `js/engine.js` · `js/picker.js` · `js/filters.js` · `js/io.js` · `js/report.js` · `js/views.js` · `js/app.js` · `images/logo.jpg`, `images/icon.jpg`

## Storage
localStorage: `addad2.settings` (prices, people, entities, column memory), `addad2.data` (rows), `addad3.ui`, `addad2.theme`. No server.

## Not yet
- Old `.xls` format (save as xlsx).
- Monthly comparison in the PDF.
- Typed date entry was removed from the picker in favour of drag selection.
