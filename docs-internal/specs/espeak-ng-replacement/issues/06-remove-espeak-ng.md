# 06: Remove eSpeak NG

Status: ready-for-agent
Blocked by: 03, 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Mostly removal and one guard. The final bar run is what closes the Steam blocker.

## What to build

No build holds eSpeak NG. `phonemizer` and `kokoro-js` leave the dependencies, along with the old phoneme step. A check over the build output fails on eSpeak NG and `phonemizer` markers, in the place the build gate runs.

The notices generator drops both packages. The hand-kept Bundled assets section drops eSpeak NG and its GPL text, and adds the CMUdict BSD-style license and the model.

Run the full bar on the final pipeline. Update the ear test record with every result.

Rulings: Q1, Q2, Q3, Q4, Q6, Q8, Q11, Q16. Spec sections: Build check, Notices.

## Acceptance criteria

- [ ] Neither package is in the dependencies or the lockfile.
- [ ] The build check passes on a clean build, and it fails when `phonemizer` is put back. The failing output is quoted.
- [ ] Web, desktop, and Android builds all pass the check.
- [ ] The Licenses tab no longer lists eSpeak NG, and it lists CMUdict and the model.
- [ ] The notices drift guard passes.
- [ ] Final scores on the frozen sets are quoted against the stored eSpeak numbers, within 0.5 points.
- [ ] Text to Speech generates a clip in the preview, in one American and one British voice.
- [ ] A changelog fragment is added.

For you: the final blind listening pass in Text to Speech, plus the strange and fantasy word totals. This pass is the last part of the bar, and the Steam blocker closes on your yes.
