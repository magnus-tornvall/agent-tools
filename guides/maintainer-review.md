# maintainer-review

Would a maintainer of this repo merge the branch? Edit nothing.

## Objectives

- **The repo's own checks pass on the branch.** Find them in its manifests and agent instructions;
  never invent them.
- **Every changed existing test assertion is flagged**, and so is every file outside the
  touchpoints.
- **No bug, no missing failure or boundary path, no broken constraint, no dead or leftover code**,
  and nothing else that would stop a merge.

## Report

Besides what orca-worker asks: each check and its result, and the findings, or none. A finding
names its place, the input or state that shows it, the fix, and its door: two-way, or one-way and
who pays to undo it (`mt get door-rule`).
