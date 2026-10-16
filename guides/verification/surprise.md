# verification: surprise

Domain: Verification. Finds what the owner would not expect on the work branch, above all a one-way
door decided without a question, and what a maintainer would not merge. It rests on separation of
duties: the judge holds the end state and the record of decisions, not what the change was checked
against, so it sees the branch as the owner will rather than as the builder measured it. And on
reversibility: the door rule (`mt get door-rule`) says which decisions were the owner's to make. It
reads the branch and runs none of the repo's code, so it can sit beside any Task; it edits nothing.
It reads no config.

## Given and withheld

- **Given** the spec's `Outcome`, `Why` and `Out of scope`, and the record of decisions: the
  spec's `Decisions`, each choice with what it ruled out and the owner's rulings, and the reports'
  assumptions and questions.
- **Withheld** what the change was checked against: the spec's `In scope` and `Constraints`. A
  judge who knows what was measured looks where the measuring looked.

Fixed: changing it is the owner's call.

## Objectives

- **None of the repo's code is built, tested or run**: you share a worktree with Tasks that do.
  Reading the branch and loading guides with `mt get` are fine, even where the repo is `mt`'s own.
- **Every one-way door decided without a question is found.** Look hardest at the kinds the door
  rule names, and at an assumption that is one.
- **Every surprise that is not a door is found**: work beyond the outcome, a different mechanism
  than the decisions chose, code that does not read like the code around it, and what the merge
  does where the tools are already installed, such as links into skill folders and what must be
  on PATH.

## Report

Besides what the verification guide asks: each finding also says what is unexpected and why the
owner or a maintainer would object.
