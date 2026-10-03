# 01: Default rig and mascot module

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The mascot's foundation, with nothing on screen yet.

- **The default rig's images.** Cut every layer of the author's layered file at the repo root into bundled WebP assets: the armless base, each eye, mouth, eyebrow and arm layer, at the file's canvas size. The cut runs through a GIMP 3.x script wrapped in a timeout; every procedure call is verified against the installed version first, because 2.10 forms hang the console.
- **The mascot module.** One pure module, no React, no DOM: the rig type (base, ordered layers with id, name, kind, enabled switch and ordered image list; three picks; Mask; Persona; a transition placeholder), the codec with field-by-field fallback, the composition function (rig, phase, AI expression to an ordered image list), and the warning rule (picks that name a disabled or missing layer).
- **The default rig** as data: layers named after the file's layers, Initial = Wave + No Thinking, Idle = No Thinking + No Wave, Thinking = Looking Up + :O + Thinking + No Wave, a persona text, the Mask over the head.

Spec: Rulings Q2, Q7, Q11, Q19, Q21; Implementation → Mascot module.

Recommended model rationale: the GIMP script is the risk: a wrong call hangs silently, and the composition function is the one place that decides what draws.

## Acceptance criteria

- [ ] Every layer of the layered file exists as a bundled WebP, and a script in the repo reproduces the cut.
- [ ] The composition function draws the right overlays in list order for each phase; a disabled layer draws nothing; the AI's expression replaces the Idle expression and keeps the Idle state; an empty pick draws the base alone.
- [ ] The codec drops a bad layer and keeps the others, clears a bad pick, reads a missing Mask as the whole base, and reads a missing value as the default rig.
- [ ] The warning rule names each pick that points at a disabled or missing layer.
- [ ] Each guard is proven by reinstating the bug once.
- [ ] The four gates are green.
