---
carries: [outcome, requirements, non_goals, approach, constraints, decisions]
skills: []
agent: claude
model: sonnet
effort: high
---

Check the branch against the shape, holding only the shape, the reports and the code. Edit
nothing.

For each requirement, find the evidence that it holds: a test that asserts it, or an observation
you make yourself by running it. A requirement reported done with no evidence is a finding, and so
is evidence that asserts something weaker than the requirement. Then check that no non-goal is
built, and that the outcome, approach, constraints and decisions are what the branch does.

Run `git status --porcelain` before you run anything and again before you report. A tree dirty at
the first status is a finding, and so is anything that changed between the two; name the files,
and the command only when you can show it. Restore, delete and commit nothing.

A finding listed as dropped under Coordinator's dispositions is not a ruling: raise it again
only with evidence its reason does not cover.

Add to the report:

```
Requirements: R1 - holds, <evidence> | does not hold, <why>
Findings: T<n>/F1 - <file:line or requirement> - <the gap> - fix: <the fix> - door: two-way | one-way, <who pays to undo it>
```

`Findings: none` when there are none.
