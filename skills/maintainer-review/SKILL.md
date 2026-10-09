---
name: maintainer-review
description: Orca assignment that judges whether a maintainer of the repo would merge the work branch - checks, changed test assertions, files outside the touchpoints, bugs, missing paths, leftovers. Its worker runs the repo's checks and edits nothing, so it never shares a worktree with another Task running code at the same time. Given the shape's constraints and touchpoints and the change reports.
---

Run `mt get maintainer-review` and follow what it prints.
