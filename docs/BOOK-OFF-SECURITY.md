# Book Off server approval — local review handoff

## Scope and safety

Only local source, dependencies and tests were changed. No app push, Cloudflare deployment,
real credential enrolment or real FireWatch booking/event test was performed. Existing
tracker artwork/navigation edits and `.codex-attachments/` remain intact. PIN automation,
existing relay secrets and userscript update/download URLs were not changed.

The relay directory was not a Git repository. Its original `worker.js` is preserved as
`C:\Users\paulm\relay\worker.before-bookoff-security.js`. Original tracker HTML/SW working
copies were preserved as ignored `tests/*.before-bookoff-security.local.*` baselines.
The review diff must distinguish these pre-existing edits from this job's work.

## Trust boundary

- The original route remains app → Cloudflare Durable Object → Autobook → FireWatch.
- `@simplewebauthn/server` 14.1.0 verifies owner registration and authentication. ES256
  and RS256 enrolment are offered. Authentication requires a valid enrolled-key
  signature, the server challenge, exact origin/RP ID, user presence and user verification.
- Origin: `https://paulmatthews777-pixel.github.io`; RP ID:
  `paulmatthews777-pixel.github.io`. This covers that whole origin, NOT just the tracker
  URL path. Use a dedicated owner-controlled origin if stronger app isolation is needed.
  The fwbook credential belongs to its own RP and cannot simply be imported.
- A separate, new `OWNER_ENROLLMENT_TOKEN` (at least 32 characters) is required on both
  registration steps, in addition to origin and relay-key checks. The token is entered
  manually, not stored by the setup page. Only one owner credential is accepted.
  Existing local-only tracker credentials are not silently trusted.
- Registration/authentication challenges expire after 120 seconds. Valid authentication,
  explicit cancellation or expiry consumes the authentication challenge. Invalid bindings
  or signatures cannot revoke a valid owner's challenge. Successful queue insertion, credential-counter update and
  deduplication commit atomically in one Durable Object storage transaction.
- Approval binds the exact `[booking ID, original request text]`, including the machine
  ranges. Modifying times or the ID invalidates it. The unchanged `#BOOK [...]` text
  remains what Autobook consumes.
- In `enforce` mode, EVERY `/req` submission must be a valid approved Book Off. Plain
  messages, old app payloads and `#BOOKON` cannot bypass this check. Book On and other
  message submissions are intentionally rejected in that mode; this job does not secure
  or implement them. Existing unapproved queued records are not executed in enforce mode.
- Canonical range coverage is indexed server-side to return the original receipt for
  identical/adjacent-equivalent bookings. This includes uncertain/failed requests: no
  automatic retry. A new legitimate booking after a manual FireWatch correction would
  need an explicit owner-controlled reconciliation design; no public reset endpoint exists.
- Browser state persists a request ID before submission, tracks it for status lookup and
  never automatically resends after a lost reply. Server deduplication is independent of
  browser storage and applies across devices.
- The NEW booking client checks `/auth/config` before offering approval. In preparation
  it is setup/probe-only and cannot submit bookings. A passkey approval UI therefore does
  not imply security while the backend still admits legacy clients.
- If a POST never reached the Worker, an explicit recovery flow checks its ID. Only a
  404 after a three-minute wait plus a NEW successful non-queuing phone verification can
  clear the local guard. Existing server records cannot be cleared this way. Reset queues
  nothing; a separate review and fresh approval are still required to send.

## Endpoints

Existing `/req`, `/next`, `/requeue`, `/status` remain, with approval enforcement at queue
entry and approval checks on dispatch/requeue in enforce mode.

| Endpoint | Purpose |
| --- | --- |
| GET `/auth/config` | Authenticated preparation/enforcement and enrolment state |
| POST `/auth/register/options` | Owner-token-gated registration challenge |
| POST `/auth/register/verify` | Verify registration; persist enrolled public credential |
| POST `/auth/book-off/options` | Expiring challenge bound to a validated request |
| POST `/auth/book-off/cancel` | Delete a challenge; never queue |
| POST `/auth/book-off/probe` | Verify a fake approval, consume it, return `queued:false`; never queue |

All auth routes require exact app origin and the existing relay key. Enrolment additionally
requires the NEW owner token. Credential private keys never leave the authenticator.
Production source has no test-storage inspection endpoint. Miniflare tests add one only
in their local bundle entry point to inspect rejected-request queue state.

## Status semantics

- Queued: **Sent to relay · Waiting for FireWatch**.
- Booked off: **Confirmed present in FireWatch (new or existing)**, only after Autobook positively confirms all ranges by calendar read-back and
  sends `readbackVerified:true`. The Worker requires that flag in enforce mode; the app
  never renders a `booked` response without it as a confirmed booking.
- Failed/stalled/missing/uncertain: **Check FireWatch** or awaiting confirmation, never
  automatic resubmission. A 404 is not proof of failure; the app can continue status polling.
- The PC key remains a trusted execution boundary: Cloudflare cannot independently
  query FireWatch; it trusts the authenticated Autobook result. Compromise of the PC/key
  is outside this passkey approval control.

## False “not found” investigation

Sanitised inspection of existing audits found three cases with “form closed” followed by
“NOT FOUND”. They contain no captured calendar window/segments, so they cannot establish
that FireWatch rejected the booking, or identify the exact cause.

Current `covered()` already merges adjacent coverage. Midnight alone is NOT established
as the cause. Two independent source defects were identified:

1. Date navigation waited for any grid items, including an old grid, then used a fixed delay.
   It did not prove the expected days were loaded.
2. The loop advanced seven days from the range start, not from calendar-week boundaries.
   A Sunday → Monday booking could skip the second week entirely.

Read-back now queries the same read-only Calendar/GetEmployeeCalendar endpoint and filter
shape used by the existing planner feed, for each intersecting Monday week. It validates
the returned grid/Records structure instead of reading whichever DOM grid happens to be
visible; parses Activity segments and nested appointments; preserves adjacent coverage;
and compares timezone-bearing timestamps in Europe/London wall time.

A permitted read-only live query for the already-existing overnight booking's week returned
HTTP 200 with the expected grid/Records structure. A follow-up found no signed-in FireWatch
tab and was stopped. No booking was recreated. The exact historical cause and the complete
new read-back's parity with the current live response remain to be checked read-only before
any approved real write. The artifact URL returned only its unverified-content notice, not
the procedure text; no embedded instructions were followed and no artifact content was sent to Claude.

## Local evidence

Baseline: `node tests/run-all.cjs` printed `RESULT: ALL PASS`.

Worker: `npm test` in the relay project runs the actual bundled Worker, Cloudflare workerd
via Miniflare, real Durable Object transactions and the established verifier. Generated
test credentials sign real assertions; verification is not mocked. It covers owner-only
enrolment, missing/invalid approval, signature/origin/RP/challenge/UP/UV/credential failures,
cancellation, expiry, replay, changed times/ID, concurrent duplicate posts, non-queuing probe,
lost-response ID lookup, canonical duplicate receipts, queue rejection, PC format retention
and read-back confirmation. Preparation-mode compatibility is separate.

Tracker: `node tests/run-all.cjs` includes original regressions plus actual-client/local-Worker
integration and calendar read-back regressions. Test relay path defaults to the owner's
`~/relay`; set `RELAY_PROJECT_DIR` elsewhere.

Browser: `node tests/bookoff-browser.cjs` uses a disposable headless Edge profile at 412×915,
a CDP virtual authenticator, the actual HTML/client and the local Worker. All requests are
intercepted; service workers are disabled for the test. It covers real WebAuthn API
registration/assertions, non-queuing probe, custom review → verification → queue and
cancellation. This is NOT a Samsung system-prompt test.

Initial local harness failures (removed Miniflare inspection API and an awaited modal
promise in the browser test) were corrected once each; their retries passed. Dependencies
are locked; patched dev transitive versions are constrained in `package.json` overrides.

## Proposed rollout — each release step needs separate approval

1. Review both diffs and local test results. Do not push or deploy yet.
2. With separate Cloudflare approval, deploy the Worker in **prepare** mode with a NEW
   owner enrolment token and `nodejs_compat`. Existing origin/relay/PC keys stay unchanged.
   Preparation does NOT enforce approval on legacy clients. Do not present it as protected.
3. With separate app approval, publish only the setup page/scripts first (or a separately
   approved preview served under the SAME final HTTPS origin). Keep the old booking app
   available until enrolment/probe succeed. A different localhost/preview RP credential
   does not enrol the final app origin.
4. Owner enrols the Samsung once, then runs the explicitly non-queuing probe. Check
   fingerprint and Android screen-lock fallback, cancellation, UV failure, reload and
   Samsung browser/PWA behaviour. Remove the enrolment token afterwards through a separately
   approved secrets operation; never commit it. Recovery/re-enrolment is an owner operation,
   not a public API.
5. Review/read-only-check the read-back on an EXISTING event and both calendar days; do not
   recreate it. Update the local Autobook process to the reviewed code before enforcement,
   so it supplies `readbackVerified`. Restart only when idle, with owner approval.
6. With app push approval, stage the new booking client/SW. It stays setup-only while
   the Worker reports prepare; do not describe this as an available secured booking route.
   Confirm the correct cache and probe on Samsung. Plan the explicit cutover: legacy
   Book Off remains available through the old client during setup, but cached old clients
   must be blocked once enforcement starts. No seamless old-client compatibility is promised.
7. Drain/reconcile old pending requests. With a NEW, separate Cloudflare approval, set
   `BOOK_OFF_APPROVAL_MODE=enforce`. Old/alternate clients must now be rejected. This also
   blocks legacy Book On/message submissions by design.
8. Only with explicit approval, perform one real Book Off test and check actual FireWatch
   read-back and both calendar views. Do not automatically retry uncertain outcomes.

The default preparation mode is a migration mechanism, not security enforcement. Never
“roll back” an enforcement failure by silently accepting unapproved writes. If passkeys
fail after enforcement, leave writes blocked and investigate.

## Approved summary-packet review

Codex returned findings; confirmed local corrections are: setup-only preparation client,
non-destructive rejection of invalid authentication attempts, wording that confirms
coverage rather than claiming a new event, and explicit owner-verified recovery of a
never-delivered request. Live parser parity and Samsung/service-worker upgrade checks
remain release gates, not verified claims. Claude Code exited with code 1 without a
report. No second review round was run; the corrected source has not received another
reviewer verdict.
