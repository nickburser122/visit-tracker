# Cadence — Field Rotation Planner

Bilingual (EN / العربية), deterministic, offline-first planner that builds visit rotations for teams visiting facilities. (Formerly "Mauvine Planner"; existing browser data is kept.)

## Entry points
| Path | Purpose |
|---|---|
| `index.html#plan` | Plan window, **Recipe** (plan size + goals), schedule |
| `#sites` | Facilities ledger (category, location, distance, criticality, type) + Locations & distances + direct routes |
| `#people` | Team ledger (roles, rank overall + per category, home location, limits). The drawer holds **personal rules** and the group rules that also apply |
| `#history` | **New.** Revisit timing (Off / At least N days / Preferred range / Random within range), due board, visit history ledger (upload, quick add, add current plan, export) |
| `#rules` | Rule book (filters: All / Per person / Gender / Group / Must), work/rest pattern, rank ↔ criticality, hard rules, weights, categories, week, vocabulary |
| `#model` | Objective equation with **one-click copy as Text / LaTeX / Markdown / JSON**, plus Export (download) |
| `#insights` | KPIs, audit, mix, load, usage |
| `#workspace` | Workspaces, snapshots, import/export, data file source |
| `tests/engine-test.html` | Engine regression + dataset + rule tests |
| `tests/goals-test.html` | Flexible goals: person, combination, never-together, multi-class, per-week between, distinct places, inject fixed/pick, when+who, max 0, coverage, templates, roundtrip, determinism, incremental = full cost (21 checks) |
| `tests/goto-goals.html`, `goto-goals-ar.html`, `ui-goals-check.html` | Demo: seeds 6 sample goals and opens Plan (EN / AR); UI click-through check |
| `tests/history-test.html` | Previous visits / revisit timing tests (parse, dedupe, range, random, per-category, per-place, round-trip) |
| `tests/goto-history.html`, `goto-history-ar.html`, `goto-templates.html` | Demo: seed a sample history and open History / Workspace |

## Flexible goals (new)
Every goal is one sentence built from independent parts. Any combination is valid:

| Part | Options |
|---|---|
| **Kind** | `count` (a target on the plan) · `inject` (adds extra visits on top of the rhythm) |
| **What** | any place matcher (all / place / category / location / type / criticality ≥≤ / distance ≥≤). **Several values in one picker = OR** (e.g. *Basic or Contracted*, *3 types*). `+` adds up to 3 extra conditions joined AND/OR, and **NOT** inverts a condition |
| **Who** | everyone / person(s) / role(s) / gender / rank ≥≤ / home location (also multi-value, AND/OR, NOT). Mode: **any one of them** or **at least k of them together** |
| **When** | any day / weekdays / dates (`2026-10-06, 2026-10-12..2026-10-15`) |
| **Counted** | **each** place · **in total** · **each person** (in the who-group) |
| **Period** | per plan · **per week** |
| **Measure** | visits · **distinct places** |
| **Op** | at least · exactly · at most · **between n–m** |
| **Strength** | soft weight 0–100, or 🔒 **must** |

Examples: *Abaza ≥ 3 visits to Contracted* · *Abaza + Amani together ≥ 2* (or `at most 0` 🔒 = never together) · *Basic or Contracted in total ≥ 20* · *Contracted 1–3 per week* · *each Financial member ≥ 3 distinct places* · *≥ 4 visits with a woman between 5–8 Oct* · *each Basic at most 0* (removes a class) · **Inject** *دار الشفا on 14 & 21 Oct with Amani* · **Inject** *2 visits within 20 km, solver picks the Thursday*.

- **UI**: Plan → Recipe → `+ Add goal` (8 templates), presets (once / twice / critical / variety / weekly), each row shows live progress (`met/buckets` or `sum / target`). The person drawer (Team tab) lists goals that involve that person, with quick buttons to add one. The command palette (Ctrl K) has every template. Injected visits show 📌 in the agenda.
- **JSON** (`ws.goals[]`, also `settings.goals` in the dataset, exported with names): `{kind, what:{k,v:[…],not,more,join}, who:{…}, mode:'any'|'together', k, when:{k:'all'|'dow'|'dates',v}, per:'each'|'total'|'person', period:'plan'|'week', measure:'visits'|'places', op:'min'|'max'|'exact'|'between', n, n2, hard, w, label, inject:{mode:'dates'|'pick', dates, n}}`. Old goals (`scope/ref`) are converted automatically.
- **Solver**: each goal compiles to buckets (unit = place | all | person, × week). A visit contributes to a bucket when its place matches *what*, its day matches *when*, and its team satisfies *who* (≥ k matching members). Counts are kept **incrementally** (undoable deltas, so cost is O(changed visits)), and *distinct places* uses per-bucket place multiplicities. Cost per bucket is `w·w_g·(120·short + 250·over)`, or `5000|40000` per unit for must goals (term `goalsH`). A dedicated **goal-repair move** (10% of annealing moves) targets a violated bucket: it relocates a spare visit into the matching set, puts a required person on a matching visit, or removes an excess. Injected visits are restricted to their target set. *Pick* injections create optional candidate slots on the allowed days (an unused slot costs nothing), with an exact count goal on the slot group. `tests/goals-test.html` checks that incremental cost equals full recomputation.
- **Pre-flight warnings**: goal matches no place / nobody / no day, injection outside the window, a person whose capacity is below their goal, k larger than the group, distinct-places target above the number of places.

### Inject options (new)
- **Team**: everyone (solver fills the team) · any one of them · at least k together · **all of them** · **exactly these people** (no one else) · **only from this group** (solver picks inside it). JSON `mode: any|together|all|exact|only`.
- **Count**: `inject.per: any` (in total across matching places) or `each` (every matching place gets its own visits, up to 40 places).
- **How many** (solver-picks mode): `inject.op: exact|min|max|between` with `n`, `n2`.
- **Extra or instead**: `inject.add: extra` (on top of the rhythm) or `replace` (takes the place of rhythm visits, so the plan total stays the same).
- `tests/inject-test.html` checks these (6 checks).

### Fixes in this version
- A dropdown no longer goes blank or stops responding when a background solve redraws the page while it is open. The redraw waits until the dropdown closes.
- Dropdowns close when their button scrolls off-screen, and they never slide under the sticky tab bar. Long lists shrink to fit the space available.
- Goal place pickers (place / category / location / type) only list plannable places and show how many there are. Before, they could list locations with no plannable facilities, so the goal matched nothing.

## Previous visits & revisit timing
- **History list** (`ws.history`): `{date, site, people[], note, src: upload|plan|manual}`. Names that don't match are kept (`sn`, `pn`) and flagged "not in list". **Re-match names** links them later, for example after you add the facility.
- **Sources**: upload a CSV / TSV / Excel (.xlsx/.xls/.ods) / JSON file; **Add current plan to history**; a snapshot's **→ history** button (earlier plans); quick-add one visit; `history:[{date,place,people[]}]` inside `complete_data.json`; or an optional `"history":"data/history.csv"` in `app-config.json`. Uploads merge, and duplicates (same date + place) are combined.
- **Parsing**: English or Arabic headers (`date/التاريخ`, `place/المكان/المنشأة`, `people/الفريق`, or one column per role), ISO, `dd/mm/yyyy` or Excel serial dates, Arabic digits. People can be separated with `| ; , ،`.
- **Timing modes** (`ws.recency`):
  - `min`: never sooner than N days.
  - `range`: aim for min–max days after the last visit.
  - `random`: each place gets a deterministic random target inside the range ± jitter. Press "New random targets" to reshuffle (`salt`).
- **Options**: the minimum can be a must; the gap is also enforced between visits inside the same plan; overdue places are pushed; places never visited can be neutral or treated as due; look-back window; count visits dated inside the plan window; "same person back to the same place" gap; per-category windows; per-place `gapMin/gapMax` (Places ledger column and CSV `gap_min,gap_max`). There are quick presets (monthly, ~2 months 45–75, quarterly, random 30–90, ≥60).
- **Engine**: new soft term `recency` (weight "Respect revisit timing") plus a hard term `recencyH`. Too early: `w·(20+80·(min−gap)/min)`. Late: `25·w·(gap−max)/max`. Still overdue at the end of the plan: `120·w`. Same person: `30·w·(P−g)/P`. Expected visits per place are also scaled so that due places get more visits. New issues: `rcearly, rclate, rcover, rcnever, rcperson`. New pre-flight warnings: `rcnohist, rcblocked`. There is also a KPI and an audit row.
- **Due board**: last visit, days ago, window bar, "due between" dates and a status (overdue / due / never / too soon), either as of the plan start or including the plan.

## Templates & uploads (new)
Workspace → **Templates & uploads** has download + upload for previous visits, facilities, team and locations (CSV or Excel; Excel adds a `lists` sheet with the valid names), the rule book (JSON) and the full dataset (JSON). The Facilities, Team and Locations cards also have their own template buttons. Every CSV import now also accepts Excel files. SheetJS is bundled at `js/vendor/xlsx.full.min.js` and only loads when Excel is used.

## Features
- **Dataset loads on open**: `data/complete_data.json` is fetched on first run, when the active workspace has no facilities, or when no dataset workspace exists yet. Falls back to `*.json.txt` names. If you open the page from `file://` you get a prompt to import the file, because browsers block local fetches.
- **The split files win**: `data/facilities.json` and `data/people_ranking.json` are layered on top of `complete_data.json`, matched by id and then by name. They set the list of facilities and people and their name, category, location, gender, pool and ranks. `complete_data.json` still provides the distances, criticality, pools and rules. When any of these files change, the workspace updates on its own and keeps your edits. `tests/ds-check.html` compares what the app shows with the files.
- **Rule book** (every rule can be soft with a strength, or a hard "must"):
  - `Place`: who prefers / avoids / only / never goes to a place, category, location, type, criticality ≥ / ≤, or distance.
  - `Day`: who prefers / avoids / only / never works on certain weekdays.
  - `Partner`: who prefers / avoids / only / never pairs with whom.
  - `Team mix`: visits to X should / must have at least / at most / exactly / **none or at least** N × who (for example, women never go alone).
  - `Visit count` (new, per person or group): who should / must do at least / at most / exactly N visits to X, **per plan or per week**.
  - **NOT** toggle on each side inverts the matcher ("everyone except rank ≥ 75", "anywhere except location X").
  - ⇄ flips a rule into its opposite (prefer ↔ avoid, only ↔ never, min ↔ max). 🔒 switches soft ↔ must. ↺ restores the rule book from the data file.
  - New who-matcher **Lives in** (home location) and what-matcher **criticality ≤**.
  - **AND / OR conditions**: `+` after any who/what picker adds up to 3 extra conditions; click the joiner to switch AND ↔ OR (e.g. "Women AND rank ≤ 50 never go farther than 40 km"). JSON: `who:{k,v,more:[{k,v,not}],join:'and'|'or'}`.
  - **Calendar dates** on Day rules: switch `weekdays | dates` and type `2026-10-06, 2026-10-12..2026-10-15`. JSON: `what:{k:'dates',v:'…'}`.
- **Gender rules**: `default_settings.genderRule` in the dataset (for example `"basic":"31"`) is turned into a team rule ("at most 1 woman per basic visit"). There are ready-made templates for women (none-or-2 per visit, never far, prefer near).
- **Per-person rules**: open a person's drawer to add a Place / Day / Partner / Visit-count rule in one click and edit it inline. Group rules that match them are listed underneath.
- **Multi-stop day routing**: new soft term `route` puts each day's stops, and each person's same-day stops, into the shortest loop from base or home. It uses exact search for up to 5 stops and nearest-neighbour above that, with the direct routes table. The agenda shows the ordered route and km for each day.
- Work/rest patterns (global or per person), rank-to-criticality matching, locations and routes, goals, pins, explainable alternatives.

## Algorithm
J = hard terms (coverage, limits, rest, distinct, must rules) + Σ weight × soft term (goals, book, rank, fair, rotate, mix, pref, home, focus, cluster, spacing, pairs, likes).
Rule book term: Σ_r w_r·(1.2·[site/day] + 3·[avoid-with] − 0.8·[pair-with] + 2·team_gap + 2·count_gap).
The solver builds a greedy start, then runs simulated annealing and a polish pass, taking the best of N seeded runs. It runs in a Web Worker.

## Data / storage
All data is stored in the browser's localStorage (`mauvine.v2.*`). Rule JSON: `{rel: site|day|with|team|count, sense, who:{k,v,not?}, what:{k,v,not?}, op, n, per: plan|week, w, note}`. `data/app-config.json` sets the dataset path and the rule templates. There is no server or table API.

## Not yet / next
- Goals: "spread" targets (e.g. visits evenly across weeks) and min-gap between a person's visits to the same goal set; goal priorities/tiers beyond soft-weight vs must.
- Travel-time windows (routing uses km only).
- Nested condition groups (one AND/OR level per side for now).
- Revisit timing per person or role (right now it applies per place, plus one "same person" gap).
- History is stored in localStorage; very large histories (>20k rows) are trimmed.
