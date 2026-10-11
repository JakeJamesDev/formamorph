# 01: Player Name in Chip Headers

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a renderer change under every prompt, with a format matrix to prove, plus a probe whose numbers become the control for the two tickets after it.

Parent: [Player Character Block spec](../spec.md)

## What to build

A chip's header text may carry the Player Name built-in. When the narrator plays Sylvie, the block heads `## Sylvie Thornwhistle (Player Character)`. The six default prompts that carry a Persona chip (narration, choices, director, character pass, storyboard, opening) head it `{{user}} (Player Character)`. Rulings Q1, Q2, Q6.

The value travels in the chip values map under the built-in's token, as world prompt placeholder chips already do. The renderer substitutes it in the header before title-casing, escaping and framing, so it lands in the Markdown heading, the Simple uppercase line and the XML tag alike. A blank name substitutes nothing and the rest of the header renders as written. A map without the key leaves the token in place. A persona-less scene keeps today's behavior: the chip's value is the none placeholder, so the heading and body both vanish.

Request Anatomy shows the resolved heading in the static frame. Custom prompt bodies still do not take `{{user}}`; only headers do.

## Acceptance criteria

- [ ] Through the template renderer: a `{{user}}` header renders the name in Markdown, Simple and XML; a blank name renders the header text as written; a missing value leaves the token; a blank chip value drops the headed section entirely.
- [ ] Through the chip values map: a live scene and an authored scene both carry the Player Name value, the authored scene's from the Custom Persona entity under the None rule.
- [ ] The six default prompts head the Persona chip `{{user}} (Player Character)`, asserted as the existing persona prompt tests assert headers.
- [ ] Request Anatomy renders the resolved heading; the chip editor's header field accepts the token without marking it an error.
- [ ] A short narration probe on the default endpoint, today's shipped prompt as the in-batch control, at least 6 runs per arm, scoring the name-leak and stat-tabulation checks the narration probe already carries. The report states the numbers; this ticket's arm is the control for tickets 02 and 03.
- [ ] Changelog fragment written.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
