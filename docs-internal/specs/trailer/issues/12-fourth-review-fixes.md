# 12: Fourth Review Fixes

Status: ready-for-human
Blocked by: 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: two new animated captures (the reveal recapture with a smoothness check, Morphie's thinking-to-idle clip), a reordered authoring section with two new cards, and a changed loop.

Parent: [Trailer spec](../spec.md)

## What to build

The user's fourth review. Each item is a ruling.

- **Opening (Q40).** Cut W01 and T01. The cut opens on the Formamorph title card, which is the whole 6 s loop: it enters, holds and leaves inside frames 0 to 359, and frames 0 and 359 are the bare stage. The end card stays.
- **Reveal recapture (Q41).** Recapture the narration reveal clip against the current app. Add a smoothness check to the capture: the per-frame pixel change across the clip, failing a frame whose change is far above the clip's median. Print the series in the capture output and look at the clip's contact sheet.
- **Chat shot (Q42).** Capture W08/T07 on the Authoring Tour's world and its entity. Find them from the tour's code, not by guess.
- **Authoring order (Q43).** Map, then "Write who lives there." on the profile, then "Then travel there and meet them." on the Change Location dialog, then the traits title card, then blueprints. Update the storyboard §2 and §4, the capture list and both cuts. The tall stack pairs follow the new order.
- **Two title cards (Q44, Q45).** A kinetic text card "Traits shape who you play." before blueprints, and "Need help? Just ask." before Morphie. Both lines are the spec session's proposals; if the user sends other lines before you reach them, use those.
- **Morphie (Q46, Q47).** Caption "Ask your AI guide Morphie for help at any time." The shot is a clip: she starts in her thinking animation and moves to idle as her canned answer streams in. Capture with the page clock controlled, like the avatar clip. Her animation and the answer stream must both read in the card; check the subject region covers both.
- Re-render both cuts, update storyboard totals, and look at every changed shot on the contact sheets.

## Acceptance criteria

- [ ] The cut opens on the title card; W01 and T01 are gone; both 6 s loops pass with frames 0 and 359 on the bare stage.
- [ ] The reveal clip is recaptured; the capture prints the per-frame change series and fails a spike; the clip's contact sheet shows a smooth reveal.
- [ ] The chat shot shows the Authoring Tour's world and entity.
- [ ] The authoring order is map, profile, travel, traits card, blueprints in both cuts and the storyboard.
- [ ] Both new title cards exist with their lines and pass the reading checks.
- [ ] The Morphie shot plays a clip from thinking to idle as the answer streams, under the new caption; the subject region covers her and the answer.
- [ ] Every line passes hold, rate, enter and exit; every card passes the subject check; the Steam checks pass; storyboard totals match the renders.

## Notes

- **Edge growths (Q52).** The fresh reveal clips jump where the narration's bottom edge grows one line, or a paragraph gap and a line, in one frame. The app has no height easing there. The capture records that edge per frame and passes a jump only when everything outside the growth band moves as usual. Wide `narration-clip`: frames 50, 78, 104, 136, 163, 189, 221, 249, 273. Tall `narration-clip-tall`: frames 43, 62, 82, 102, 104, 129, 148, 169, 189, 212, 234, 251, 270. A square painted on wide frame 104 outside the band turned that frame back into a failing jump. A growth passes only at 0.9–1.1 lines or 1.5–1.9 lines (measured: 1.00, and 1.67–1.76), so two lines in one frame still fail. Frame 1 of a reveal clip is the send itself (8.2% wide, 17.3% tall) and is exempt too.
- **Tour world (Q42).** The capture builds the chat shot's world in the browser with `replayTourSteps(newBlankWorld(), TOUR_STEPS.length)` from the app's own modules: Brinewell, with Maren at the Tidewell. Nothing is copied by hand.
- **Morphie clip (Q47).** `help-clip` opens on her thinking look, holds the reply for 45 frames, then streams the canned answer at about 12 words a second on the page clock while she springs to idle. The page's own `fetch` serves the reply, since a routed reply lands whole and the answer then shows at once. The guide-section pick comes whole. The motion rule fails reveal clips only; her change of look is real motion over about 25 frames, so other clips print their series.
- **Repeatable.** `npm run capture:diff` printed `same` for `narration-clip`, `narration-clip-tall`, `help-clip` and `chat`.
- **Tall chat crop.** T07 keeps the chat column, so Maren's portrait shows in the wide W08 only.
- **Tall order (Q51).** T09 is the map alone, T10 stacks the profile and the travel shot, T10a is the traits card, and T10b is the blueprints alone. The help card and Morphie stay out of the tall cut.
