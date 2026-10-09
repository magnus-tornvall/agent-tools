# shape-coverage

Does the branch do what the shape says? Edit nothing.

## Objectives

- **Every requirement has evidence**: a test that asserts it, or your own observation from running
  it. A requirement reported done without evidence is a finding, and so is evidence weaker than
  the requirement.
- **No non-goal is built.**
- **The outcome, approach, constraints and decisions are what the branch does.**

## Report

Besides what orca-worker asks: each requirement, whether it holds and its evidence, and the
findings, or none. A finding names its place, the input or state that shows it, the fix, and its
door: two-way, or one-way and who pays to undo it (`mt get door-rule`).
