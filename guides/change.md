# change

Domain: Change. Make the shape's change in this worktree, or fix the findings handed over, so that
each requirement holds by evidence and nothing else moves. It takes the shape's outcome,
requirements, non-goals, constraints, touchpoints, decisions and oracles, the owner's rulings, and
when fixing the findings with the reports that raised them; it returns commits on the work branch
and a report. It reads no config.

## Principles

- **Minimal change.** The change is the smallest one that makes the requirements hold, at their
  root cause, not at a symptom. What the shape does not ask for does not ride along.
- **Root cause by the scientific method.** A failure nobody expected is explained with evidence
  before anything changes to make it pass (`mt get debugging`).
- **Test oracle.** Each requirement is shown by a check that can fail: its oracle, or a test
  written from it.
- **Goodhart's law.** A check stops showing anything once it is changed to pass, so oracles and
  what tests assert are not yours to bend.

## Objectives

- **Every requirement holds**, shown by its oracle when the shape has one, its `oracles` block
  piped to `mt oracle run -`, else by a test written from it. A blocked oracle is reported with
  what it needs. A requirement with no observable form gets a test you pick, recorded as an
  assumption.
- **Your change is what makes each oracle pass.** An oracle whose `base` is fail fails on the
  oracle commit and passes on yours. One that already passed without your change, or failed there
  on an error, proves nothing about your change and is a question.
- **Oracle files are never changed**, and `mt oracle run` reports none tampered. An oracle you
  judge wrong is a question with the contradiction and its source, never an edit. Changing what an
  oracle runs through but does not pin, such as its runner's config, a shared base class or the
  test script, is a one-way door like changing what a test asserts (`mt get door-rule`).
- **No non-goal is built.** The constraints, decisions and the owner's rulings are followed.
- **A change outside the touchpoints has a reason.**
- **When fixing, only the findings are fixed.** The owner's rulings decide any finding they cover.
  A finding you judge wrong is not fixed, and the report says why.
- **The repo's own checks pass before you claim success.** Find them in its manifests and agent
  instructions; never invent them. A failing check is not success.
- **Commits stay on the work branch, unpushed.** The branch is this Task's destination: never
  push or merge it. The commit guide (`mt get commit`) defers to that destination.
- **Your runs never write to the owner's `mt` usage log.** Every manual run of `mt`, and every run
  of a script, test or mutant that may call it, sets `MT_LOG` and `XDG_STATE_HOME` to scratch
  locations on its own command line. Loading your guides with the installed `mt get` is not such a
  run; it stays logged. Workaround for `mt` logging every run to the owner's usage log, with no way
  to tell a development or test run from a use; remove when `mt` keeps such runs out of that log
  itself.

## Report

Besides what orca-worker asks: each requirement's status and the evidence for it; each finding's
fix and commit, or why it was not fixed; each check and its result; each file outside the
touchpoints and why.
