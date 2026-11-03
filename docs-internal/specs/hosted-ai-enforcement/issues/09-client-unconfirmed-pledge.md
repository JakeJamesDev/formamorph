# 09: Client Shows an Unconfirmed Pledge

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` (Client, Q6)

Model rationale: a new state through several surfaces, with new copy.

**What to build:** a Supporter whose pledge cannot be confirmed sees that plainly wherever the Hosted state shows, and is never told they have no pledge. The client mirrors `pledge_unconfirmed` and `unconfirmed` from ticket 04. Service returns with no action from the player.

- [ ] The refusal list and the state list hold the new names, and the state parses.
- [ ] Every surface that shows the Hosted state handles `unconfirmed`, including the site's account surface if it reads the state. Each has a dev route.
- [ ] A call in this state does not send, and the player sees the new text.
- [ ] The copy follows the Writing Guide, from a facts list in the player's words.
- [ ] Frames at `.scratch/frames/unconfirmed-*.png`, light and dark, at a desktop and a mobile width.
- [ ] The Hosted state entry in the client glossary lists the state, and a changelog fragment is added.
