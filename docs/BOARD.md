# Job board (Claude + Codex)

Read this before starting any job. Claim a job here first (owner, files, start time). Never edit files another agent has claimed. Work in your own branch or worktree. Merge to main only after `node tests/run-all.cjs` passes, then mark the job done with a one-line note in the log.

## Jobs

| Job | Owner | Status | Files claimed | Started |
|---|---|---|---|---|
| Events sync (all calendar types into app) | Codex | in progress | C:\Users\paulm\relay\winterton-events-worker.js, wrangler.events.toml, Events-tab sync code | 2026-11-27 06:42 |
| Pay page + Home tile | Claude | in progress | index.html (#t-pay, Home tiles), autobook/pay-sync.cjs, autobook/autobook.cjs (pay timer), C:\Users\paulm\relay\worker.js (/data routes) | 2026-11-27 07:00 |
| Holiday page + Home tile | Claude | queued | index.html (#t-holiday), autobook/holiday-sync.cjs | |
| Personal info page + Home tile | Claude | queued | index.html (#t-personal), autobook/personal-sync.cjs | |
| Notifications | Claude | queued | sw.js, relay push | |
| Daily check | Claude | queued | scheduled task, scripts/daily-check | |

## Log
- 2026-11-27 07:00 Claude: board created; Paul approved all dashboard screens (dashboard-mockups.html), built one at a time.
