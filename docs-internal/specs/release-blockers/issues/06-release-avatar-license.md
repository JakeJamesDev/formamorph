# 06 — Release builds still ship the Elaina Avatar

Type: task
Status: ready-for-human
Blocks: release

## Problem

Release builds swap in a bundled Avatar whose metadata turns off sexual, violent, political or religious, and antisocial or hate use. No new build on any channel ships it.

Origin: [Release Avatar License](../../release-avatar-license/spec.md), Q15.

## Clears when

- A new model at `build-assets/alternate-avatar.vrm` passes the stricter Permissive License gate.
- The bundled-avatar test is green with that gate.
