# 07: Low-VRAM Lead

Status: ready-for-agent
Blocked by: 01, 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one card in an existing gate, keyed on a rule ticket 01 owns.

**What to build:** on desktop with 8 GB of VRAM or less, AI setup leads with a Formamorph AI card. Its **See Levels** opens the same scene, and the local model download stays below it. With more VRAM, or when VRAM is unknown, AI setup keeps today's layout.

- [ ] The lead shows at a reported total of 8,500 MB or less, through the rules module and not through `tierForVram`, which groups cards up to 14 GB together.
- [ ] Unknown VRAM keeps today's layout, and so does a build without hosted AI.
- [ ] The local download still works from below the card, and its recommendation is unchanged.
- [ ] Rendered tests cover each side of the limit.
- [ ] The gate's dev route shows the lead. Frame at `.scratch/frames/ai-setup-lead-1280.png`, in both themes.
- [ ] `docs/` pages that describe AI setup are current, and a changelog fragment states what changed for the player.

For you: the lead card's wording, in AI setup on the dev route.
