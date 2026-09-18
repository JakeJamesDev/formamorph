# Demo AI — Spec

Status: ready-for-agent
Spec session: Default endpoint quality expectations popup

The hosted endpoint that ships as "Default" gets the name **Demo AI**. A one-time dialog and a persistent
badge in the game view tell the player what the Demo AI is and how to get better narration. A new wiki page
gives the steps to connect a different AI.

## Problem Statement

A web player starts Formamorph with the hosted endpoint already selected. The preset name is "Default", so
the player reads it as the intended way to play. It is a small free model that exists so a player can try
the app with no setup.

The model writes all the narration, so the model limits the quality of every world. A player who sees flat
narration blames the app or the world. World authors now add their own warnings to their worlds, because
the app says nothing.

## Solution

- The preset name changes from "Default" to **Demo AI** in all player-facing text. The name states what the
  endpoint is for.
- The first time a player enters the game view on the Demo AI, a dialog sets the expectation. It says what
  the Demo AI is, why a stronger model matters, and how to connect one.
- While the Demo AI writes the narration, a **Demo AI** badge stays in the game view. Its tooltip holds a
  one-line version of the message. A click opens the dialog again.
- A new wiki page gives the steps: a local server, a hosted API service, or the desktop app.

### Dialog copy

> **You're Playing on the Demo AI**
>
> Formamorph is using its free built-in AI. It's a small model, and it's here so you can try the app with
> zero setup.
>
> The AI writes everything you read. A stronger model gives you sharper narration, a better memory of your
> story, and characters who stay in character. Nothing else in Formamorph changes the experience as much.
>
> If a world feels flat, try it on a stronger model before you judge it.
>
> For the full experience, connect your own AI in **Settings**. Any OpenAI-compatible endpoint works, local
> or hosted. *[link]* How to set up your own AI
>
> *[desktop-capable devices only]* Want to run a model on your own PC? The desktop app has the AI engine
> built in, so there's nothing extra to install. The model you can run depends on your hardware.
>
> **Connect an AI** · *[desktop-capable devices only]* **Get the Desktop App** · **Keep Playing**

### Badge tooltip copy

> A small free model for trying Formamorph. For much better narration, connect a stronger AI in
> **Settings**. *[desktop-capable devices only]* The desktop app can run one on your PC if your hardware
> allows.

## User Stories

1. As a new web player, I want the app to tell me that the built-in AI is a demo, so that I set my expectations before I read any narration.
2. As a new web player, I want to know that the model writes everything I read, so that I know where narration quality comes from.
3. As a new web player, I want to know that a stronger model gives better narration, so that I know an upgrade path exists.
4. As a player who reads a flat world, I want the app to tell me to try a stronger model first, so that I do not judge the world by the Demo AI.
5. As a world author, I want the app to set this expectation for me, so that I do not have to write a model warning into my world.
6. As a player, I want the dialog to show one time only, so that the app does not nag me.
7. As a player, I want a **Keep Playing** button, so that I can continue on the Demo AI with no penalty.
8. As a player, I want a **Connect an AI** button that opens Settings on the Endpoints tab, so that I reach the right form in one click.
9. As a player who has no AI yet, I want a link to setup steps, so that I know what to install and what to paste.
10. As a player on a PC, I want to know that the desktop app has the AI engine built in, so that I can skip a separate server install.
11. As a player on a PC, I want the dialog to say that the model I can run depends on my hardware, so that I do not expect the desktop app to remove hardware limits.
12. As a player on a PC, I want a **Get the Desktop App** button that opens formamorph.ai, so that I can find the download.
13. As a player in the Android app, I want no desktop pitch, so that the dialog does not offer me something I cannot run.
14. As a player in a mobile browser on Android or iOS, I want no desktop pitch, so that the dialog stays relevant to my device.
15. As a desktop app player who selects the Demo AI, I want the dialog without the desktop pitch, so that the app does not advertise itself to me.
16. As an existing player who already uses the hosted endpoint, I want to see the dialog once on my next entry, so that I get the same information as a new player.
17. As a player who loads a save, I want the dialog on that entry too, so that I get the message even if I never start a new game.
18. As a player who closed the dialog, I want a **Demo AI** badge in the game view, so that I can see later why narration reads flat.
19. As a player, I want the badge tooltip to give the short message, so that I get the point without a dialog.
20. As a player, I want a click on the badge to open the dialog again, so that I can find the buttons and the link later.
21. As a player, I want the badge to go away when I connect a different AI, so that it reflects the real state.
22. As a player, I want the badge to be permanent while the Demo AI is active, so that it works as a status and not as a notice I can lose.
23. As a player who connects my own AI and later returns to the Demo AI, I want the badge only, so that I do not read the same dialog twice.
24. As a player who routes narration to my own AI and other prompts to the Demo AI, I want no badge and no dialog, so that the app does not warn me about narration that my own model writes.
25. As a player who routes narration to the Demo AI and other prompts elsewhere, I want the badge and the dialog, so that the warning follows the narration model.
26. As a player whose Demo AI is unreachable on entry, I want only the unreachable gate, so that I see one dialog at a time.
27. As a player whose Demo AI was unreachable on entry, I want the Demo AI dialog on my next entry, so that I do not lose the message.
28. As a player who enters a world that has a readme, I want the Demo AI dialog before the readme, so that the app's message comes before the world's.
29. As a player, I want the readme to open after I close the Demo AI dialog, so that I lose nothing.
30. As a player in Settings, I want the preset to read **Demo AI**, so that the dialog, the badge, and Settings use one term.
31. As a player who reads the AI context viewer or Prompt Options, I want routed prompts to show **Demo AI** as the preset name, so that the term is the same everywhere.
32. As a player who has no context window set, I want the Settings hint to say **Demo AI** and not "shared endpoint", so that one endpoint has one name.
33. As a developer with an overridden default endpoint, I want my build to keep the name "Default" with no badge and no dialog, so that my local server is not called a demo.
34. As a self-hoster who builds with a different default endpoint, I want the same rule, so that the Demo AI name applies only to the hosted service.
35. As a player with stored settings, I want the rename to keep my active preset and my prompt routing, so that nothing resets.
36. As a wiki reader, I want steps for LM Studio and Ollama, so that I can run a local model and connect it.
37. As a wiki reader, I want the CORS step in the local server steps, so that my browser can reach the server.
38. As a wiki reader, I want generic steps for a hosted API service with a token, so that I can use a paid service without local hardware.
39. As a wiki reader, I want the desktop app route with its hardware caveat, so that I can pick the path with the fewest installs.
40. As a wiki reader, I want model advice by type with a rough size floor, so that I know what to look for without a list that goes out of date.
41. As a reader of Home and the Android install page, I want them to say **Demo AI**, so that the docs match the app.
42. As a reader of the changelog, I want one entry that states the rename, so that old mentions of "default endpoint" still make sense.
43. As a developer, I want a dev-route entry for the dialog, so that I can open it with one `goto`.

## Implementation Decisions

### Identity: what counts as the Demo AI

- A new pure helper answers "is this resolved endpoint the hosted Demo AI". It is true only when the preset id is the built-in default id and the endpoint URL is the hosted service URL.
- The hosted service URL becomes its own constant, separate from the overridable default-endpoint constant. The overridable constant falls back to it. When a build overrides the default endpoint, the two differ, and the helper returns false.
- The existing "built-in preset is active" check does not serve, because it is also true for the desktop engine and for ghost ids.
- For the badge and the dialog, the helper runs on the endpoint that the narration prompt kind resolves to. Routing of other prompt kinds has no effect.

### Rename

- The built-in preset's display name and the two fallback preset-name literals in the settings context come from the helper's rule: "Demo AI" on the hosted URL, "Default" on an overridden build.
- The Settings hint that says "shared endpoint" changes to use "Demo AI".
- The preset id, the constants, the `VITE_DEFAULT_*` names, and the model alias stay. The display name of the built-in preset is never stored, so no stored value changes.
- Other "Default" labels are different concepts and stay: prompt presets, dictionary books, image presets, and the "Endpoint Default" sampler labels.

### Dialog and badge

- One new component owns the dialog, the badge, and the seen-key. It is separate from the AI setup gate, which already carries six branches.
- The seen-key is one new `localStorage` flag, written when the dialog shows. It never resets, so a return to the Demo AI shows the badge only. The key is new, so existing installs see the dialog once.
- The badge shows whenever narration resolves to the Demo AI. It has no dismiss control. The tooltip holds the short copy. A click opens the dialog.
- **Connect an AI** opens Settings on the Endpoints tab. **Get the Desktop App** opens formamorph.ai in a new tab. **Keep Playing** closes the dialog. The wiki link opens the new page in a new tab.
- A pure "can this device run the desktop app" check gates the desktop paragraph, the desktop button, and the desktop sentence in the tooltip. It is false in the Capacitor native app, in a browser whose user agent is Android or iOS, and in the desktop app. Viewport width does not decide this.
- The copy follows the help-copy rules: second person, contractions, positive statements, title case for the title and buttons.

### Entry order

- A new pure function picks the one dialog that opens on entry to the game view. Its inputs are: the AI is unreachable, the Demo AI dialog is pending, a readme is pending. Order: the unreachable gate, then the Demo AI dialog, then the readme.
- When the unreachable gate wins, the Demo AI dialog does not show in that entry and the seen-key stays unset. It shows on the next entry.
- When the Demo AI dialog wins, the readme opens after the dialog closes, in the same entry.
- New game and loaded save both count as an entry.
- The game view gets wiring only: it mounts the component, feeds the function, and holds the readme until the function releases it.

### Badge placement

- The game view has no endpoint or model badge today, so the position is new. The implementer renders a mock at a realistic desktop width and at a mobile width, and the user approves the position before the ticket closes.
- The badge uses existing design-system tokens and components. The account status pill is a different concept and is not the base.

### Wiki page

- One new page in the wiki source, linked from the sidebar and from Home. Sections: local server steps for LM Studio and Ollama (install, load a model, enable CORS, paste the URL into Settings → Endpoints), hosted API services in generic terms (an OpenAI-compatible chat-completions URL and a token, no service names), and the desktop app route with the hardware caveat.
- Model advice: a model tuned for roleplay or conversation, 12B or larger as a rough guide, the largest that the hardware runs well. No model names. The dialog itself carries no size number.
- No troubleshooting section. The in-app "can't reach your AI server" checklist keeps that job.
- Home and the Android install page change their mentions of the default or cloud endpoint to "Demo AI".

### Housekeeping

- A dev-route modal entry opens the dialog in the game view.
- One changelog In-Progress entry in the player bucket. It states the rename, so released sections that say "default endpoint" stay readable. Released sections do not change.
- No change to the export shape of worlds or saves.

## Testing Decisions

A good test here drives the public surface and asserts what the player sees: text on screen, which dialog is open, what a click does. It does not assert internal state or call order.

| Seam | What the tests prove | Prior art |
|---|---|---|
| The rendered notice component inside real settings providers, without the game view | Dialog copy, the seen-key (shows once, stays seen after a switch away and back), badge present only when narration resolves to the Demo AI, badge click reopens the dialog, button targets, the desktop paragraph and button hidden on mobile user agents, in the native app, and in the desktop app | The AI setup gate's component tests |
| The pure entry-order function | Unreachable gate wins and leaves the Demo AI dialog pending; Demo AI dialog goes before the readme; readme alone opens at once | The Test Bench's pure rule seams |
| The pure Demo AI identity helper | True only for the default id on the hosted URL; false for an overridden default, a user preset on any URL, and the desktop engine; narration routing decides; the display name follows the same rule | The text endpoint preset tests and the prompt routing tests |
| The dev-route drift guard | The new modal entry is registered | The dev router tests |

- Each guard is proven against its bug: reinstate the wrong behavior once and confirm that the test fails.
- The user-agent cases use real Android and iOS user-agent strings, not a stub that returns a boolean.
- The badge position gets static-frame evidence in the preview at both widths. No test asserts motion or timing.

## Out of Scope

- Changes to the hosted model, its context limit, or its samplers.
- A size number or model names in the dialog.
- A new in-app setup guide. The wiki page holds the steps.
- Changes to the AI setup gate or to the "can't reach your AI server" checklist.
- A rename of identifiers, environment variable names, or the model alias.
- Edits to released changelog sections.
- A troubleshooting section on the wiki page.
- A name for any hosted API service.
- A Playwright check. The component and pure seams cover the behavior.

## Further Notes

- "Demo AI" is the defined term. Use it for the hosted endpoint in every new player-facing string, and do not alternate with "default", "shared", "cloud", or "free" endpoint.
- The hosted model's own narration tests well for its size. The copy says "small" and "free". It does not say the model is bad.
- The project owner's `.env.local` overrides the default endpoint to a local server, so the dev build shows "Default" and no badge. To see the feature in the dev build, open the dialog by dev route, or select a preset state that resolves to the hosted URL.
