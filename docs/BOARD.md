# Job board (Claude + Codex)

Read this before starting any job. Claim a job here first (owner, files, start time). Never edit files another agent has claimed. Work in your own branch or worktree. Merge to main only after `node tests/run-all.cjs` passes, then mark the job done with a one-line note in the log.

## Jobs

| Job | Owner | Status | Files claimed | Started |
|---|---|---|---|---|
| Winterton FireWatch Events sync and Station data | Codex | in progress: Station data live, backfill running | C:\Users\paulm\relay\winterton-events-worker.js, wrangler.events.toml, Events-tab sync code | 2026-11-27 06:42 |
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
