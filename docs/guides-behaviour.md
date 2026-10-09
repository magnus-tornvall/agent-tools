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
- `mt` was not installed during the Run. Workers ran `cli/mt` from their worktree only because
  each spec said so; no stub was reachable through a skill list. Seen at 5066581.
- The coordinator read the guides straight from the worktree, so the log has no to-orca, overlay
  or door-rule load from its session. In a Run on agent-tools the guides sit in the worktree, and
  nothing steers an agent to `mt get` over opening the file. Seen at 5066581.

## Seen installing `mt`

- The main clone pulled #23 while orca-worker was already linked from it, so the linked skill
  became a stub that runs `mt get` with `mt` not yet on PATH. Seen at 06afad7.

## Seen smoke-testing "Send no heartbeats"

Five read-only workers on 67fa9cc with the line added to the orca-worker guide.

- Before the line, 7 of a Run's 11 workers sent heartbeats, 9 in all. Seen at 5066581.
- With the line in the guide only, 1 of 4 workers sent one: its first command ran `mt get
  orca-worker` and the heartbeat together, before it had read the guide. The other three, running
  1m23s to 4m13s, sent none.
- With the line in the spec's Constraints as well, the one worker, running 4m59s, sent none.
- No worker ran long enough to show whether one that has read the line holds to it past the
  preamble's 5-minute interval.

## Seen coordinating the mvc Run

Guides as installed from the main clone: 67fa9cc until it moved to the heartbeat change mid-Run
(b8ade75); the branch under change was this repo's own.

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
- The main clone took "Send no heartbeats" (312c155) mid-Run, and the workers picked it up through
  `mt get`: T1 to T6 sent heartbeats, the five Tasks started while it was being written (T7 to
  T11) sent none, and one judge named the line. The last Task, started after the
  merge, still sent one while implementing; its spec lacked the Constraints line, because the
  coordinator had loaded to-orca before the change.
- surprise-review, which runs nothing, judged runtime claims (Bun installing a missing package at
  run time, AskUserQuestion returning before the owner's next message) from documentation, and
  said so in its assumptions.
