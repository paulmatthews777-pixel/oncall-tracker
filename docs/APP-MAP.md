# Live Crewing App Map

## 1. Files and what each does
- [index.html](file:///C:/Users/paulm/oncall-tracker/index.html) (lines 1–725): Single-file PWA containing styles, splash screen, top bar, 4 visible tabs (`#t-week`, `#t-audit`, `#t-live`, `#t-planner`), hidden `#t-data` tab, bottom `<nav>`, and all client-side JS (contract calculations, rendering, time-off saver, live station status, planner grid, hash/fetch/localStorage sync).
- [planner-feed.user.js](file:///C:/Users/paulm/oncall-tracker/planner-feed.user.js) (lines 1–245): Userscript (v1.16) running on `https://humberside.firewatch.cloud/FireWatchWebClient*` that polls FireWatch planner and calendar endpoints and pushes `planner.json`, `range.json`, and `contract.json` to GitHub (`paulmatthews777-pixel/oncall-tracker`, branch `live`).
- [planner-feed.js](file:///C:/Users/paulm/oncall-tracker/planner-feed.js) (lines 1–23): Legacy v1 `fwPlannerSnapshot` helper returning `{v:1, ...}` with 24-hour `'1'/'0'` `on` strings per person (no `iv` intervals or `bars`).
- [sw.js](file:///C:/Users/paulm/oncall-tracker/sw.js) (lines 1–4): Service worker (`tracker-v30`) that precaches `./`, `index.html`, `manifest.webmanifest`, `icon-fire-192.png`, `icon-fire-512.png`, and `splash.jpg`, deletes old caches on `activate`, and serves same-origin `GET` requests network-first with cache fallback.
- [manifest.webmanifest](file:///C:/Users/paulm/oncall-tracker/manifest.webmanifest) (line 1): PWA manifest for `Live Crewing` (`display: standalone`, `#0e1014` theme/background, `icon-fire-192.png` and `icon-fire-512.png` as `any maskable`).
- [tests/run-all.cjs](file:///C:/Users/paulm/oncall-tracker/tests/run-all.cjs) (lines 1–9): Runs `tests/real-files-week.cjs` in 3 timezones (`Europe/London`, `America/Los_Angeles`, `Asia/Tokyo`) and `tests/crew-flow.test.cjs`, printing `RESULT: ALL PASS` or `RESULT: FAIL`.
- [tests/real-files-week.cjs](file:///C:/Users/paulm/oncall-tracker/tests/real-files-week.cjs) (lines 1–31): Extracts `addD`, `plannerWeekStart`, and planner click/change handlers from `index.html` plus `CF`/`cMid`/`cAdd`/`cMon`/`cIso` from `planner-feed.user.js` to test Monday week alignment and day/week navigation.
- [tests/crew-flow.test.cjs](file:///C:/Users/paulm/oncall-tracker/tests/crew-flow.test.cjs) (lines 1–77): `node:test` suite extracting `fwForEachResourceRow`, `fwPlannerItems`, `fwIsOnCallItem` (`planner-feed.user.js`) and `fwCrewInSlot`, `fwCrewNumbers`, `plannerWeekStart` (`index.html`).

## 2. Tabs and what each shows
Bottom `<nav>` ([index.html:262-267](file:///C:/Users/paulm/oncall-tracker/index.html#L262-L267)) switches tabs via `show()` ([index.html:537](file:///C:/Users/paulm/oncall-tracker/index.html#L537)):
- **Week (`#t-week`, lines 189–200)**: Weekly ring hero (`#whero`, `hero()` line 311), "Save hours: this week (to still hit 85)" (`#wcur`, `saver()` lines 426–479, 508), Specified bands P1/P3/P4 (`#wbands`, `band()` line 319), 3-stat summary (`#wstats`, line 333), "Day by day" expandable shifts (`#wdays`, lines 373–386), "Full numbers" (`#wfull`, `fullTable()` line 362), "Save hours: coming weeks (to still hit 85)" (`#oweeks`, lines 496–509), and week navigation (`#pw`, `#nw`, `#tw`, lines 528–530).
- **Audit (`#t-audit`, lines 202–217)**: 56-day audit ring hero (`#ahero`, line 336), "Save hours: 8 week audit (to still pass)" (`#afree`, `#copyoff`, `saver()` lines 493–494), Specified bands (`#abands`, line 337), 3-stat summary (`#astats`, line 338), "What is left" (`#aneed`, lines 389–402), "Full numbers" (`#afull`, line 208; not populated in `render()`/`extras()`), "Week by week" (`#aweeks`, lines 512–519), "How hours are counted" (`#arules`, line 520), and "Audit settings" (`#auditDate`, `#sub`, lines 211–216).
- **Live (`#t-live`, lines 219–224)**: Station run-status banner (`#lhero`: `ON THE RUN`, `OFF THE RUN`, or `OUT OF DATE`, `renderLive()` lines 601–608), "Station status" 24-hour expandable `<details>` rows with 15-minute slots (`#lsh`, `#lhours`, lines 628–641), "Crew roster" sorted by on-now / activity / off (`#lcrew`, `#lon`, lines 610–627), and "Refresh now" (`#lrefresh`, line 643).
- **Planner (`#t-planner`, lines 226–231)**: Mode switcher (`#pmode`: Day (24hr), Week, Custom) and date controls (`#pctl`, `#pnote`, `renderPlanner()` lines 694–704), scrollable Crewing/Qualifications/Resource grid (`#pbody`, `dayHTML()` lines 665–678, `multiHTML()` lines 679–693), tap-bar detail box (`#ppop`, lines 664, 712), colour legend (`#pleg`, line 707), and "Refresh now" (`#prefresh`, line 714).
- **Data (`#t-data`, lines 235–258, not in `<nav>`)**: Clipboard import (`#clip`, line 532), manual CSV paste (`#paste`, `#import`, line 533), single-entry form (`#add`, line 534), data metadata (`#dinfo`, line 523), and entry list (`#rows`, line 342).

## 3. Data flow from the FireWatch userscript to the repo and into the app
1. **FireWatch → Userscript** (`planner-feed.user.js`):
   - `fwDay()` (lines 22–29) POSTs `/FireWatchWebClient/Planner/GetPlannerRows` for `STATION_ID=28` (Winterton) using `__RequestVerificationToken`.
   - `fwPlannerSnapshot()` (lines 79–110) fetches days `0..3` via `fwDay()`, building a `v:2` snapshot (`rows` for 48h, `people` with `iv` & `bars`).
   - `fwRange()` (lines 115–141) fetches days `-7..+21` via `fwDay()`, building a `v:3` range (`dates`, `rows`, `people`).
   - `cWeek()` (lines 159–170) POSTs `/FireWatchWebClient/Calendar/GetEmployeeCalendar`, and `cExport()` / `contractText()` (lines 176–194) output CSV lines (`date,start,end,type,band`).
2. **Userscript → GitHub repo (`live` branch)** (`planner-feed.user.js`):
   - `push()` (lines 206–217) uses `gh()` (`GM_xmlhttpRequest` to `api.github.com/repos/paulmatthews777-pixel/oncall-tracker/contents/<file>`) with `GM_getValue('ghtoken')` to `PUT` onto `BRANCH='live'`:
     - `tick()` (lines 218–227, every 60s) → `planner.json`
     - `rTick()` (lines 143–149, checked every 5m, pushed every 30m) → `range.json`
     - `cTick()` / `contractTick()` (lines 196–200, 229–233, every 5m, pushed on change or >15m) → `contract.json`
   - Menu command `'Open Live in tracker app'` (line 243) opens `index.html#p=<base64url(snap)>`.
3. **GitHub repo / URL → App** (`index.html`):
   - `RAW` (`https://raw.githubusercontent.com/paulmatthews777-pixel/oncall-tracker/live/`, line 544) feeds:
     - `fetchLive()` (line 555) → `planner.json` → `setSnap()` (`localStorage` `'oncall-live'`) → `renderLive()`.
     - `fetchRange()` (line 648) → `range.json` → `localStorage` `'oncall-range'` → `renderPlanner()`.
     - `fetchContract()` (line 554) → `contract.json` → `parsePaste()` → `save()` (`localStorage` `'oncall-tracker-v2'`) → `render()`.
   - `fromHash()` (`#d=`, line 540) and `fromPHash()` (`#p=`, line 556) import contract/live data from the URL hash.
   - Polls on startup, every 60s while `document.visibilityState==='visible'` (line 719), and on `visibilitychange` (line 721).

## 4. How to run the tests
Run from the repository root:
```sh
node tests/run-all.cjs
```
`tests/run-all.cjs` (lines 1–9) executes `tests/real-files-week.cjs` under `Europe/London`, `America/Los_Angeles`, and `Asia/Tokyo`, followed by `tests/crew-flow.test.cjs`, and prints `RESULT: ALL PASS` on success (exit code `0`).

## 5. Wish checklist
- **Two Save hours sections (current week on Week tab, 8-week audit on Audit tab)**: **BUILT** — Week tab `#wcur` (`index.html:192`, `saver()` line 508) and Audit tab `#afree` (`index.html:204`, `saver()` line 494).
- **Green for good hours and red for short hours**: **BUILT** — `--good:#33d686` and `--bad:#ff3030` (`index.html:17`) applied via `ok`/`no`/`met` classes in `hero()` (line 315), `band()` (lines 321–322), `frow()` (lines 359–360), and `saver()` (line 445).
- **Save and send to Claude button and what it actually does**: **BUILT** — `saver()` (`index.html:459-478`) opens `#cfm` modal; `#cfmYes` saves to `localStorage` (`oncall-offsel-<btnId>`), copies the list via `navigator.clipboard.writeText()`, and invokes `navigator.share()` if available (it does not call Claude or FireWatch directly).
- **Live tab 24-hour view in 15-minute sections with role letters and yellow names for on-call now**: **PARTIAL** — `renderLive()` (`index.html:628-641`) renders 24 hourly `<details class="hr">` rows with 4×15-minute slots (`qs`), but role letters (`p.role`) and yellow on-call-now names (`.pl.yl`, `#ffbf28`) are on the Planner tab (`dayHTML()` line 677), not in Live's 24-hour view.
- **Station on the run status**: **BUILT** — `runState()` (`index.html:558`) and `renderLive()` (`index.html:606-608, 641`) display `ON THE RUN`, `ON THE RUN (MINIMAL)`, `OFF THE RUN`, or `OUT OF DATE`.
- **Activity tab with date search, This week and This month buttons, category pie chart, tap-an-event pop-up, and personnel with qualifications**: **NOT BUILT** — `<nav>` (`index.html:262-267`) has only Week, Audit, Live, Planner; no Activity tab, date search, This week/This month buttons, or pie chart exist (though tap-bar `#ppop` at line 712 and quals `p.q` at lines 611/675 exist on Live/Planner).
- **Planner tab with day, week and custom range**: **BUILT** — `#t-planner` (`index.html:226-231`) and `renderPlanner()` (`index.html:694-707`) switch between `day` (`dayHTML()`), `week`, and `custom` (`multiHTML()`).
- **Full-screen start splash with FIREWATCH in red and the version number**: **BUILT** — `#splash` (`index.html:181-185`) renders full-screen `splash.jpg`, red `FIREWATCH` (`#ff1a1a`), and `#appver` set to `APP_VERSION='v30'`.
- **App icon**: **BUILT** — `index.html:9` links `icon-fire-192.png`, `manifest.webmanifest:1` declares `icon-fire-192.png` and `icon-fire-512.png`, and `sw.js:1` precaches both.
