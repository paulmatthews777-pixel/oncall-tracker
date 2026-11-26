AGY HANDOFF - CSV export on Audit tab. Folder: C:\Users\paulm\oncall-tracker (branch main). Files you may change: index.html, sw.js, and new tests\csv-audit.test.js ONLY. Do NOT touch AGENTS.md or docs\AGY-LESSONS.md (not yours, uncommitted). Never push. Never read key.txt, pc-key.txt, url.txt or any token/PIN. One plain command at a time, allow-list only, one retry then stop and report.

GOAL: Add a "Download CSV" button to the Audit tab header (top right, red #d62828, white text, download icon, min height 44px, aria-label "Download audit as CSV"). Tap opens a bottom sheet: title "Save / Share audit CSV", filename LiveCrewing_Audit_YYYY-MM-DD.csv, period chips (Last 8 weeks default, This week, Custom), include options (Daily totals, Activity events; weekly audit + where hours went always included), red button "Save / Share". On tap: build CSV in the browser, then if navigator.canShare({files:[file]}) call navigator.share({files:[file]}) so Paul picks Drive > HFRS contract oncall > Audit exports (opens in Google Sheets); else fall back to Blob + a[download]. Show a toast "CSV ready". Mockup: https://claude.ai/artifact/FabzQy1fJjRLhSnA6HBtSE

CSV (UTF-8 BOM, CRLF, quote every field, prefix any cell starting with = + - @ with an apostrophe):
1 Summary rows: Exported (dd Mon yyyy hh:mm), Brigade number 5970, Contract hours per week 85, Audit period, Counted total / target, Difference, Rule: annual leave counts, detachments do not.
2 Weekly table, one row per audit week: Week commencing, P1 (weekday 06-18), P2 + unspecified (the U band), P3 (weekend nights), P4 (weekend days), Absence credit, Counted hrs, Detachment hrs (not counted), Days in audit, vs 85, Status (Met/Over/Short). Then rows: 8-week total, 8-week target (WEEKLY x 8 from the existing WEEKLY constant: P1 35, P3 13, P4 12, U 25), Difference per band. Part weeks: leave target/vs 85/status blank like the app does, show days in audit.
3 Entry table: Week commencing, Date, Type, From, To, Hours, Band, Counts toward 85 (Yes/No). Yes/No from the existing COUNTS and NEVER lists plus inWindow.
Rules found by Opus: audit data is entries from localStorage (fetchContract ~line 588, contract.json from the live branch); reuse calcRange(entries, audit-56, audit) per week; week loop ~line 546; ABS credit = h x 85/168 sits in no band so P1+P3+P4+U+ABS must equal Counted exactly; detachments are skipped by calcRange (NEVER list) so sum them separately; do NOT hardcode FireWatch targets 263/229/89.1/76; round only at output with the app's f1. Bump sw.js cache tracker-v40 to tracker-v41.

ACCEPTANCE (report each PASS/FAIL/NOT RUN with exact command and result):
A1 git diff --stat shows only index.html, sw.js, tests\csv-audit.test.js changed by you.
A2 sw.js contains tracker-v41.
A3 node tests\csv-audit.test.js prints PASS: loads buildAuditCSV with a fixture of entries, asserts per week P1+P3+P4+U+ABS equals Counted, entry Hours per band sum to weekly bands, detachment hours excluded from Counted, annual leave included, cells starting = + - @ are escaped.
A4 Button, sheet and handler exist in index.html (Select-String hits).
A5 No network calls added, no tokens or secrets in the diff.
LOG every decision (choice, options, reason) in a DECISIONS section of your final answer (you cannot write outside the repo). HAND-BACK: path, files verified, branch, changed files, diff summary, A1-A5 results. Stop and report for: unclear target, missing file, destructive step, push, PIN, tokens, security.

