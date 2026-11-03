# 09: Client Shows an Unconfirmed Pledge

Status: ready-for-human
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` (Client, Q6)

Model rationale: a new state through several surfaces, with new copy.

**What to build:** a Supporter whose pledge cannot be confirmed sees that plainly wherever the Hosted state shows, and is never told they have no pledge. The client mirrors `pledge_unconfirmed` and `unconfirmed` from ticket 04. Service returns with no action from the player.

- [x] The refusal list and the state list hold the new names, and the state parses. (hostedAi.test "matches the server list", "reads unconfirmed as reported")
- [x] Every surface that shows the Hosted state handles `unconfirmed`, including the site's account surface if it reads the state. Each has a dev route. (`allowance=unconfirmed`, `fixture=fai-unconfirmed`; site test "says so plainly"; spec review swept every reader)
- [x] A call in this state does not send, and the player sees the new text. (requestTransport.hosted.test "sends no call while the pledge is unconfirmed"; DOM read of the status)
- [x] The copy follows the Writing Guide, from a facts list in the player's words. (sentence set by the spec session; checked against the status-text rules)
- [x] Frames at `.scratch/frames/unconfirmed-*.png`, light and dark, at a desktop and a mobile width. (four frames)
- [x] The Hosted state entry in the client glossary lists the state, and a changelog fragment is added. (`CONTEXT.md`, `docs-internal/changelog.d/hosted-ai-enforcement-09.md`)

## Landed

**Not verified**
- The desktop frames come from the preview pane's own width, not a 1280 window.
- No test covers the once-per-state blocking notice for this state. It rests on the shared `claimAnnouncement` path that `locked` also uses.

**For you**
- Read the sentence aloud once: "We can't confirm your Patreon pledge right now. Formamorph AI will work again as soon as we can." Look at `.scratch/hosted-ai-enforcement-09/frames/unconfirmed-desktop-light.png`.
- The tier shows as "Member" in the dev fixture. Check the live label against a real unconfirmed account.
- Mid-turn, an `unconfirmed` refusal is not let through the way `exhausted` and `paused` are. It behaves like `locked`.
