# to-orca overlay

Domain: Coordination. What is known about Orca, and about `mt` as Orca workers run it, that Orca's
orchestration skill does not say, each with the version or commit it was seen on, so that a
coordinator does not learn it again mid-Run. What a Run learns goes in its hand-off, with the
version or commit it was seen on, and is filed with `mt dogfood`. It reads no config. Workaround
for Orca's orchestration skill not saying these; remove each line when the skill says it or the
tool no longer behaves so.

- `orca orchestration worker-start` has no permission flag. A `claude` worker launches with Orca's
  default arguments for that agent, the worktree's committed `.claude/settings.json` and the
  owner's own permission mode. A worker stopped at a prompt sends nothing. (1.4.221)
- `orca orchestration worker-show`'s `observation.agentWait` names a worker parked on a prompt only
  a human can answer. No message is sent for it, so a peek after an empty wait is the only way to
  find it. (1.4.222)
- `orca orchestration worker-list --terminal-state reclaimable` misses a settled worker whose state
  is `retained`, which happens after `orca orchestration worker-stop`. (1.4.221)
- A `worker_done` without a dispatch ID settles nothing; only the inbox reader sees why. (1.4.221)
- `orca orchestration run-create` moves the terminal off a Run it already coordinates without a
  word, even one with unsettled work. Check `orca orchestration run-current` and that Run's workers
  first. (1.4.222)
- A reply through `orca orchestration ask` to a worker that has ended is refused with
  `dispatch_inactive`. (1.4.220)
- `orca orchestration worker-release` can return `state: retained`, `reason: user_takeover`, and
  leave the agent's terminal live: after the owner answered a prompt in it (1.4.223), and once for
  a Run's first worker started with `--worktree current` (1.4.224).
- Orca's recovery reference forbids closing such a terminal with `orca terminal close`, so it is a
  process that still runs after release. (1.4.223)
- `orca worktree rm` on a worktree that `worker-start --worktree new-child` created also deletes
  its branch, and the removal finishes asynchronously. Teardown in Orca's UI was not observed to do
  the same. (1.4.224)
- `orca orchestration worker-release` leaves a worktree that `worker-start --worktree new-child`
  cut, and its branch, in place, and its receipt does not name them. (1.4.224)
- A spec that names a guide the work branch renames or removes still resolves mid-Run only because
  the installed `mt` serves the main clone's guides; once the change reaches main it fails.
  (`mt` 1b0dd76)
