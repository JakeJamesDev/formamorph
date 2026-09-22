# 13: Probe Style Choices and Openings

Status: ready-for-agent
Blocked by: 12
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

The choices and the world opening follow the Style. Probe the choices override with each Style's choice shape in context, with the tuned narration from ticket 12 as the prior turn. Tune the shapes and the fixed prompt text on the numbers. Check each opening reads right as page one's pre-filled action. Then update the readmes and the Changelog for revision 3: the intro readme explains the three Styles with their reads, and the gameplay readme's examples match the default Style. Run the copy sweep.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [ ] Three arms per tier, at least 2 runs per case, the same cases as ticket 12
- [ ] Per-line metrics under Comments: parse success, count in 3 to 5, quotation marks present, "I" plus verb lead, bare message, asterisk deed, words
- [ ] Chat choices are bare messages and Plain and Literary choices are quoted first-person lines, each with a bootstrap interval that leaves out zero against the other shape, on both tiers
- [ ] The regression check from the guide passes on distinctness and the no-entity guard
- [ ] Under each Style, a new game with no entity opening pre-fills that Style's opening, checked live
- [ ] The intro readme explains the three Styles; the gameplay readme's examples match the Plain default; every named label matches its live copy; the copy sweep reports no findings
- [ ] The Changelog In-Progress entries describe revision 3 and no version changes
- [ ] Four gates green
