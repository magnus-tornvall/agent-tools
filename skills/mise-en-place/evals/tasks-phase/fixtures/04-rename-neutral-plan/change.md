---
approvals:
  spec: true
  plan: true
  tasks: false

spec:
  outcome: "One name is used for the organisation identifier everywhere it appears."
  kill_criterion: "If the two names must coexist permanently for an external contract, stop and re-scope to an adapter."
  non_goals:
    - "Not changing the identifier's type or format."
    - "Not renaming the database column."
  requirements:
    - id: R1
      text: "No source file refers to the organisation identifier by its old name."
    - id: R2
      text: "Every step of the change leaves the test suite passing."
  open_questions: []

plan:
  approach: "Rename the identifier wherever it appears so that only the new name remains."
  touchpoints:
    - packages/core/src/identity.ts
    - packages/api/src/billing.ts
    - packages/web/src/Billing.tsx
    - packages/jobs/src/digest.ts
  constraints:
    - "The identifier's type and format do not change."
    - "The database column keeps its current name."
  acceptance: "bun test"
  escalate_if:
    - "A call site cannot move without also changing behaviour."
  open_questions: []

tasks:
  open_questions: []
---

The identifier is exported from one symbol in core and read at roughly four hundred call
sites across three dependent packages.
