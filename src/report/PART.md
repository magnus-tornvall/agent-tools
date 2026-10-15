# report

Domain: Tools. `mt report check` reads a Task report and the work branch and prints, as findings
keyed like a judge's, every claim the report makes about changed files and added tests that the
branch does not bear out. Its code is `src/report/`: `check.ts` reads the claims and compares them
and reads no files, `command.ts` reads the report and asks git about the branch. `cli/mt` loads it
only when it is called.

## Purpose

The coordinator never takes a report's word for what is on the branch: the mismatch between what
a report claims and what the branch holds is in the findings before a judge or the owner acts on
the report.

## Principles

- **Design by contract.** A claim is a line the worker guide asks every report for, so both sides
  can check it; nothing is read out of prose.
- **Falsifiability.** Each finding names the claim, or the touched path, that the branch does not
  bear out.
- **Mechanism, not policy.** It prints findings, never a verdict on the work, and runs none of the
  repo's tests or checks: what to do with a finding is the coordinator's.
- **Leave no trace.** It reads the report and asks git; it writes nothing.

## Contract

`mt report check <file> --task <id> --base <ref>`, run in the worktree that holds the work branch.

- A file of `-` is read from stdin.
- A claim is a line of the report that is `Changed: <path>` or `Added test: <path>::<name>`,
  anywhere in it, alone on its line save for indentation or a `-` or `*` list marker. A path is
  relative to the repo root. A test claim splits at its first `::`. A claim line missing its path,
  or a test claim missing its path or name, is malformed.
- The branch is `HEAD`. The paths it touched are those `git diff <ref>...HEAD` names, a rename as
  both its paths. A claimed test is found when its file at `HEAD` holds its name as text.
- Its findings are, in this order: for each claim in the order the report holds them, a malformed
  claim, a `Changed` path the diff does not touch, `claimed but untouched: <path>`, and an
  `Added test` not found, `named test not found: <path>::<name>`; then each path the diff touches
  that no `Changed` line claims, `touched but unclaimed: <path>`, in git's order. A path claimed
  twice is one claim.
- Each finding is one line on stdout, `<id>/F<m>: <what>`, `<id>` from `--task` and `<m>`
  numbered on after the highest `<id>/F<k>` the report itself keys, so it never collides with the
  report's own findings.
- It exits 0 with nothing printed when there is no finding, and 1 when there is one. A report it
  cannot read, or a base ref git does not know, exits 1 with one line on stderr saying which. No
  file, a second file, a missing `--task` or `--base`, a flag without its value or an unknown
  option prints its usage on stderr and exits 2.
- Side effects: read-only, declared in `src/install/side-effects.ts`. It runs git's `rev-parse`,
  `diff` and `cat-file` and writes nothing.

## Config

It reads no config: not the owner's `mt` config, which it never opens, and no setting of its own.
