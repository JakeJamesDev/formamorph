# 09: Bundled Worlds Nearby Through Connections

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A bundled-world edit. Follow the bundled-worlds skill.

## What to build

Bundled worlds where travel happens over Connections gain nearby entities: every location that at least one Connection leg leaves gets `nearbyUsesConnections: true`.

## Acceptance criteria

- [ ] Each bundled world's locations with an outgoing Connection leg get the field, through a parse-and-reserialize script that keeps the files' formatting.
- [ ] `npm run fingerprints` regenerates the fingerprint file, committed with the worlds.
- [ ] Probe numbers on at least Emberwatch, before and after, under the probe skill.
- [ ] Export-shape reminder in the landing reply.
