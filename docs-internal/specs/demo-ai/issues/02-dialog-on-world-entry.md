# 02: Demo AI Dialog on World Entry

Status: ready-for-human
Status note: Built in "Add Demo AI Dialog On World Entry". The readme also waits while Settings is open, so Connect an AI doesn't stack it.
Base: 54d755f2
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/demo-ai/spec.md`

## What to build

The first time a player enters the game view while narration resolves to the Demo AI, a dialog sets the
expectation. It shows once per install. The copy is final and lives in the spec under "Dialog copy". Use it
word for word.

- One new component owns the dialog and the seen-key. Ticket 03 adds the badge to the same component, so
  give it a way to open the dialog from outside the first-entry path.
- The seen-key is one new `localStorage` flag, written when the dialog shows. It never resets.
- A pure "can this device run the desktop app" check gates the desktop paragraph and the **Get the Desktop
  App** button. It is false in the Capacitor native app, in a browser whose user agent is Android or iOS,
  and in the desktop app. Viewport width does not decide this.
- A pure entry-order function picks the one dialog that opens on entry. Inputs: the AI is unreachable, the
  Demo AI dialog is pending, a readme is pending. Order: the unreachable gate, then the Demo AI dialog, then
  the readme.
- The game view gets wiring only. It mounts the component, feeds the function, and holds the readme until
  the function releases it.

Buttons and links:

| Control | Action |
|---|---|
| **Connect an AI** | Closes the dialog and opens Settings on the Endpoints tab |
| **Get the Desktop App** | Opens `https://formamorph.ai` in a new tab |
| **Keep Playing** | Closes the dialog |
| "How to set up your own AI" link | Opens the wiki page `Connect-Your-Own-AI` in a new tab, built from the existing wiki base constant |

## Acceptance criteria

- [ ] The dialog shows on entry to the game view when narration resolves to the Demo AI and the seen-key is unset. New game and loaded save both count.
- [ ] The dialog does not show when narration resolves to any other endpoint, even if other prompt kinds route to the Demo AI.
- [ ] The dialog shows once. After a switch to another endpoint and back, it does not show again.
- [ ] An existing install with no seen-key sees the dialog once.
- [ ] When the AI is unreachable on entry, only the unreachable gate opens, and the seen-key stays unset. The Demo AI dialog shows on the next entry.
- [ ] When the world has a readme, the Demo AI dialog opens first, and the readme opens after the dialog closes, in the same entry.
- [ ] The desktop paragraph and the **Get the Desktop App** button do not render in the native app, on an Android or iOS user agent, or in the desktop app. They render in a desktop browser.
- [ ] All four controls do what the table states.
- [ ] The dialog copy matches the spec word for word, with title case for the title and the buttons.
- [ ] A dev-route modal entry opens the dialog in the game view, and the drift-guard test covers it.
- [ ] Tests at the rendered-component seam prove the seen-key, the narration-routing rule, the device gating with real Android and iOS user-agent strings, and the controls. Tests at the pure entry-order seam prove all three order cases. Each guard fails when its bug returns.
- [ ] Verified in the preview by dev route at a realistic desktop width and a mobile width, with static-frame or DOM evidence, in both themes.
- [ ] `docs/Changelog.md` has an In-Progress entry in the player bucket.
- [ ] No world or save export shape changes. The only new stored value is the seen-key.
- [ ] Four gates green. `graphify update .` run.
