---
carries: [outcome, non_goals, touchpoints, decisions]
skills: []
agent: claude
model: opus
effort: high
---

List what the owner, holding only the shape and their rulings, would not expect to find on this
branch, and what a maintainer of this repo would not merge. Edit nothing.

Look hardest for one-way doors decided without a question: an assumption in a report that is a
one-way door, a new dependency, a changed contract, schema or file format, a first instance of a
pattern, a changed test assertion. Then for what surprises without being a door: work beyond the
outcome, a different mechanism than the decisions chose, code that does not read like the code
around it.

Add to the report:

```
Findings: T<n>/F1 - <file:line> - <what is unexpected, and why the owner or a maintainer would object> - fix: <the fix> - door: two-way | one-way, <who pays to undo it>
```

`Findings: none` when there are none.
