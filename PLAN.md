# Mauvine Planner — Build Plan

A general‑purpose, bilingual (EN / ع), offline‑first planner for **recurring visit rotas**: any team that has to send
*people with certain roles* to *sites of certain categories* on *working days*, fairly, under rules.
Field inspections, store audits, home‑care rounds, merchandising routes, maintenance crews, clinical supervision,
school visits — same ingredients, different vocabulary.

This document is the contract. Anyone handed it should be able to build the same app.

---

## 0. Principles

1. **Nothing is hard‑coded to one organisation.** Roles, categories, staffing, vocabulary, rules and weights are data.
2. **One objective function.** Every rule — hard or soft — is a term in a single cost. The solver minimises it.
   Hard rules carry penalties orders of magnitude above soft ones, so they behave as constraints but can still be
   *bent and flagged* when the data makes them impossible (or left open in *strict* mode).
3. **Deterministic.** Same data + same seed = same plan, byte for byte. Iteration counts, never wall‑clock limits.
4. **Explainable.** Every assignment can be opened to show ranked alternatives and *why* (per‑term cost deltas).
5. **Interactive.** Pin a site or a person anywhere; the solver re‑optimises around pins.
6. **Never blocks the UI.** The solver runs in a Web Worker; falls back to the main thread when workers are
   unavailable (e.g. `file://`).
7. **Visual identity preserved.** Mauve palette, Fraunces / Instrument Sans / JetBrains Mono / IBM Plex Sans Arabic,
   hairline cards, pill chips. Upgraded with a dark "Dusk" theme, category colours, command palette, matrix and
   calendar views, progress ring, crisper motion.
8. **No code comments, vanilla JS, no build step.**

---

## 1. Files

```
index.html          shell: masthead, tab bar, view sections, SVG icon sprite, script tags
css/app.css         design tokens (light + dusk), components, views, print, responsive, RTL
js/i18n.js          T dictionary {key:[en, ar]}, term substitution, day/month names
js/core.js          utils, dates, workspace model, templates, migration, store, history, compile(), fingerprint
js/engine.js        pure solver (no DOM). Global `MauvineEngine` + Web Worker entry when loaded as a worker
js/views.js         HTML string renderers for every view, modal and popover
js/app.js           state, event delegation, solver runner, import/export, keyboard, palette, boot
PLAN.md             this file
README.md           status, entry points, data model
```

Load order: `i18n.js → core.js → engine.js → views.js → app.js`. `engine.js` is also spawned with
`new Worker('js/engine.js')`; it detects worker context and wires `onmessage`.

---

## 2. Domain model (one *workspace* = one planning project)

```js
Workspace = {
  v: 2, id, name, created, updated,
  terms: { en:{visit,visits,site,sites,person,people}, ar:{…same keys} },
  unit: 'km' | 'mi',
  roles:      [{ id, name, color }],
  categories: [{ id, name, color, planned:bool, share:number, staff:{ [roleId]: int } }],
  sites:      [{ id, name, cat, km, zone, weight, minV, maxV, days:[7×bool], blackout:[iso], active, note }],
  people:     [{ id, name, roles:[roleId], home, pref:'none'|'near'|'far', weight,
                 days:[7×bool], off:[iso], maxLoad, maxWeek, avoid:[pid], pair:[pid],
                 likes:[siteId], bans:[siteId], active }],
  week:       [7 × { on, n, focus:'auto'|'near'|'far'|categoryId }],
  overrides:  { [iso]: { on?, n?, focus? } },
  scope:      { mode:'week'|'month'|'custom', start, end },
  rules:      { perDay, rest, distinct, siteGap, mode:'bend'|'strict', nearKm, weekStart },
  weights:    { fair, pref, home, rotate, mix, focus, cluster, spacing, pairs, likes },   0‥100
  useW:       { same keys: bool },
  engine:     { seed, quality:'fast'|'balanced'|'thorough', runs, live },
  locks:      { sites:{ [visitKey]: siteId }, seats:{ [seatKey]: personId | '__open' } },
  snapshots:  [{ id, name, at, plan }],
  plan:       Plan | null
}
```

* `minV / maxV` — per plan window; empty = no bound. `maxLoad / maxWeek` — per person; empty = no bound.
* `weight` (0.5‥2) — sites: share of rotation; people: share of load.
* A category with `planned:false` is the old "excluded" type: its sites are never scheduled.
* `visitKey = iso#k`, `seatKey = iso#k#roleId#i`. Stable across re‑solves → pins survive.

Preferences (`localStorage 'mauvine.v2.index'`): `{ active, list:[{id,name,updated}], prefs:{lang,theme,view,layout} }`.
Each workspace: `localStorage 'mauvine.v2.ws.<id>'`. Legacy `mauveineRota.v1` is migrated once into a workspace
("Imported rota"): facilities→sites, fin/clin pools→roles, main/contracted/excluded→categories, staffing→staff,
ratio→share, weekday defaults→week (pref main→focus main), overrides, noConsecutive→rest, oneVisitPerDay→perDay,
relaxMode→mode, weights mapped.

Templates (Workspace → New): **Blank**, **Field inspections**, **Store audits**, **Home‑care rounds**. Each sets
vocabulary, roles, categories, rhythm and deterministic sample data.

History: undo/redo stacks of serialized workspace snapshots (max 60), coalesced for rapid typing (600 ms).

---

## 3. Compile (main thread, `core.compile(ws)`)

Turns a workspace into a flat, index‑based, JSON‑serialisable problem `P` plus `map` (index → id).

1. Effective range from scope (week = start+6; month = 1st‥last; custom clamps end ≥ start, ≤ 366 days).
2. Day config = week[dow] overlaid with overrides[iso]. **Working days** = `on && n>0`.
   For each: `num` = UTC day number, `week` = ⌊(num+4−weekStart+7)/7⌋, `focus` = −1 auto / −2 near / −3 far / cat index.
3. Visits = n per working day, `key = iso#k`, `lockSite` = site index or −2.
4. Categories = all categories whose `planned` is true **and** own ≥1 active site. `need[c][r]` from `staff`.
5. Sites = active sites of those categories. `avail[s*D+d]` = weekday on and date not blacked out.
6. People = active people with ≥1 known role. `roleMask`, `avail[p*D+d]` (weekday + off dates),
   `rel[p*N+q]` (1 avoid, 2 pair), `aff[p*S+s]` (1 like, 2 ban).
7. Seats: per visit, per role, `max_c need[c][r]` seats; seat *i* is **active** iff the visit's site category needs > i.
   Lock = person index / −1 forced open / −2 none.
8. Category targets: `catTarget[c] = V·share_c/Σshare` (if Σshare = 0: proportional to site count).
   `mixOn = Σshare>0`.
9. Demand per role `= Σ_c catTarget[c]·need[c][r]`. Person target load by **water‑filling** per role:
   each member gets `min(cap, λ·w)` where cap = available days × perDay (bounded by maxLoad), w = weight/|roles|;
   λ by bisection so that Σ = demand. Target = Σ over roles.
10. Site expected uses `= catTarget[cat]·w_s / Σ w in cat`.
11. Spacing ideal per person `= min(7, span/target)·0.8` (0 when target < 1).
12. Distance normaliser `Dn = max(10, max site km, max home)`.
13. Weights: `w_k = useW_k ? weight_k/50 : 0`.
14. Iterations: `{fast:25k, balanced:90k, thorough:300k} × clamp((seats+V)/120, .6, 5)`; runs 1‥16.

Fingerprint: FNV‑1a of the JSON of everything compile reads → stored in plan; mismatch ⇒ "stale" banner.

---

## 4. Solver (`js/engine.js`)

### 4.1 State
`siteOf[V]`, `seatP[Seats]`, `pSeats[N]` (seat lists), `sUses[S]` (visit lists), `pDay[N·D]`, `catCount[C]`,
cost caches `pc[N] vc[V] sc[S] dc[D] mixc`.

### 4.2 Cost terms (the single objective)

| Entity | Term | Cost |
|---|---|---|
| person | fairness | `1.5·w.fair·(load − target)²` |
| person | max load / max per week / per‑day cap / banned site / same visit twice | `HARD = 20 000` each unit |
| person | rest (two duties ≤ `rest` days apart) | `BENT = 300` (bend) or `40 000` (strict) |
| person | spacing (gap < ideal) | `2·w.spacing·((ideal−g)/ideal)²` |
| person | near / far preference | `2·w.pref·km/Dn` / `2·w.pref·(1−km/Dn)` |
| person | home distance | `2·w.home·|home−km|/Dn` |
| person | liked site | `−1.5·w.likes` |
| visit | no site | `6 000` |
| visit | open seat (not forced) | `1 000` |
| visit | avoid pair together | `150·max(w.pairs,.2)` |
| visit | preferred pair together | `−3·w.pairs` |
| site | rotation | `1.2·w.rotate·(uses − expected)²` |
| site | under min | `60`/missing · over max `HARD` · revisit gap < siteGap `400` |
| day | duplicate site (distinct rule) | `2 500` per duplicate |
| day | near focus | `4·w.focus·(km−nearKm)/Dn` per far visit + spread |
| day | far focus | `4·w.focus·(nearKm−km)/Dn` |
| day | category focus | `6·w.focus` per off‑category visit |
| day | cluster (≥2 visits) | `3·w.cluster·(max−min)/Dn + 2·w.cluster·(zones−1)` (×2 on near days) |
| global | mix | `w.mix·Σ(count_c − target_c)²` |

Strict vs bend is only the rest penalty relative to the open‑seat penalty: strict → leaving a seat open is cheaper
than breaking rest; bend → breaking rest is cheaper than leaving it open (and it is flagged).

### 4.3 Moves (incremental)
Primitive ops `setSite(v,s)` / `setSeat(seat,p)` log undo records and mark dirty entities.
`setSite` deactivates seats the new category does not need. Delta = Σ(new − cached) over dirty entities only.

* **Reassign** (42 %): random unlocked active seat → random eligible candidate (30 % of the time hunting open seats
  and preferring people free around that day).
* **Swap** (30 %): two seats of the same role on different visits exchange people (either may be open).
* **Relocate** (18 %): unlocked visit → another site available that day; newly required seats are filled from free
  candidates.
* **Site swap** (10 %): two visits on different days exchange sites.

### 4.4 Pipeline per run
1. **Construct sites** — chronological; each visit takes the site with the lowest delta (open seats ignored).
2. **Apply seat pins.**
3. **Construct staff** — most‑constrained seat first (fewest candidates); each takes the best‑delta candidate.
4. **Simulated annealing** — geometric temperature 8 → 0.02 over `iters`; Metropolis acceptance; best kept.
5. **Polish** — deterministic best‑improvement over every seat × candidate and same‑category site alternatives,
   until no improving move (≤ 8 passes).

Runs = `engine.runs` with seeds `seed + k·7919`; lowest cost wins. PRNG: mulberry32.

### 4.5 Outputs
`{ siteOf, seatP, cost, breakdown{term:value}, issues[], stats{loads, catCount, siteUse, filled, seats, km}, iters, runs, ms }`.
Issues are structured codes: `nosite, open, rest, perday, maxload, maxweek, ban, unavail, sitemax, sitemin, sitegap,
dup, avoid` with indices → mapped to ids → rendered through i18n at view time.

### 4.6 Explain
`explain(P, sol, {seat})` → every role member ranked by delta vs current with per‑term deltas
(unavailable people listed last with the reason). `explain(P, sol, {visit})` → site alternatives ranked the same way.

---

## 5. Views

Tabs (keys 1‑6): **Plan · Sites · People · Rules · Insights · Workspace** (Sites/People use the workspace vocabulary).

**Plan** — scope card (Week/Month/Custom, date pickers, counts), day ribbon (tiles show visit dots, focus glyph,
override marker; click → day editor: on/off, visits stepper, focus select, reset). Action row: Solve (G), Reroll (R),
Export (E), Print, status pill with progress ring, cost, issue count, stale banner. Issues panel (grouped, click a
day chip to scroll). Schedule in three layouts:
* *Agenda* — grouped by day; site cell (category tag, pin, distance), role columns with person pills.
  Hover a person → traced across the plan. Click a site or pill → **Explain popover**: ranked alternatives with
  reasons, "Pin", "Leave open", "Unpin".
* *Matrix* — people (grouped by role) × days, cell = site short name, row totals vs target, rule‑break markers.
* *Calendar* — month grid, each day lists its visits with category colour.

**Sites** — search, category filter chips with counts, add, CSV import / template / export. Rows: name, category
select, distance, zone, weight slider, min/max per window, weekday chips, blackout dates, active switch,
usage in current plan, delete (two‑step confirm).

**People** — search, role filter, add, CSV. Rows: name, roles (multi chips), home distance, preference, weight,
weekdays, off days (chips + date picker), max load / week, load bar vs target, active, details drawer
(avoid / pair with / liked / banned sites).

**Rules** — Vocabulary (6 words per language, unit), Roles editor, Categories editor (colour, staffing per role,
mix share, planned switch), Weekly rhythm (7 cells), Hard rules (per day, rest days, distinct, revisit gap, bend/strict,
near threshold, week start), Weights (toggle + slider each, restore), Engine (seed, quality, runs, live re‑solve).

**Insights** — KPI tiles, rules audit, load per person (bar + target tick), category mix (achieved vs target),
cost breakdown bars, site usage (most / unused / below min), day ledger, copy report.

**Workspace** — workspace cards (open / rename / duplicate / delete), new from template, JSON import/export,
snapshots (save / restore / delete), appearance (language, theme), storage usage, reset.

**Global** — command palette (Ctrl/⌘ K) with actions + search across sites and people; toasts; undo/redo
(Ctrl Z / Ctrl Shift Z); shortcuts sheet (?).

**Export** modal — CSV, Excel‑friendly TSV, Markdown, WhatsApp text, iCalendar (.ics), JSON; column toggles; filter to
one person; hide people / sites; live preview; copy / download.

---

## 6. Interaction contract

* All mutations go through `commit(fn, {render, solve, coalesce})` → history, autosave (350 ms), render, and
  debounced solve (500 ms) when `engine.live` and the change affects the plan.
* Text inputs update on `input` without re‑render; structural re‑render on `change`.
* Solver jobs carry an id; a new job terminates the previous worker.
* Every visible string comes from `T` with `{Sites}`‑style vocabulary tokens.
* RTL: `dir="rtl"`, logical properties (`inset-inline`, `margin-inline`), mirrored chevrons.

---

## 7. Acceptance

* Template "Field inspections" solves a 4‑week month with zero open seats and zero rule breaks in < 3 s (balanced).
* Two consecutive solves with the same seed produce identical plans.
* Pinning a person survives a reroll; unpin restores freedom.
* Impossible data (e.g. 1 person, rest = 1, daily visits) → bend mode flags breaks; strict mode leaves seats open.
* Works offline from `file://` (main‑thread fallback) and hosted (worker).
* No console errors; layout verified at 1280 px and 390 px; AR mode mirrors correctly.
