# change

Make the shape's change in this worktree, or fix the findings handed over.

## Objectives

- **Every requirement holds**, shown by a test written from it. A requirement with no observable
  form gets a test you pick, recorded as an assumption.
- **No non-goal is built.** The approach, constraints, decisions and the owner's rulings are
  followed.
- **A change outside the touchpoints has a reason.**
- **When fixing, only the findings are fixed.** The owner's rulings decide any finding they cover.
  A finding you judge wrong is not fixed, and the report says why.
- **The repo's own checks pass before you claim success.** Find them in its manifests and agent
  instructions; never invent them. A failing check is not success.
- **Commits stay on the branch.** Never push or merge.
- **Your runs never write to the owner's `mt` usage log.** Every manual run of `mt`, and every run
  of a script, test or mutant that may call it, sets `MT_LOG` and `XDG_STATE_HOME` to scratch
  locations on its own command line. Loading your guides with the installed `mt get` is not such a
  run; it stays logged.

## Report

Besides what orca-worker asks: each requirement's status and the evidence for it; each finding's
fix and commit, or why it was not fixed; each check and its result; each file outside the
touchpoints and why.
