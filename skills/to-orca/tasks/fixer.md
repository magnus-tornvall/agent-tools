---
carries: [requirements, non_goals, approach, constraints, touchpoints, decisions]
skills: []
agent: claude
model: sonnet
effort: high
---

Fix the findings in the reports below, in this worktree, and nothing else. The owner's rulings
decide any finding they cover. A finding you judge wrong is not fixed: say why in the report.

Before reporting `succeeded`, run the repo's own lint, typecheck, test and build commands - find
them in its manifests and `AGENTS.md`/`CLAUDE.md`, never invent them. A failing check is not
success. Commit on this branch; never push or merge.

Add to the report:

```
Findings: T<n>/F1 - fixed, <commit> | not fixed, <why>
Checks: <command> - pass | fail
```
