# 12: Narration Seed Set

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

About 100 narration passages from the bundled worlds, pre-labeled by the current big model, for the user to correct. Once corrected, they become the narration dev set and join the corpus.

- **Passages:** generate them by playing bundled worlds on the cloud default endpoint. Cover several casts, same-gender pairs, descriptors and dialogue.
- **Pre-labels:** label the passages with the e120 model, in the kit's corpus format.
- **Correction view:** a static page in the kit, not the app. It shows each passage with its clusters, lets the user fix links, and saves the file.
- **Privacy:** never include personal data or real player text.

## Acceptance criteria

- [ ] About 100 pre-labeled passages exist in the corpus format, each with its source world and turn recorded.
- [ ] The correction view loads the file, edits links and saves a valid corpus file.
- [ ] The kit scores a model against the corrected set as the narration dev set.

For you: correct the pre-labeled passages in the correction view.
