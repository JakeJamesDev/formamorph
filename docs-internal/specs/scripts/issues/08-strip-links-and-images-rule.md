# 08: Strip Links And Images Rule

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: a pure text rule applied at four request seams, with a default that depends on world age.

## What to build

A world option, **Strip Links And Images**, removes markdown links and images from narration history before any request: a link becomes its text and an image is removed (Q9). It covers last story, turn digests, diary entries and recall results, never authored text (Q10). A new world has it on; an existing world loads with it off, so an update changes no request (Q28). The option sits with the other world settings with a help line in the Writing Guide voice.

Spec: Q9, Q10, Q28, story 9.

## Acceptance criteria

- [ ] With the rule on, a narration holding a link and an image reaches the next request as plain text with the image gone; a test reads the request body
- [ ] Digests, diary entries and recall results pass through the same rule; authored descriptions and dictionary entries do not
- [ ] A new world has the rule on; a world file without the field loads with it off
- [ ] Four gates green

## Blocked by

- None (can start immediately)
