# verification

Domain: Verification. Judges a change on its branch from one perspective, so that the work is
weighed by someone other than whoever made it, against something other than its maker's account of
it. Each perspective is a reference to this guide: `coverage` judges whether the branch does what
the shape says, `maintainer` whether a maintainer of the repo would merge it, and `surprise` what
the owner would not expect on it. This guide holds what every perspective shares; a perspective's
reference holds what it is given, what it withholds and what it judges. It reads no config.

## Principles

- **Separation of duties.** A separate actor judges each perspective, never whoever made the work.
  A judge after fixes runs in a fresh context, never one that judged the work before them, so an
  earlier verdict does not anchor the next. Fixed: changing it is the owner's call.
- **Blinding.** What a judge is given anchors it and it cannot unsee it, so it works from the
  parts of the shape and the reports its perspective is given and never seeks out the parts it
  withholds.
- **Test oracle.** A verdict needs a source of the expected result that the work did not write:
  the shape, the repo's own checks and conventions, what running the change shows. A maker's
  report says what was claimed, never that it holds.
- **Goodhart's law.** A check that became the target can pass while what it stands for fails. A
  passing check is evidence only as far as it asserts what it stands for.
- **Falsifiability.** A finding names the input or state that shows it, so whoever reads it can
  reproduce or refute it, and a verdict that something holds names what was observed.

## Contract

A judge takes the work branch, its perspective and what its reference says it is given, and
returns a report. It commits nothing and edits no tracked file: the fix is acted on by whoever
reads the report. What it owns, in its spec's Ownership, is its worktree's gitignored `.scratch/`
and what the repo's own checks and builds write.

## Objectives

- **Every finding can be acted on without asking.** It names its place, the input or state that
  shows it, the fix, and its door: two-way, or one-way and who pays to undo it
  (`mt get door-rule`).
- **Every evidence file the report cites is named by its path**, so it can be copied out of the
  worktree before the worktree is removed, wherever the coordinator copies it to. A judge writes
  each file under the worktree's gitignored `.scratch/`. Workaround for a browser tool that may
  refuse to write outside the workspace; remove when it no longer does.

## Report

Besides what orca-worker asks: the findings, or none, and the path of each evidence file the
report cites. A perspective's reference says what else its report holds.
