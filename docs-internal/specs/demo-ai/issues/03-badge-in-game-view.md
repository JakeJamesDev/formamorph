# 03: Demo AI Badge in the Game View

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/demo-ai/spec.md`

## What to build

While narration resolves to the Demo AI, a **Demo AI** badge stays in the game view. It is a status, so it
has no dismiss control. The tooltip holds the short copy from the spec under "Badge tooltip copy". A click
opens the dialog from ticket 02. The badge joins the component that ticket 02 built.

The game view has no endpoint or model badge today, so the position is new. **The user approves the
position.** Render the badge in two or three candidate positions, capture static frames at a realistic
desktop width and at a mobile width, and show them to the user. Build the approved position. Do not close
the ticket before the user picks one.

The badge uses existing design-system tokens and components. The account status pill is a different
concept and is not the base.

## Acceptance criteria

- [ ] The badge shows whenever narration resolves to the Demo AI, and it goes away when narration resolves to any other endpoint, with no reload.
- [ ] The badge shows when the seen-key is already set, and after a return to the Demo AI from another endpoint.
- [ ] The badge has no dismiss control.
- [ ] The tooltip copy matches the spec word for word. The desktop sentence does not render in the native app, on an Android or iOS user agent, or in the desktop app.
- [ ] A click on the badge opens the dialog. The badge works by keyboard, and it has an accessible name.
- [ ] The user picked the position from static frames at both widths, and the built position matches the pick.
- [ ] The badge does not cover or shift game view controls at either width, in the Pages layout and in the Chat layout.
- [ ] Tests at the rendered-component seam prove the show and hide rule, the reopen click, and the tooltip gating. Each guard fails when its bug returns.
- [ ] Verified in the preview with static-frame or DOM evidence, in both themes.
- [ ] `docs/Changelog.md` has an In-Progress entry in the player bucket, or the ticket 02 entry gains the badge.
- [ ] Four gates green. `graphify update .` run.
