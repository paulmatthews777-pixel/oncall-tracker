# Live Crewing app rules
- Work only in this repo. Small jobs; stop at one retry, then report the blocker.
- After changing code, never say done until `node tests/run-all.cjs` prints RESULT: ALL PASS. Run it as that one plain command. Read-only jobs don't need it.
- Test the real files, never copies or excerpts.
- Show the diff before any push. Never touch the FireWatch PIN or tokens.
- Finish with: changed files, test output, tokens used.
- Never change @updateURL or @downloadURL. If the working copy has edits you didn't make, list them and ask before committing.

Before starting any job, read docs/AGY-LESSONS.md and follow it. Add a dated lesson there whenever Claude corrects a decision of yours.
Before every decision and every command, log it with ONE plain command run on its own, never chained with && or ; : `node C:\Users\paulm\agy-feed\feed-log.cjs agy "what you decided"` or `cmd "the command"`. Then run your real command as a separate single command.

Before starting any job, read docs/BOARD.md. Claim the job there (owner, files, start time) and never edit files another agent has claimed. Work in your own branch or worktree. Merge to main only after node tests/run-all.cjs passes, then mark the job done on the board with a one-line note.
