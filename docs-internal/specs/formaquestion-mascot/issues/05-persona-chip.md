# 05: Persona chip

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The answers sound like the character while the mascot is on, and the prompt is exactly today's while it is off.

- A new help chip stands for the persona. With the mascot on it sends the rig's Persona text; with it off, or the Persona empty, it sends nothing and leaves no blank line, as Markdown Guidance does.
- The Default help preset's answer prompt gains the chip. A custom preset without the chip sends no persona.
- The question carries the Persona with the switch; the session reads no context.
- The probe harness gains the mascot switch and the Persona as inputs. The help bar run goes out twice on cloud, on and off, with its in-batch control. The on run must hold the bar.

Spec: Q22, Q25, Q26; Implementation → Help session.

Recommended model rationale: a prompt change with a bar run; the byte-equal guard decides whether default on is safe.

## Acceptance criteria

- [ ] With the mascot off, the answer request body is byte-equal to today's.
- [ ] With it on, the body holds the Persona text at the chip's place; an empty Persona adds nothing.
- [ ] A custom preset without the chip sends no persona.
- [ ] Bar run numbers, on and off, are in the ticket and the on run holds the bar.
- [ ] The four gates are green.
