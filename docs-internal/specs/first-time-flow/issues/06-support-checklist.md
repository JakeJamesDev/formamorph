# 06: Support Checklist

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: wires existing auth, age gate, Patreon and preset paths into one surface, with no new service.

**What to build:** **Support on Patreon** in the scene opens a guided checklist: sign in with the 18+ check, pledge on Patreon, link Patreon, switch to Formamorph AI. Each step shows its real state, and a player who returns from Patreon picks up where they left off. The fire beside Morphie grows with each finished step.

- [ ] Each step reads real state through `AuthService`, `useAgeGate`, `PatreonService.getStatus()` and the hosted state, and re-reads on focus.
- [ ] Each action reuses the existing path: `requireAttestation`, the Patreon page, `startLink`, and `selectTextEndpointPreset`, so the switch-back still works.
- [ ] Rendered tests cover every state, including a return with the pledge done and the link not done. A player already signed in starts past step one.
- [ ] A player who finishes returns to the story on Formamorph AI. **Finish Later** returns to the story and loses no progress.
- [ ] Morphie plays the Jelly on each finished step, and no row moves.
- [ ] Button order follows Paired Footer Actions.
- [ ] The checklist has a dev route. Frames at `.scratch/frames/checklist-1280.png` and `.scratch/frames/checklist-375.png`.
- [ ] A changelog fragment states what changed for the player.

For you: the checklist's wording, and one real run with your own Patreon test pledge.
