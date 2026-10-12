# عدّاد · Addad

Works out travel allowances (بدلات المرور) from the inspection-visits Excel sheet and produces visit-activity reports. Plain JS, no libraries, runs entirely in the browser.

## Counting model
- **Activity (نشاط فردي):** one person on one sheet row. Every row produces one activity per person in it, even when the place, day and purpose repeat. Amounts, car use and exclusions are tracked per activity.
- **Visit (زيارة):**
  - `خطة المرور` rows for the **same team on the same day** form one visit, even across several entities or rows.
  - Any other purpose: every row is its own visit.
  - Car use stays per activity. A visit is "mixed" when only part of the team or part of its rows used the car.
- **Saving by car:** the cost of a car activity if it had been done without the car (travel × 2 plus the internal allowance), minus its actual cost. This is precomputed per activity as `alt` and `save`.

## Cost rules for a person's day (v3.2)

All costing is done per person per day by `dayPlans()` in `js/engine.js`; stops are taken in sheet order.

- **One internal fee per day (بدل داخلي):** a person gets at most one internal fee per day, whatever the number of places or whether they are in the same city. Setting: *بدل داخلي واحد فقط لكل فرد في اليوم* (on by default). Damanhour service and car allowances are not affected.
- **One route for several cities (خط سير واحد):** stops outside Damanhour that the person did without the car form one trip: Damanhour → A → B → Damanhour, priced as `fare(A) + hop(A→B) + fare(B)`.
  * Two places in the **same city** need no hop (0), so the day costs one round trip.
  * The hop between **two different cities** uses the price you typed for that pair. Until it is typed, it is estimated with the Damanhour → B fare and **flagged** (تقدير) in the visits table, the statements, the dashboard and the printed reports.
  * Setting: *أكثر من مدينة في اليوم: خط سير واحد* (on by default). Turn it off for the old per-place round trips.
- **Line prices (الخطوط بين المدن):** the Settings tab lists every city pair that appears in the file, flagged ones first. Type only the empty ones; prices are stored once per pair, in one direction for both ways, and reused for every day. A price above going via Damanhour is marked *راجعه*.
- Stops with the car, zero-cost entities, Damanhour entities, unknown cities and cities without a price stay outside the trip and are costed as before.
- "If no car" savings are computed on the whole day, so they always reconcile with the totals.

## Report cost sections (all marked "بالأسعار الحالية", for transparency only)
- **ملخص التكلفة والتوفير:** total, breakdown, cost of car vs no-car activities, the cost if no car had been used, and the total saved.
- **تكلفة كل فرد:** per-person cost split by allowance type, share of the total, and average per activity.
- **الأكثر استخداماً للسيارة:** people ranked by car activities, with their actual cost, cost without the car, saving, and saving per activity.
- Optional: cost by purpose, cost by month, and the table of prices used.

## What's new (v3)
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

## Logo (v3.1)
- The logo is now an inline SVG gauge built by `UI.logo()` (and inlined in `index.html` for the header). Its colours come from the theme variables, so it follows light/dark mode and the iris accent: tile `--pn`, track `--mk` at 14%, arc `--acc`, needle/hub `--mk`.
- Printed reports override the variables to fixed print colours (white tile, `#626a9e` arc, black needle).
- Favicon: `images/logo.svg`, which follows the OS colour scheme through `prefers-color-scheme`. `images/icon.jpg` and `images/logo.jpg` stay as fallback and apple-touch icons.

## Polish & fixes (v3.1)
- The theme-color meta is set before first paint, and localStorage access is guarded (private mode / blocked storage).
- Keyboard shortcuts also work with Arabic keyboard layouts (matched on `e.code`) and are ignored inside contenteditable/select.
- XLSX writer: unique, valid sheet names (no `/ \ ? * [ ] :`, ≤31 chars), and `NaN`/`Infinity` cells are skipped so the file isn't corrupted.
- The prices tab binds only the price inputs (`input[data-city]`), not the confirm buttons that share the attribute.
- Corrupted stored lists (exceptions / zero entities) fall back to the defaults.
- Danger confirm buttons are red again (the accent override had hidden them).
- On mobile, toasts sit above the modal footer while a dialog is open.
- Dropping something that isn't a file no longer blocks the browser's default behaviour.

## Entry points
- `index.html`: the app. `index.html?demo` loads demo data, `#open=report` opens the report dialog, `#open=filters` expands the filter board.

## Input format
One sheet with the header row `اليوم | جهة المرور | الغرض من المرور | القائم بالمرور | سيارة الهيئة`, one row per day. Settings sheets (المدن، الافراد، خطوط المدن، …) are read when present; the backup writes the pending pairs with an empty price so they can be filled in Excel and re-imported. Fuzzy column detection is used as a fallback.

## Storage
localStorage only: `addad2.settings` (now also `internalOnce`, `chainTrips`, `pairs`), `addad2.data`, `addad3.ui` (filters, view, exclusions), `addad3.act` (report options), `addad2.theme`. Old `sel` people tabs are migrated into the people filter.

## Files
`index.html` · `css/style.css` · `js/{data,xlsx,ui,engine,picker,filters,io,report,activity,views,app}.js` · `images/` · `tests/sanity.js` (`node tests/sanity.js`: real-tariff scenarios and invariants for the cost rules)

## Not yet
- Old `.xls` format (save as xlsx).
- Saved named filter presets.
- Charts inside the PDF activity report (tables and bars only).
