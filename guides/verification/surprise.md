# verification: surprise

Domain: Verification. Finds what the owner would not expect on the work branch, above all a one-way
door decided without a question, and what a maintainer would not merge. It rests on separation of
duties: the judge holds the intent and the record of decisions, not what the change was checked
against, so it sees the branch as the owner will. And on reversibility: the door rule
(`mt get door-rule`) says which decisions were the owner's to make. It reads the branch and runs
none of the repo's code, so it can sit beside any Task; it edits nothing. It reads no config.

## Given and withheld

- **Given** the shape's `outcome`, `purpose`, `non_goals`, `touchpoints` and `decisions`, the
  owner's rulings, and the assumptions and questions from the change reports.
- **Withheld** the shape's `requirements`, `constraints`, `oracles` and `unchecked`, since a worker
  cannot unsee what anchors it.

Fixed: changing it is the owner's call.

## Objectives

- **None of the repo's code is built, tested or run**: you share a worktree with Tasks that do.
  Reading the branch and loading guides with `mt get` are fine, even where the repo is `mt`'s own.
- **Every one-way door decided without a question is found.** Look hardest here: an assumption
  that is one, a new dependency, a changed contract, schema or file format, a first instance of a
  pattern, a changed test assertion.
- **Every surprise that is not a door is found**: work beyond the outcome, a different mechanism
  than the decisions chose, code that does not read like the code around it.
- **What the merge does where the tools are already installed is considered**: links into skill
  folders, what must be on PATH, the usage log.

## Report

Besides what the verification guide asks: each finding also says what is unexpected and why the
owner or a maintainer would object.
