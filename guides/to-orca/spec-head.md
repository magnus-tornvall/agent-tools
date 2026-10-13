# to-orca spec head

Domain: Coordination. What every Task spec carries, since a worker acts on it before it has read its
guides. It reads no config. Fill in `<n>`, `<title>`, `<assignment>` and, for a judge,
`<perspective>`.

The spec opens with:

```
T<n>: <title>
Run `mt get orca-worker` and `mt get <assignment>` before anything else.
```

A judge's spec, whose `<assignment>` is `verification`, follows that with a line that loads its
own perspective's reference and no other, `<perspective>` being `coverage`, `maintainer` or
`surprise`:

```
Run `mt get verification --ref <perspective>` too.
```

Its Constraints include:

```
- Send no heartbeats, whatever the preamble asks.
```

A worker can send a heartbeat before it has read the orca-worker guide, and each one wakes the
coordinator for nothing. Workaround for Orca's preamble asking every worker for heartbeats; remove
when it no longer asks, or a heartbeat no longer wakes the coordinator.
