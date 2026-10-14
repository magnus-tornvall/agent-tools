# debugging

Domain: Change. Find why something fails, with evidence, so that a fix changes the cause and not a
symptom. It is for a failure nobody expected: a test that should pass fails, a build or command
breaks, code does what it was not written to do. A test written to fail before it passes is not
one; it is doing its job. It takes the failure, and the request that reports it or asks why; it
returns the root cause with its evidence and, unless only a diagnosis was asked for, one fix proven
against the failure, with a report. It reads no config.

## Principles

- **Root cause by the scientific method.** A cause is a hypothesis until an experiment rules it in:
  stated, tested by the smallest probe that could refute it, and kept or dropped on the result.
- **Falsifiability.** A hypothesis says what result would rule it out; one no probe could refute
  explains nothing.
- **Minimal change.** The fix is made where the wrong value or state first appears, not where it is
  noticed, and nothing rides along with it.
- **Evidence hierarchy**, from the Evidence domain. What was run and what it showed outranks what
  the code is remembered or expected to do, so a claim about the cause rests on the run.

## Objectives

- **What is explained is a reproduced failure**: one triggered on demand by the exact command or
  input, with whether it fails every time, and its whole error read: the message, the stack trace,
  each file and line, the exit code. A failure that will not reproduce is not guessed at: the
  evidence is what differs between the runs that fail and those that pass.
- **Every fix is at a root cause that has evidence.** A bad value is traced back through whatever
  passed it to where it originates, and fixed there. A guard, a retry, a longer timeout or a
  skipped test at the point of failure leaves the cause to fail somewhere else.
- **Every claim about the cause rests on evidence.** What changed, in the history, the diff,
  dependencies, config and environment; working code nearby that does the same thing, and every
  way it differs; and, when the failure crosses components, what enters and leaves each boundary
  and which config and environment reach it.
- **One hypothesis at a time.** Each is stated as "X causes this, because Y", tested with a probe
  that changes one thing, and recorded with its result. A probe that changes several things at
  once rules nothing out. A hypothesis the evidence rules out is undone, not built on.
- **The fix is one change at the root cause, proven by reproducing the failure.** When the cause is
  in the repo's source code, a regression test reproduces it, and is seen failing before the fix
  and passing after it. When it is anywhere else (config in the repo, such as CI YAML or a
  Dockerfile; the environment; an external service), the command that reproduces the failure is
  seen failing before the fix and passing after it, and no automated test is added. The rest of
  the repo's checks still pass.
- **When failed fixes stop narrowing the cause, the next one is asked, not tried.** The question
  goes to whoever owns the decision, naming what each attempt ruled out. Fixes that each surface a
  new problem somewhere else point at the design, not at one more patch. A fix that changes
  architecture is asked however few came before it.
- **A diagnosis changes nothing.** When the request asks only why, the work ends at the root cause
  and its evidence; no fix is made. Otherwise the work carries through the fix.
- **Diagnostics leave with the investigation.** Logging, prints, probes and scratch scripts added
  to find the cause are gone before the work is reported done.

## Guardrails

- **Nothing changes in response to the failure without a root cause that has evidence**, except
  probes, each made to answer one hypothesis and undone once answered where it can be. A probe that
  cannot be undone, such as a cleared cache or a restarted service, is named in the report.
- **A failing test is not edited to pass.** When the test itself is wrong, that is a finding of its
  own, and changing what an existing test asserts is a one-way door.
- **A cause outside the source code is still a cause**: a config, an environment, a service. It is
  named with its evidence, like any other; "flaky" is a symptom, not a cause.
- **What is not understood is said plainly.** When the evidence runs out, report what is known,
  what was ruled out and what is not understood, rather than fix on a guess.

## Tools

- **The door rule** (`mt get door-rule`) says when a fix is a one-way door: one that changes
  architecture, a test contract or anything else it lists is asked before it is made.
- **The ask guide** (`mt get ask`) composes the question when failed fixes stop narrowing the
  cause, and for a fix the door rule says to ask.
- **History**: `git log`, `git diff` and `git bisect` find the change that brought the failure in.

## Report

Besides what the request asks:

- how the failure was reproduced: the command or input, and whether it failed every time;
- each hypothesis, with the evidence that ruled it in or out;
- the root cause with its evidence, or what is known, ruled out and not understood;
- the regression test, or when the cause is not in the repo's source code the reproducing
  command, seen failing before the fix and passing after it; or, for a diagnosis, that nothing
  changed;
- each fix that failed, and what it ruled out;
- each probe that could not be undone.
