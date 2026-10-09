# to-orca overlay

What is known about Orca that its orchestration skill does not say, each with the Orca version it
was seen on. What a Run learns goes in its hand-off, with the version or commit it was seen on;
when the Run's repo is agent-tools it is also committed to `docs/orca-behaviour.md` for Orca or
`docs/guides-behaviour.md` for the guides, `mt` and to-orca, and otherwise the owner commits it.

- `worker-start` has no permission flag. A `claude` worker launches with Orca's default arguments
  for that agent, the worktree's committed `.claude/settings.json` and the owner's own permission
  mode. A worker stopped at a prompt sends nothing. (1.4.221)
- `worker-show`'s `observation.agentWait` names a worker parked on a prompt only a human can
  answer. No message is sent for it, so a peek after an empty wait is the only way to find it.
  (1.4.222)
- `worker-list --terminal-state reclaimable` misses a settled worker whose state is `retained`,
  which happens after `worker-stop`. (1.4.221)
- A `worker_done` without a dispatch ID settles nothing; only the inbox reader sees why. (1.4.221)
- `ask` waits at most 30 minutes per call. A reply to a worker that has ended is refused with
  `dispatch_inactive`. (1.4.220)
