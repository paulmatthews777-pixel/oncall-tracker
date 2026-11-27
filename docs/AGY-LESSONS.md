# Agy lessons

Dated lessons added when Claude corrects an Agy decision. Read before every job.


- 2026-11-27: Every push bumps the number in APP_VERSION (index.html) and the cache name in sw.js together, so More > About shows the real version. Paul asked for this every time.
## 2026-11-26 — approved Book Off security review
- Never display the new booking approval flow while a preparation-mode backend still
  accepts legacy writes. Preparation is explicitly setup/probe-only in the new client.
- Do not consume an owner's authentication challenge on an invalid binding/signature;
  consume valid approvals atomically with queue insertion.
- Calendar coverage confirms presence, not creation of a new event. Say new or existing.
- Persisted attempts need explicit owner-verified recovery when the POST never arrived;
  no automatic retries, and never clear a known server record.
- A grid/Records response alone does not prove live parser parity. Keep that and real
  Samsung/service-worker checks as release gates. Claude Code returned no report.

