A task is a path, not a layer. Its `scope` cuts narrowly through every layer the change
touches - store, service, interface, and the test that observes it - so its `goal` can be
observed the moment it lands. A task scoped to one layer - "add the column", "add the
endpoint" - has no goal that could be called false on its own, which is why layer-shaped
tasks chain: each one's truth waits on the next. Take the smallest set of requirements that
can be seen working end to end, usually one.

The exception is a change with a single mechanical transformation and no seam that isolates
a subset of its call sites. No path through it lands green, so it is sequenced instead: one
task putting the new form beside the old, one task per batch of call sites moving to it,
each blocked by the first, and one task removing the old form blocked by all of them. That
shape is a `plan.approach` decision and is already made before tasks are drafted.
