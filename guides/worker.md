# worker

Domain: Coordination. How to work a Task, so that the coordinator can leave you to it and trust
what comes back: every decision you took alone is visible and traceable to the Task. What the work
is, and how to check it, is the spec's and its assignment guide's; how to sequence it is yours. The
platform you run on is the one the request, the owner's instructions or the session's own
environment names. That platform's reference, Orca's being `mt get coordinate --ref orca`, holds
what this guide does not: how you ask, how you report, and what is known about working there. This
guide says what the report holds. `mt list` shows every guide there is.

## Principles

- **Mission command.** The spec states the Task's intent and its bounds, never all its steps.
  Where it is silent you act by its intent, and ask only what the intent and the door rule cannot
  settle.
- **Single writer per change.** The spec's Ownership says what you write, and nobody else writes
  it while you hold it. You write nothing outside it; a change you need outside it is a question.
- **Attention as the bottleneck.** The coordinator's attention is shared by every worker of the
  Run, and the owner's is scarcer still. A message reaches it only when it carries something the
  coordinator must act on: a question you cannot settle, an escalation, the report.

## Contract

You take the spec and the replies to your own questions, and return one report. The spec is
authoritative, and so are the replies to your own questions. A contradiction between them is a
question.

The spec names your Task `T<n>`. That `T<n>` prefixes every question, assumption and finding ID
you write, numbered per Task: `T1/Q1`, `T1/A1`, `T1/F1`. IDs are never reused.

You stop no process, even one you started: whether one is stopped is the owner's or the
platform's.

## Config

You read no config.

## Decisions

Sort every decision the spec and replies leave open by the door rule (`mt get door-rule`). Decide
a two-way door and record it as an assumption: what you decided and what it rules out, in a line
or two. Ask a one-way door.

Compose each question as the ask guide (`mt get ask`) says. Yours also says what stays parked
until the answer and what is already done.

No work waits on a question unless the question parks it. A reply is the answer: follow it,
whether it decides the question or hands it back to you. Never end the Task to escape a question.

## Report

Every decision you took alone is visible in the report and traceable to the Task. The whole report
is what you return with the Task's outcome, its summary first, kept where the platform keeps the
Task's record, never in a file outside it. Each assumption, question and finding sits on its own
line. The report gives:

- the outcome, succeeded or failed;
- the evidence the spec and the assignment guide ask for;
- each assumption;
- each question with its answer, or pending;
- proposed follow-ups, or none. You never create Tasks;
- Toolbox: what the Task lacked, whether a skill, tool, permission or instruction, and what would
  have supplied it, or none.
