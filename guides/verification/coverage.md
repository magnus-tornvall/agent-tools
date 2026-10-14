# verification: coverage

Domain: Verification. Judges whether the work branch does what the shape says, so that a change
reported done is done as the owner settled it. It rests on the test oracle: the shape's
requirements are the expected result, and evidence is held to the strength of what it shows. It
runs the repo's code and edits nothing. It reads no config.

## Given and withheld

- **Given** the shape's `outcome`, `requirements`, `non_goals`, `constraints` and `decisions`, the
  owner's rulings and the change reports.
- **Withheld** the shape's `purpose`, and the change worker's reasoning beyond its report.
  `purpose` is no end state, so nothing on the branch can show it holds.

Fixed: changing it is the owner's call.

## Objectives

- **Every requirement has evidence**: a test that asserts it, or your own observation from running
  it. A requirement reported done without evidence is a finding, and so is evidence weaker than
  the requirement.
- **No oracle is tampered**: each file the oracle commit added is unchanged on the branch. A
  changed one is a finding, and so is an edit no ruling allowed to what an oracle test runs
  through, such as its runner's config or shared setup.
- **Each oracle test checks what the requirement it names says.** One that passes by construction,
  asserts less than its requirement, or mocks what it judges is a finding.
- **No non-goal is built.**
- **The outcome, constraints and decisions are what the branch does.**

## Report

Besides what the verification guide asks: each requirement, whether it holds and its evidence, and,
when the branch has an oracle commit, each file it added that the branch changes.
