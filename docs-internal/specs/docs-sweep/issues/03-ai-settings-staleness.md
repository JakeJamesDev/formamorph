# 03: AI and Settings Staleness

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across Settings and its defaults, endpoints and per-prompt routing, image generation, memory, and VRM avatars.

## What to build

Bring these pages in line with the app on `main`: [Connect-Your-Own-AI](../../../../docs/Connect-Your-Own-AI.md), [Settings](../../../../docs/Settings.md), [Image-Generation](../../../../docs/Image-Generation.md), [Memory](../../../../docs/Memory.md), [Avatars](../../../../docs/Avatars.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 04 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [x] Every control, tab and setting name on the pages matches its on-screen label (claims checked against component source and settingsCopy.ts; fixed View 3D Model, the AI gate titles and buttons)
- [x] Every default and limit the pages state matches the source (settingsDefaults.ts and SettingsContext.tsx; fixed image generation default, Memory Cap minimum, Autosaves Kept range)
- [x] No page describes a removed feature (none found)
- [x] Shipped behavior on each page's subject has at least a short mention (Q14 depth: Entity Movement, Clean Up Tags, Duplicate, Formamorph AI states, Auto-Load, Time Per Turn, reachability badge, prompt routing link, GLB badge, Default Avatar menu items)
- [x] A renamed or removed heading updates every anchor table that names it; the docs tests are green (no heading renamed; docs tests 345/345)
- [x] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed (docs only)
- [x] Landed lists any missing page, stale ADR, or contradicting UI label found on the way

## Landed

Copy sweep on the five pages: 194 notices before, 194 after (advisory; wording is ticket 04).

**Not verified:** none. No dev-router check: every claim was settled in source.

**For you:**
- Image generation is on by default (`imageGenDisabled` = false, SettingsContext.tsx:1279), so a new player sees **Generate with AI** buttons with no server. The pages now say so; check the default is intended.
- **Reset All My Changes** in the Memories dialog deletes hand-written memories for good. Memory.md called the dialog "nothing here is destructive"; the page now follows the code.

**Contradicting UI labels:**
- The **Restore Default Worlds** confirm names three worlds (settingsCopy.ts:769); eight are bundled.
- The Prompts tab's Endpoint info says "the **AI Endpoints** tab" (SettingsModal.tsx:1028); the tab is **Endpoints**.
- The **Scene Images** info says to draw one scene "from the button above the story" (settingsCopy.ts:395); the entry is the turn's **More** menu → **Generate Scene Image**.
- The InvokeAI setup guide lists "SDXL, SD1.5, or Z-Image" (ImageSetupGuide.tsx:76-77) and leaves out Anima and SD2.
- The InvokeAI **Face Fix** hint says "Works with SDXL and SD1.5 only" (SettingsModal.tsx:1393); the code runs it on SD2 too and skips only Z-Image and Anima (invokeai.ts:758). The page follows the code.

**Also added:** Formamorph AI's allowance warnings in play (spec-session scope add from ticket 01).

**For ticket 04:** Settings `## Output` is about 6,100 characters with its HTML comments, close to the 6,000-character prose limit at which the bundled docs index splits a section. Text added there splits the section and fails the `Settings#output` hub tests in bundledDocsIndex.test.ts.

No missing page or stale ADR found.
