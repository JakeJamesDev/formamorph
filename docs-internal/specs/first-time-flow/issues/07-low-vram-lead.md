# 07: Low-VRAM Lead

Status: done
Blocked by: 01, 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one card in an existing gate, keyed on a rule ticket 01 owns.

**What to build:** on desktop with 8 GB of VRAM or less, AI setup leads with a Formamorph AI card. Its **See Levels** opens the same scene, and the local model download stays below it. With more VRAM, or when VRAM is unknown, AI setup keeps today's layout.

- [x] The lead shows at a reported total of 8,500 MB or less, through the rules module and not through `tierForVram`, which groups cards up to 14 GB together. (`aiSetupLeadsWithHostedAi`; table tests 8500/8501/6144/14000)
- [x] Unknown VRAM keeps today's layout, and so does a build without hosted AI. (rules table and gate tests)
- [x] The local download still works from below the card, and its recommendation is unchanged. (gate test "opens the scene from See Levels and keeps the recommendation unchanged")
- [x] Rendered tests cover each side of the limit. (8,500 vs 8,501 MB in `AiSetupGate.test.tsx`)
- [x] The gate's dev route shows the lead. Frame at `.scratch/frames/ai-setup-lead-1280.png`, in both themes. (`#dev?modal=aiSetup&vram=6144`; frames `ai-setup-lead-1280-dark.png` and `ai-setup-lead-1280-light.png`)
- [x] `docs/` pages that describe AI setup are current, and a changelog fragment states what changed for the player. (`Connect-Your-Own-AI.md` table row; fragment `first-time-flow-07-low-vram-lead.md`)

For you: the lead card's wording, in AI setup on the dev route.

## Landed

Spec Q52 settled the intent: the card hides for a pledged player, shows only in the bundled-engine choose step in both reasons and both views, and has one action, See Levels.

**Not verified**
- Real desktop GPU read: the dev route fakes the read with `vram=<MB>`. A real 8 GB card was not tried.
- The two frames are JPEG data saved under `.png` names, from the browser pane.

**For you**
- The lead card wording ("Play With a Stronger AI" and its body line): `#dev?modal=aiSetup&vram=6144`, frames `.scratch/first-time-flow-07/frames/ai-setup-lead-1280-dark.png` and `-light.png`.
- Under the card the dialog description still reads "Formamorph runs its AI on your own machine. Download a model to start playing." It reads a little oddly beside an offer for a hosted AI. Left unchanged per Q52, for your copy review.
- `isPledged` (ticket 05) also counts the `unconfirmed` preset state, which Q44 does not list. The lead reuses it as is.
- `StoryCard` gained optional `title`, `body`, `testId` and an optional `onNotNow`.
