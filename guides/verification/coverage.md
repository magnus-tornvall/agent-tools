# verification: coverage

Domain: Verification. Judges whether the work branch does what the shape says, so that a change
reported done is done as the owner settled it. It rests on the test oracle: the shape's
requirements and oracles are the expected result, and evidence is held to the strength of what it
shows. It runs the repo's code and edits nothing. It reads no config.

## Given and withheld

- **Given** the shape's `outcome`, `requirements`, `non_goals`, `constraints`, `decisions`,
  `oracles` and `unchecked`, the owner's rulings and the change reports.
- **Withheld** the shape's `purpose` and `touchpoints`, and the change worker's reasoning beyond
  its report. `purpose` is no end state, so nothing on the branch can show it holds, and where the
  change lands is judged by the other perspectives.

Fixed: changing it is the owner's call.

## Objectives

- **Every requirement has evidence**: its oracle passing on the branch, the `oracles` block piped to
  `mt oracle run -`, a test that asserts it, or your own observation from running it. A requirement
  reported done without evidence is a finding, and so is evidence weaker than the requirement.
- **Every oracle passes on the branch, and none is tampered.** A failing or tampered oracle is a
  finding, and so is an edit no ruling allowed to what an oracle runs through but does not pin,
  such as its runner's config or shared setup; a blocked one is reported with what it blocks.
- **Each oracle checks what its key says.** One that passes by construction, asserts less than its
  key, or mocks what it judges is a finding.
- **No non-goal is built.**
- **The outcome, constraints and decisions are what the branch does.**

## Report

Besides what the verification guide asks: each requirement, whether it holds and its evidence, and
what `mt oracle run` printed, when the shape has oracles.
