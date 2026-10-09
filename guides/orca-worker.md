# orca-worker

How to work an Orca Task. What the work is, and how to check it, is the spec's and its assignment
guide's; how to sequence it is yours. Orca's injected preamble says how questions are asked and
how the report is sent.

## Authority

The spec is authoritative, and so are the replies to your own questions. A contradiction between
them is a question.

The spec's first line is `T<n>: <title>`. That `T<n>` prefixes every question, assumption and
finding ID you write, numbered per Task: `T1/Q1`, `T1/A1`, `T1/F1`. IDs are never reused.

## Decisions

Sort every decision the spec and replies leave open by the door rule (`mt get door-rule`). Decide
a two-way door and record it as an assumption: what you decided and what it rules out, in a line
or two. Ask a one-way door.

A question holds one decision and is answerable without opening anything else. It shows your
stance with its reasoning, what would prove the stance wrong, what agreeing rules out, why it is a
one-way door, and what stays parked until the answer and what is already done. The question
itself reads neutral; the stance carries the opinion. No option lists in the stance.

No work waits on a question unless the question parks it. A reply is the answer: follow it,
whether it decides the question or hands it back to you. Never end the Task to escape a question.

## Report

Every decision you took alone is visible in the report and traceable to the Task. The whole
report is the `worker_done` body, its summary first, however short a body the preamble asks for:
Orca keeps the body on the Task, while a report file stays outside the Run's record. Each
assumption, question and finding sits on its own line. The report gives:

- the outcome, succeeded or failed;
- the evidence the spec and the assignment guide ask for;
- each assumption;
- each question with its answer, or pending;
- proposed follow-ups, or none. You never create Tasks;
- Toolbox: what the Task lacked, whether a skill, tool, permission or instruction, and what would
  have supplied it, or none.
