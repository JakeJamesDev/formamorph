# 06: Script Body Writes

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Scripts read and write an owner's Body by name. The owner surface gains `body`. Reading it gives the Body in force's name, with each slot's capacity and the Item Copies in it. Assigning a Body name sets the owner's base Body, which the save stores. An active trait's Body still wins over the base (Q14). An unknown name fails the write. The resolver gains the base Body between trait overrides and the authored pick, and a base change goes through the settle from 05.

A Test Bench rule reports a script that names a Body that doesn't exist. The Variable menu and hover cards list `body`.

Spec: Implementation Decisions under Body in force and Scripts; Q14, Q20, Q25 (soft reference half).

## Acceptance criteria

- [ ] `body` reads the Body in force with its slots, capacities and contents
- [ ] Writing a Body name sets the base Body. An active trait's Body still wins, and the base returns when the trait ends
- [ ] The base Body is saved and survives a load
- [ ] A write of an unknown name fails the script with an error
- [ ] The Test Bench rule fires on an unknown Body name and stays quiet on a real one
- [ ] The Variable menu and hover cards list `body`. The Scripts Guide documents it
- [ ] ⚠️ The response that lands this ticket reminds the user of the save shape change
