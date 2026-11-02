# 06 — Release builds still ship the Elaina Avatar

Type: task
Status: done
Blocks: release

## Problem

Release builds swap in a bundled Avatar whose metadata turns off sexual, violent, political or religious, and antisocial or hate use. No new build on any channel ships it.

Origin: [Release Avatar License](../../release-avatar-license/spec.md), Q15 and Q18.

## Clears when

- A new model at `build-assets/alternate-avatar.vrm` passes the stricter Permissive License gate.
- The bundled-avatar test is green with that gate.
- Any Steam build holds no `.vrm` file.

## Answer

Resolved 2026-11-02 by [Release Avatar License](../../release-avatar-license/spec.md). All three models pass the stricter gate, the bundled-avatar test is green, and a build with `FORMAMORPH_AVATARS=none` holds no `.vrm`.
