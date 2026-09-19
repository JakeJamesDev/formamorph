# 08: Openings In The Test Bench

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Openings](../spec.md)

**What to build:** A world author checks openings in the Test Bench. The opening lens shows which openings are in the pool for a chosen starting location, with each row's chance. For an Opening Action it shows the turn-one prompt, as it does today. For an Opening Narration it shows the text as page one and states that no narration request goes out.

**Rationale for the model:** the lens is a pure seam with prior art for every case. Sonnet at medium effort.

## Acceptance criteria

- [ ] The lens lists the pool for the chosen starting location, from the Openings module. It computes nothing itself.
- [ ] The author can choose which opening the lens shows. The default is the first drawable row.
- [ ] An Opening Action shows the assembled turn-one prompt, as today.
- [ ] An Opening Narration shows the resolved text as page one, with no narration prompt.
- [ ] A switched-off list and an empty pool show the default Opening Action.
- [ ] The bench shows computation only and makes no judgment of the text, per ADR-0005.
- [ ] Lens tests cover the pool by starting location, both kinds, and the default. One guard is proven by reinstating its fault.
- [ ] The lens is checked in the preview, with static DOM evidence.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

No data change. Picked library entities are a player choice at Enter World and are not part of the bench's pool.
