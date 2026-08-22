A task is a path, not a layer. Its `scope` cuts narrowly through every layer the change
touches - store, service, interface, and the test that observes it - so its `goal` can be
observed the moment it lands. A task scoped to one layer - "add the column", "add the
endpoint" - has no goal that could be called false on its own, which is why layer-shaped
tasks chain: each one's truth waits on the next. Take the smallest set of requirements that
can be seen working end to end, usually one.
