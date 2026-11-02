# 06: Remove eSpeak NG

Status: ready-for-human
Blocked by: 03, 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Mostly removal and one guard. The final bar run is what closes the Steam blocker.

## What to build

No build holds eSpeak NG. `phonemizer` and `kokoro-js` leave the dependencies, along with the old phoneme step. A check over the build output fails on eSpeak NG and `phonemizer` markers, in the place the build gate runs.

The notices generator drops both packages. The hand-kept Bundled assets section drops eSpeak NG and its GPL text, and adds the CMUdict BSD-style license and the model. The client and phoneme step adapt `kokoro-js` code, so that Apache-2.0 notice moves to the hand-kept section when the generator drops the package. The generator already drops it, because Ticket 02 took the package out of the module graph, and the entry stays by hand in the generated list until this ticket moves it. So move it before any `gen-notices` run.

Run the full bar on the final pipeline. Update the ear test record with every result.

Rulings: Q1, Q2, Q3, Q4, Q6, Q8, Q11, Q16. Spec sections: Build check, Notices.

## Acceptance criteria

- [x] Neither package is in the dependencies or the lockfile. `npm uninstall kokoro-js --package-lock-only` removed both, and a grep of `package.json` and `package-lock.json` finds neither.
- [x] The build check passes on a clean build, and it fails when `phonemizer` is put back. The failing output is quoted. With a probe import of `phonemizer` in `phonemeStep.ts` and the notices guard bypassed: `Error: eSpeak NG is in the build output (GPL-3.0). assets/TTSModal-DX5nDqEA.js: eSpeakNG`, exit 1. Without the bypass the notices guard fails first, on `THIRD-PARTY-NOTICES.md is out of date`. `scripts/espeakCheck.test.mjs` covers the check on its own.
- [x] Web, desktop, and Android builds all pass the check. `FORMAMORPH_BUILD=web`, `portable`, and `android` each ran `vite build` and exited 0.
- [x] The Licenses tab no longer lists eSpeak NG, and it lists CMUdict, the model, and the adapted `kokoro-js` code. `LicensesPanel.test.tsx`, "lists Bundled Assets, then Standards, then Software…".
- [x] The notices drift guard passes. `npm run gen-notices` ran green (350 packages), then all three builds passed the guard. `shipNotices.test.ts` passes.
- [x] Final scores on the frozen sets are quoted against the stored eSpeak numbers, within 0.5 points. The phoneme error scores are in "Final Bar Run" in `ear-test-strange-words.md`. None is above eSpeak's. The ear totals are the owner's step.
- [x] Text to Speech generates a clip in the preview, in one American and one British voice. `af_heart` 4.08 s and `bf_emma` 4.25 s through `KokoroClient.generate`, with non-silent audio.
- [x] A changelog fragment is added. `docs-internal/changelog.d/espeak-ng-replacement-06.md`.

For you: the final blind listening pass in Text to Speech, plus the strange and fantasy word totals. This pass is the last part of the bar, and the Steam blocker closes on your yes.

## Landed

**Not verified**
- The listening bars. The strange and fantasy totals are ear ratings, so this session could not produce them. The Steam blocker closes on the owner's yes, not on this landing.
- A packaged desktop build and a built APK. The three `vite build` targets pass, and the packages ship the same `dist`.

**For you**
- The final blind listening pass in Text to Speech, plus the strange and fantasy word totals. This pass is the last part of the bar, and the Steam blocker closes on your yes.
- I read "the model" in the Licenses tab as our pronunciation model, with its own CMUdict-license entry. The Kokoro voice weights have no entry, as before. Say so if you want one.
- The `kokoro-js` notice is a hand-kept entry in Bundled Assets, ahead of Webfonts.
