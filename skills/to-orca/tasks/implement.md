---
carries: [outcome, requirements, non_goals, approach, constraints, touchpoints, decisions]
skills: []
agent: claude
model: opus
effort: high
---

Make the shape's change in this worktree: every requirement holds, no non-goal is built, and the
approach, constraints and decisions are followed.

Write the tests from the requirements first. A requirement with no observable form gets a test
you pick; log the choice as an assumption. A change outside the touchpoints needs a reason in the
report.

Before reporting `succeeded`, run the repo's own lint, typecheck, test and build commands - find
them in its manifests and `AGENTS.md`/`CLAUDE.md`, never invent them. A failing check is not
success. Commit on this branch, leaving nothing uncommitted; never push or merge.

Add to the report:

```
Requirements: R1 - done, <test that shows it> | not done, <why>
Checks: <command> - pass | fail
Outside touchpoints: <file> - <why> | none
Status: clean | <what `git status --porcelain` still lists, and why>
```
