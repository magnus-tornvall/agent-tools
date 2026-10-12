# shape-coverage

Domain: Verification. Does the branch do what the shape says? Edit nothing.

## Objectives

- **Every requirement has evidence**: its oracle passing on the branch, the `oracles` block piped to
  `mt oracle run -`, a test that asserts it, or your own observation from running it. A requirement
  reported done without evidence is a finding, and so is evidence weaker than the requirement.
  Evidence files, such as screenshots, go in the worktree's gitignored `.scratch/`, since a browser
  tool may refuse to write outside the workspace.
- **Every oracle passes on the branch, and none is tampered.** A failing or tampered oracle is a
  finding, and so is an edit no ruling allowed to what an oracle runs through but does not pin,
  such as its runner's config or shared setup; a blocked one is reported with what it blocks.
- **Each oracle checks what its key says.** One that passes by construction, asserts less than its
  key, or mocks what it judges is a finding.
- **No non-goal is built.**
- **The outcome, constraints and decisions are what the branch does.**

## Report

Besides what orca-worker asks: each requirement, whether it holds and its evidence; what
`mt oracle run` printed, when the shape has oracles; and the findings, or none. A finding names its
place, the input or state that shows it, the fix, and its door: two-way, or one-way and who pays to
undo it (`mt get door-rule`).
