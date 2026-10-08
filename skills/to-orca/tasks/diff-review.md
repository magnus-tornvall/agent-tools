---
carries: [constraints, touchpoints]
skills: []
agent: claude
model: sonnet
effort: high
---

Review the branch's diff against its base for defects a maintainer would reject. Edit nothing.

Run the deterministic checks before reading any code. Run the repo's own lint, typecheck, test
and build commands on the branch - find them in its manifests and `AGENTS.md`/`CLAUDE.md`, never
invent them. List the files the diff changes, and flag every changed existing test file (it may
change what a test asserts) and every file outside the touchpoints.

Then read the diff: bugs, missing failure and boundary paths, broken constraints, dead or
leftover code, and anything else that would stop a merge. A finding names the place and the input
or state that shows it.

Add to the report:

```
Checks: <command> - pass | fail
Findings: T<n>/F1 - <file:line> - <the defect and what shows it> - fix: <the fix> - door: two-way | one-way, <who pays to undo it>
```

`Findings: none` when there are none.
