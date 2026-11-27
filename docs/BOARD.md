# Job board (Claude + Codex)

Read this before starting any job. Claim a job here first (owner, files, start time). Never edit files another agent has claimed. Work in your own branch or worktree. Merge to main only after `node tests/run-all.cjs` passes, then mark the job done with a one-line note in the log.

Before ending every task, update docs/BOARD.md with the actual outcome and current status. This is mandatory for completed, read-only, blocked, and unfinished work. Add a one-line log entry and keep any open work marked in progress or blocked.

## Jobs

| Job | Owner | Status | Files claimed | Started |
|---|---|---|---|---|
| Winterton FireWatch Events sync and Station data | Codex | done: private backfill live, five-minute polling enabled | C:\Users\paulm\relay\winterton-events-worker.js, wrangler.events.toml, Events-tab sync code | 2026-11-27 06:42 |
| Events page (Events tab UI: type filter, colours, date search, period pie, event detail) | Claude | done (v53) | index.html (#t-activity Events UI only), new events-page.js, sw.js (version bump). NOT touching winterton-events.js, worker, collector | 2026-11-27 10:05 |
| Pay page + Home tile | Claude | done (v50) | index.html (#t-pay, Home tiles), autobook/pay-sync.cjs, autobook/autobook.cjs (pay timer), C:\Users\paulm\relay\worker.js (/data routes) | 2026-11-27 07:00 |
| Holiday page + Home tile | Claude | done (v51) | index.html (#t-holiday, holiday tile), autobook/holiday-sync.cjs, autobook/autobook.cjs (holiday timer) | 2026-11-27 07:26 |
| Personal info page + Home tile | Claude | queued | index.html (#t-personal), autobook/personal-sync.cjs | |
| Notifications | Claude | queued | sw.js, relay push | |
| Daily check | Claude | queued | scheduled task, scripts/daily-check | |

## Log
- 2026-11-27 07:00 Claude: board created; Paul approved all dashboard screens (dashboard-mockups.html), built one at a time.
- 2026-11-27 07:10 Claude: Pay done (v50). Relay worker.js got /data/pay|holiday|personal routes (deployed 1d5ea1af). autobook syncs Payments hourly.
- 2026-11-27 07:40 Claude: Holiday done (v51). autobook reads FireWatch entitlement every 15 min, full calendar scan hourly or when it changes; relay /data/holiday.
- 2026-11-27 08:02 Codex: Station data is live with separate Planner activity and FireWatch events views. Private Worker is online. The September and October backfill plus November entries is running. No complete snapshot was available at 08:02. The collector fix is prepared for the v52 release.
- 2026-11-27 10:05 Claude: claimed Events page UI (branch claude/events-page); Codex files untouched.
- 2026-11-27 10:20 Claude: Events page done (v53): events-page.js reads the private Worker, 8-category hours pie, filters, tap-for-crew. Codex files untouched.
- 2026-11-27 09:01 Codex: Made the board update mandatory at the end of every task in AGENTS.md and the board instructions.
- 2026-11-27 09:03 Codex: Private Worker health returned waiting with no published snapshot. The 08:29 collector job exited with code 1. The next hourly run is scheduled for 09:09. No release pushed.
- 2026-11-27 09:05 Codex: Live Worker rejected an incomplete snapshot as expected. The three-entry FireWatch probe passed with Personnel and the one-month window. Improved scheduled failure logging and started the full sync.
- 2026-11-27 09:14 Codex: Scheduled log isolated the failure to FireWatch closing an event dialog. Disabled the dialog close animation and made readiness checks respond to DOM changes. Three live Winterton entries passed with Personnel. Full one-month run started. Worker snapshot is still unverified.
- 2026-11-27 09:49 Codex: Direct FireWatch detail fetch and month checkpoints went live. Private Worker serves 131 unique events, 226 Personnel rows and 131 creator labels. A scheduled run succeeded and reused all 131 details. Five-minute polling is enabled. Collector changes are local on the v52-based release worktree.
- 2026-11-27 10:09 Codex: Reviewed the local and main boards. Main records Claude's Events UI complete in v53 at 686b03b. The local board records the completed private backfill and five-minute collector, which are still pending Git integration. Personal info, Notifications and Daily check remain queued on main.
- 2026-11-27 10:13 Codex: Integrated the direct-detail collector and backfill board notes onto Claude's v53 main. Prepared v54 with matching app and service-worker versions.
