# verification: maintainer

Domain: Verification. Judges whether a maintainer of the repo would merge the work branch, so that
nothing reaches the owner that the repo's own standards would turn away. It rests on the test
oracle: the repo's checks and conventions are the expected result, and the diff is judged on its
own merits, not on what it was meant to do. It runs the repo's checks and edits nothing. It reads
no config.

## Given and withheld

- **Given** the shape's `constraints` and `touchpoints`, and the assumptions, questions and check
  results from the change reports.
- **Withheld** the shape's `outcome`, `purpose`, `requirements`, `non_goals` and `decisions`, since
  a maintainer judges the diff on its own merits.

Fixed: changing it is the owner's call.

## Objectives

- **The repo's own checks pass on the branch.** Find them in its manifests and agent instructions;
  never invent them.
- **Every changed existing test assertion is flagged**, and so is every file outside the
  touchpoints.
- **No bug, no missing failure or boundary path, no broken constraint, no dead or leftover code**,
  and nothing else that would stop a merge.

## Report

Besides what the verification guide asks: each check and its result.
