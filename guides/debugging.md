# debugging

Find why something fails, with evidence, before changing anything to make it pass. It is for a
failure nobody expected: a test that should pass fails, a build or command breaks, code does what
it was not written to do. A test written to fail before it passes is not one; it is doing its job.

## Objectives

- **The failure is reproduced before it is explained.** Read the whole error first: the message,
  the stack trace, each file and line, the exit code. Then trigger it on demand, with the exact
  command or input, and note whether it fails every time. A failure that will not reproduce is not
  guessed at: gather evidence on what differs between the runs that fail and those that pass.
- **The root cause is found before any fix.** The cause is where the wrong value or state first
  appears, not where it is noticed. Trace a bad value back through whatever passed it to where it
  originates, and fix it there. A guard, a retry, a longer timeout or a skipped test at the point
  of failure leaves the cause to fail somewhere else.
- **Every claim about the cause rests on evidence**: what was run and what it showed. Look at what
  changed, in the history, the diff, dependencies, config and environment; at working code nearby
  that does the same thing, and every way it differs; and, when the failure crosses components, at
  what enters and leaves each boundary and which config and environment reach it.
- **One hypothesis at a time.** Each is stated as "X causes this, because Y", tested with the
  smallest change or probe that can rule it in or out, and recorded with its result. A probe that
  changes several things at once rules nothing out. A hypothesis the evidence rules out is undone,
  not built on.
- **The fix is one change at the root cause, proven by reproducing the failure.** When the cause is
  in the repo's source code, a regression test reproduces it, and is seen failing before the fix
  and passing after it. When it is anywhere else (config in the repo, such as a Makefile or CI
  YAML; the environment; an external service), the command that reproduces the failure is seen
  failing before the fix and passing after it, and no automated test is added. The rest of the
  repo's checks still pass, and nothing rides along with the fix.
- **After three fixes that each failed, a fourth is asked, not tried.** The question goes to
  whoever owns the decision, naming what each attempt ruled out. Fixes that each surface a new
  problem somewhere else point at the design, not at one more patch. A fix that changes
  architecture is asked whatever the count.
- **A diagnosis changes no code.** When the request asks only why, the work ends at the root cause
  and its evidence; no fix is made. Otherwise the work carries through the fix.
- **Diagnostics leave with the investigation.** Logging, prints, probes and scratch scripts added
  to find the cause are gone before the work is reported done.

## Guardrails

- **No code changes in response to the failure before the root cause has evidence**, except
  probes, each made to answer one hypothesis and undone after it.
- **A failing test is not edited to pass.** When the test itself is wrong, that is a finding of its
  own, and changing what an existing test asserts is a one-way door.
- **A cause outside the source code is still a cause**: a config, an environment, a timing, a
  service. It is named with its evidence, like any other; "flaky" is a symptom, not a cause.
- **What is not understood is said plainly.** When the evidence runs out, report what is known,
  what was ruled out and what is not understood, rather than fix on a guess.

## Tools

- **The door rule** (`mt get door-rule`) says when a fix is a one-way door: one that changes
  architecture, a test contract or anything else it lists is asked before it is made.
- **The ask guide** (`mt get ask`) composes the question after three failed fixes, and for a fix
  the door rule says to ask.
- **History**: `git log`, `git diff` and `git bisect` find the change that brought the failure in.

## Report

Besides what the request asks:

- how the failure was reproduced: the command or input, and whether it failed every time;
- each hypothesis, with the evidence that ruled it in or out;
- the root cause with its evidence, or what is known, ruled out and not understood;
- the regression test, or when the cause is not in the repo's source code the reproducing
  command, seen failing before the fix and passing after it; or, for a diagnosis, that no code
  changed;
- each fix that failed, and what it ruled out.
