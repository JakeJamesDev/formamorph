# 05: Moves Between

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

A new candidate set on the ticket 04 pass, plus one commit rule.

## What to build

A Moves Between entity in the scene gets a request whose candidates are stay, come along, and each of its own locations one Connection hop away. It walks between its locations one hop at a time. "Come along" moves it with the player once, only when the destination is one of its own locations, and it never joins the followers.

## Acceptance criteria

- [ ] Candidates: stay, come along, and its own locations among the router's effective destinations from where it stands.
- [ ] "Go to a location" applies at once, in both modes.
- [ ] "Come along" moves it only when the player's destination is one of its locations; otherwise it stays. It never joins the followers.
- [ ] Turn-commit tests cover the move-once rule and the outside-its-locations refusal; turn-pass tests cover the candidate list.
- [ ] The existing probe set from ticket 04 gains a Moves Between case (Captain Blackwell).
