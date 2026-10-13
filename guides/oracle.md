# oracle

Domain: Verification. Turn a closed shape into oracles: acceptance checks, written before the change
exists, that any implementation is then held to. They are the outer loop of the change: whoever
builds it is done when its oracles pass, so the owner's intent is checked by something its builder
did not write. It reads no config.

## Principles

- **Test oracle.** An oracle is a source of the expected result independent of the implementation.
  It is written from the shape and the repo alone, never from an implementation, so a requirement
  you cannot check is a finding about the shape.
- **Falsifiability.** An oracle can fail, and where its key's behaviour is new it fails at base for
  the reason its key names: on an assertion about what the key observes, never on an error such as
  a missing class, a crashed fixture or a command that did not start. One that errors at base, or
  already passes where its `base` says fail, proves nothing about the key, and is wrong, never the
  shape.
- **Goodhart's law.** An oracle becomes the builder's target, so passing it must mean the key
  holds. It never stubs or mocks what it judges, and never passes by construction: an assertion on
  nothing, a caught failure, a check of its own fixture.
- **Design by contract.** An oracle observes through a seam that exists at base, or that a decision
  settles: a public route, command, file format, stored data or screen the code has now, or one a
  decision in the shape names. Never a name the implementation will choose; that name is the
  implementer's to pick.
- **Separation of duties.** An oracle is pinned, so whoever it judges can make it pass, never make
  it easier.

## Contract

Takes a closed shape that passes `mt shape check`, and the repo with its product code at the base
commit; when given them, a branch to commit the oracle files on and the path to write the shape
to. Returns the shape with its oracles: one YAML document that passes `mt shape check` but for the
keys it sends back as shape defects, and the oracle files. Writes only the oracle files and the
shape's `oracles` and `unchecked` blocks: no product code, no other test, no other key of the
shape. It never patches a requirement, decides an interface or adds scope.

## Objectives

- **Every key is covered or unchecked.** The outcome, each requirement, each boundary non-goal and
  each constraint is covered by an oracle, or listed under `unchecked` with why none can be
  written: no caller can observe it, it needs judgement, or no seam reaches it. A deferral needs
  neither. `mt shape check` enforces this.
- **Each oracle stands alone.** It sets up its own state, and no oracle's result depends on another
  passing. One key per oracle where it can be, so a failure names what failed; the outcome gets
  its own end-to-end oracle.
- **A boundary is checked by its absence**: its oracle passes while the boundary holds, such as a
  request that is still refused or a format that is still unchanged.
- **Each oracle does at base what its `base` says**, shown by `mt oracle run --base` while the
  product code is still the base commit's. New behaviour fails; preserved behaviour, constraints
  and boundaries pass.
- **Oracles are the repo's own tests**: its test runner, conventions and test folders, so they ship
  with the change and run in its checks. Each writes a JUnit report when the runner can, named in
  `junit`, so a failure is told apart from an error. A script follows automake's exit codes, as
  `mt oracle run` reads them: 0 passes, 77 is blocked, 99 is broken, as are 126 and 127 (the
  command did not start) and 128 and up (a signal ended it); anything else fails.
- **Blocked is not failed.** A check that needs what the change does not own, such as an external
  service or a credential, skips or exits 77 when it is missing, and the report names what it
  blocks.
- **Every file only oracles use is pinned**: each oracle's tests, helpers and fixtures. `files` maps
  each one to the sha256 `mt oracle hash` prints for it as it is committed, after the repo's
  formatter and commit hooks have run on it. On a branch given to you, the oracle files are
  committed in a commit of their own, never on the base branch.
- **A key you cannot check independently goes back to the owner** as a shape defect, asked as a
  question: the key, why no independent check exists, and what would make one possible, such as a
  decision that settles the route. It stays out of `oracles` and `unchecked` until the owner rules,
  so the shape fails `mt shape check` on that key until then.
- **Your runs never write to the owner's `mt` usage log.** Every manual run of `mt`, and every run
  of a script or test that may call it, sets `MT_LOG` and `XDG_STATE_HOME` to scratch locations on
  its own command line. Loading your guides with the installed `mt get` is not such a run; it
  stays logged. Workaround for `mt` logging every run to the owner's usage log, with no way to tell
  a development or test run from a use; remove when `mt` keeps such runs out of that log itself.

## Tools

- **`mt shape check <file>`** checks the shape with its oracles.
- **`mt oracle hash <file>...`** prints each file's path and sha256 in the form `files` takes.
- **`mt oracle run --base <file>`**, run with the product code at base, checks
  each oracle against its `base`; **`mt oracle run <file>`** checks that each passes. Each prints
  one line per oracle and exits 1 when any misses.
- **The example** (`mt get oracle --ref example`) is a shape with its oracles.
- **The ask guide** (`mt get ask`) composes a shape defect as a question for the owner.

## Report

The shape with its oracles and where it was written; what `mt oracle run --base` printed; the
commit of the oracle files, if any; each unchecked key with its reason; and each shape defect, or
none.
