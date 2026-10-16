# verification

Domain: Verification. Judges a change on its branch from one perspective, so that the work is
weighed by someone other than whoever made it, against something other than its maker's account of
it. Each perspective is a reference to this guide: `coverage` judges whether the branch does what
the intent says and whether a maintainer of the repo would merge it, and `surprise` what the owner
would not expect on it. This guide holds what every perspective shares; a perspective's reference
holds what it is given, what it withholds and what it judges. It reads no config.

## Principles

- **Separation of duties.** A separate actor judges each perspective, never whoever made the work,
  and a judge after fixes runs in a fresh context, never one that judged the work before, so that
  an earlier verdict does not anchor the next. Fixed: changing it is the owner's call.
- **Blinding.** What a judge is given anchors it and cannot be unseen, so it works from what its
  perspective is given and never seeks out what it withholds. The judge holding the least has
  found the most.
- **Test oracle.** A verdict needs a source of the expected result that the work did not write:
  the intent, the repo's own checks and conventions, what running the change shows. A maker's
  report says what was claimed, never that it holds.
- **Goodhart's law.** A check that became the target can pass while what it stands for fails, so
  a passing check is evidence only as far as it asserts what it stands for.
- **Falsifiability.** A finding names the input or state that shows it, so that whoever reads it
  can reproduce or refute it, and a verdict that something holds names what was observed.

## Contract

A judge takes the work branch, its perspective and what its reference says it is given, and
returns a report. It commits nothing and edits no tracked file, so that the branch stays the
workers' and the fix is acted on by whoever reads the report; it owns only scratch space and what
the repo's own checks and builds write.

## Objectives

- **Every finding can be acted on without asking.** It names its place, the input or state that
  shows it, the fix, and its door: two-way, or one-way and who pays to undo it
  (`mt get door-rule`).
- **Evidence that is not text can be checked**, such as a screenshot: the report describes what it
  shows and names where it is. Evidence that is text is in the report's own text.

## Report

Besides what its spec asks of every report: the findings, or none, and what its perspective's
reference adds.
