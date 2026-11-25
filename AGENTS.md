# Live Crewing app rules
- Work only in this repo. Small jobs; stop at one retry, then report the blocker.
- Never say done until `node tests/real-files-week.cjs index.html planner-feed.user.js` passes in TZ=Europe/London, America/Los_Angeles and Asia/Tokyo.
- Test the real files, never copies or excerpts.
- Show the diff before any push. Never touch the FireWatch PIN or tokens.
- Finish with: changed files, test output, tokens used.
- Never change @updateURL or @downloadURL. If the working copy has edits you didn't make, list them and ask before committing.
