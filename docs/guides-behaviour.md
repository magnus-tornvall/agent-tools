# Known guide behaviour

What running `mt`, to-orca and the guides showed, found by using them in a Run. Each item names
the commit of this repo it was seen on: aa2f305 unless stated. Facts only: the guides and `mt`
themselves say how they are meant to work.

## Seen by a to-orca coordinator dogfooding it

- `mt` logged every guide load of three judges: each loaded orca-worker, its assignment and
  door-rule. The terminal handle in the log tells workers apart, and maps to a Task through
  `worker-list`.
- A worker took a format written to disk, the usage log's keys, as an assumption, not a question.
  The door rule calls that a one-way door but has no notion of "nothing reads it yet".
  surprise-review caught it and the owner ratified the format.
- With only objectives for the report, one report came back as a single paragraph, and two judges
  hid their findings behind `--report-path` to honour the preamble's three-sentence body.
- surprise-review's "run nothing" clashes with loading its guide through `cli/mt` when the repo
  under review is `mt`'s own; the spec had to allow `cli/mt get`.
- The judge holding least found the most. surprise-review, given the outcome, non-goals,
  touchpoints, decisions and the change reports' assumptions, raised eight findings, two of them
  one-way doors, against none from maintainer-review and two from shape-coverage.
- The coordinator sliced the shape per judge by hand with a throwaway script, and pulled
  assumptions out of reports by matching their lines. Both are candidate tools.
- The coordinator's own spec boilerplate kept saying "the preamble governs how you send your
  report" after the orca-worker guide changed; specs that restate a guide go stale with it. Seen
  at 4348866.
- The second round of judges found three two-way findings, two introduced by the first fix round;
  no one-way door was decided without a question. Seen at 4348866.

## Seen coordinating the mvc Run

Guides as installed from the main clone at 67fa9cc; the branch under change was this repo's own.

- to-orca's stub has `disable-model-invocation`, so an agent asked to "use orca to drive this
  shape" has its skill call refused; the owner has to type `/to-orca <shape>`.
- A change worker testing `mt` inside agent-tools wrote 12 lines into the owner's real usage log:
  it exported `MT_LOG` once, and shell state does not persist between commands. Two workers'
  Toolbox lines asked for an `MT_LOG` note in the change guide. Later specs carried one and no
  stray lines followed.
- The coordinator sliced the shape per judge by hand again: the Run's shape was written before the
  schema it builds, and `mt shape slice` then refused a shape failing the check. The Run's own
  fix round made slice need only a YAML map.
- surprise-review found the most again, six then four two-way findings, none a one-way door
  decided without a question; maintainer-review found two, three, then one on the last fixes;
  shape-coverage two, then none.
- A fix round introduced a bug, zero-indented list items read as repeated keys, that only the
  next maintainer-review caught.
- A finding whose fix needed dependencies the shape's constraints forbade (type-checking) went to
  the owner, as the door rule says a contradiction with the spec does.
- A surprise-review judge reported that orca-worker tells it to send no heartbeats; the guide says
  nothing about heartbeats.
- surprise-review, which runs nothing, judged runtime claims (Bun installing a missing package at
  run time, AskUserQuestion returning before the owner's next message) from documentation, and
  said so in its assumptions.
