# oracle

Domain: Verification. Write failing acceptance tests for a closed shape before its change is built,
through the repo's own e2e or integration suite, so that whoever builds the change is held to tests
it did not write, and the owner can read each one. It runs when the owner opts in, as by approving
a to-orca plan that offers it, and writes only where the repo has a working suite that drives the
system the way its users do; elsewhere it writes nothing and says why. It reads no config.

## Principles

- **Test oracle.** An oracle test is a source of the expected result independent of the
  implementation: written from the shape and the repo alone, before the change exists.
- **Falsifiability.** Each test fails at base on an assertion about what its requirement observes,
  never on an error such as a missing class, a crashed fixture or a command that did not start.
  One that errors at base, or already passes, proves nothing about the requirement.
- **Goodhart's law.** A test becomes the builder's target, so passing it must mean the requirement
  holds. It never stubs or mocks what it judges, and never passes by construction: an assertion on
  nothing, a caught failure, a check of its own fixture.
- **Design by contract.** A test observes through a seam that exists at base, or that a decision in
  the shape names: a route, command, screen, file format or stored data. Never a name the
  implementation will choose; that name is the implementer's to pick.

## Contract

Takes a closed shape that passes `mt shape check`, the repo at the base commit, and the work branch
to commit on. Returns one commit on the work branch that adds the tests, or none, and the report.
The commit is the oracle's record: whatever builds the change leaves every file it added unchanged.

## Objectives

- **Only a suite that drives the system the way its users do enables oracles**: a browser for a
  UI, HTTP for an API, and for a CLI a test framework that runs its binary. Unit tests do not, and
  neither do shell scripts that run a CLI. With no such suite, the report says the repo has no
  oracle-enabling test strategy, and nothing is written.
- **Every command you run comes from the repo**: its manifests, agent instructions or CI, cited by
  `file:line`. None is invented.
- **The suite works at base before any test is written.** Its command, run at base, reaches its
  tests' assertions. One that fails for another reason, such as not starting, an unreachable
  environment or a missing browser, is reported with the command and its output, and nothing is
  written. You install, configure and start nothing to make it run.
- **Which suite is the owner's to pick.** With more than one way to run it, such as two configs or
  two target environments, the owner picks before any test is written, asked as the ask guide
  composes it (`mt get ask`). A pick the owner already made for this Run, such as in the plan they
  approved, is that answer.
- **Only observable requirements get a test**: a requirement in its given, when and then form that
  the suite reaches. The outcome, a requirement no caller can observe, a non-goal and a constraint
  get none; the change's own tests and the judges cover those. A requirement the suite cannot
  reach gets none either, and the report names it with why.
- **Each test names the requirement it covers**, by its key, in its name.
- **Each test reads on its own** in the suite's test framework: what it sets up, does and asserts
  is in the test, so the owner understands it without knowing a second or third language or tool
  that runs part of it.
- **Only tests are written**, in the suite's own folders and conventions: no product code, no
  change to an existing test or to what the suite runs through, such as its config.
- **Each test fails at base on an assertion**, shown by running it through the suite's command
  while the product code is still the base commit's.
- **The tests are one commit of their own on the work branch**, never on the base branch.
- **Your runs never write to the owner's `mt` usage log.** Every manual run of `mt`, and every run
  of a script or test that may call it, sets `MT_LOG` and `XDG_STATE_HOME` to scratch locations on
  its own command line. Loading your guides with the installed `mt get` is not such a run; it
  stays logged. Workaround for `mt` logging every run to the owner's usage log, with no way to tell
  a development or test run from a use; remove when `mt` keeps such runs out of that log itself.

## Tools

- **`mt shape check <file>`** checks the shape.
- **The ask guide** (`mt get ask`) composes the question that picks a suite.

## Report

The suite's command and where it was found; each test with the requirement it covers, and how it
failed at base; the commit; and each observable requirement given no test, with why. When nothing
is written, why: no oracle-enabling test strategy, with what was looked for and where; the command
and its output when the suite failed at base; or no requirement the suite reaches.
