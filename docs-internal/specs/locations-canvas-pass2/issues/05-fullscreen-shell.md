# 05 — Fullscreen Shell

**What to build:** A fullscreen button joins the embedded canvas's minimal chrome; clicking it opens the same Locations Canvas in the app's shared fullscreen shell (morph animation, Esc/close handling like the Prompts panel). The embedded view slims to its final form — zoom controls plus the fullscreen button, nothing else — while keeping every interaction (drag, select, connect, reparent, context menu). Fullscreen and embedded are one canvas with different chrome: selection, viewport prefs, and pending edits carry across the transition.

Later tickets add the fullscreen-only toolbar, minimap, and search into this shell.

**Blocked by:** None — can start immediately.

Status: ready-for-agent

- [ ] Fullscreen button in the embedded chrome opens the canvas in the shared fullscreen shell; Esc/close returns
- [ ] Embedded chrome shows only zoom controls + fullscreen button; all interactions still work embedded
- [ ] Selection and world edits survive entering/leaving fullscreen
- [ ] Reduced-motion respected on the morph transition
- [ ] Dev-route coverage so the fullscreen canvas is reachable in one goto
- [ ] Playwright: fullscreen opens and the same nodes render; embedded shows no toolbar/minimap
