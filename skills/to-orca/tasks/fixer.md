---
carries: [requirements, non_goals, approach, constraints, touchpoints, decisions]
skills: []
agent: claude
model: sonnet
effort: high
---

Fix the findings listed under Coordinator's dispositions, in this worktree, and nothing else; the
reports are their context. The owner's rulings decide any finding they cover. A finding you judge
wrong is not fixed: say why in the report.

Before reporting `succeeded`, run the repo's own lint, typecheck, test and build commands - find
them in its manifests and `AGENTS.md`/`CLAUDE.md`, never invent them. A failing check is not
success. Commit on this branch, leaving nothing uncommitted; never push or merge.

Add to the report, keeping each finding's own ID (`T2/F1`, not a new one):

```
Findings: T2/F1 - fixed, <commit> | not fixed, <why>
Checks: <command> - pass | fail
Status: clean | <what `git status --porcelain` still lists, and why>
```
