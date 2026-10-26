# 04: Scripted Choices Hold

Status: ready-for-agent
Blocked by: 03 — Choices Write And Landing
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a static scan over every After the AI box kind, and one hold kept longer in a landing that already has one, with the commit's choices set and the input unlock moved behind it.

## What to build

A world whose After the AI scripts can change choices holds the choices off screen until the After the AI batch lands, then shows the scripted list once (Q7). Whether a world can comes from a static scan of every After the AI box the turn runs: global, entity and Blueprint stat code, trait scripts and world scripts (Q8). The scan reads the text as the stat write scan does and marks any box that names `turn` by any path, so an alias such as `const t = turn` or `const { choices } = turn` still holds the display; a box that only reads `turn.action` holds it too (Q12). The landing already holds streamed choices until the narration lands: a marked world keeps that hold through the After batch, so the commit's own choices set and the input unlock wait with it. Other worlds release as today: the choices stream row by row once the narration lands, and the input unlocks with them (story 17). The input box unlocks with the shown choices in both. The Scripts guide says when choices appear in a world that scripts them; the changelog fragment folds it into the choices entry.

Spec: Q7, Q8, Q12, stories 16, 17.

## Acceptance criteria

- [ ] The scan marks a world with `turn.choices.push("x")` in a global stat's After the AI code, in an entity stat's, in a Blueprint stat's, in a trait script and in a world script; one with no `turn` in any After the AI box is unmarked
- [ ] The scan marks a box that names `turn` through an alias or a destructure, and one that only reads `turn.action`; a Before the AI box that writes `turn.choices` does not mark the world
- [ ] In a marked world, no choice shows between the choices pass's answer and the After batch landing, and the scripted list shows once; the input box stays locked until then
- [ ] In an unmarked world, the choices show as they stream once the narration lands, and the input box unlocks with them, as before the ticket
- [ ] Reinstating the commit's early choices set turns the marked-world test red
- [ ] The Scripts guide names the hold; the changelog fragment folds it into the choices entry

For you: play a scripting world and an unscripted one on the cloud model and watch the choices arrive after the narration settles.

## Blocked by

- 03 — Choices Write And Landing
