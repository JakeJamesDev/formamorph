# Settings Sweep — Spec

Make the Settings modal read as though it were designed and written in one sitting.

Status: done
Status note: (2026-08-11, four commits c536ab9…5caa7f3) · Label: ready-for-human

> **§11 answered before implementation:** 1 — Display → Narration. 2 — enforce R2 on the Prompts tab, long bodies to ⓘ. 3 — LocalModelPanel's own toggle left alone, still a visible seam. 4 — R3's check dropped to review-only. 5 — **Summaries** for user-facing text; internal identifiers (`memoryDigests`) unchanged.

---

## 1. The rules

These are the whole product of this sweep. Everything below is their application.

| # | Rule | Enforced by |
|---|---|---|
| R1 | **Every setting has a description.** No bare rows. | Guard test |
| R2 | **One sentence, ends with a period, ≤ 12 words.** | Guard test |
| R3 | **Third-person, effect-first voice.** Describes what the setting does — never commands the player or the AI. | Review |
| R4 | **Title Case for every label, button, section header, and dialog title.** | Guard test |
| R5 | **ⓘ is for cost, tradeoff, or mechanism only.** Never a restatement of the description. | Review |
| R6 | **"Experimental" is a badge, not a word in the copy.** | Data flag |
| R7 | **Every row goes through `Row` / `CheckRow`.** No hand-rolled grids, no spacer divs. | Review |

### R3 in practice

| ✗ Imperative to AI | ✗ Second person | ✓ House voice |
|---|---|---|
| "Condense older turns…" | "Lets you keep long stories…" | "Condenses older turns so long stories stay coherent." |
| "Let the AI use bold, lists, and tables." | "You can draw a scene by hand." | "Allows bold, lists, and tables in narration." |

Third person works on every control type. Imperative reads as nonsense on a slider ("Cap how many memories…" is not something a slider does), which is exactly why the current copy fractured.

### R2's ceiling

12 words fits one line in the description column at the modal's 900px width. Wrapping is the mechanism by which rows get unequal heights, and unequal heights are the loudest *piled-on* signal. Anything that needs more room goes to ⓘ under R5.

### R5's test

If the ⓘ popover's first sentence paraphrases the description, delete the ⓘ. It exists to answer *what does this cost me* before the player toggles — extra requests, VRAM, slower turns, a download, a tradeoff — or *how does it actually work*.

---

## 2. Tab structure

**Display · Output · Endpoints · Prompts · Data**

Organizing principle: **by what the setting affects**, answerable without knowing the implementation. A new setting's home is decidable by asking "what changes when I move this?"

| Tab | id | Holds | Advanced-only |
|---|---|---|---|
| **Display** | `display` | Everything you see or hear. Theme, color, app font, music, background, narration reveal, narration font/size/spacing, and the two inspection toggles. | no |
| **Output** | `output` | Everything that changes what the AI produces. Language, paragraph limit, markdown, system prompts, thinking, reasoning, memory, characters, diaries, choices, concurrency. | no |
| **Endpoints** | `endpoints` | Connections and their sampling. Text + Image sub-tabs, local engine panel, tag prompt. | no |
| **Prompts** | `prompts` | Unchanged. | yes |
| **Data** | `data` | Housekeeping and destructive actions. Autosave, restore worlds, clear cached images, reset tutorials. | no |

### What moved and why

| Setting | From | To | Reason |
|---|---|---|---|
| Narration Font, Narration Text Size, Line Spacing, Reset Size & Spacing | Accessibility → Reading | **Display → Accessibility** | They change how the story *looks*. The section keeps the word "Accessibility" so the term stays findable. |
| Show Reasoning | Generation → Inspection | **Display → Inspection** | It controls whether a panel appears on screen. Nothing about it changes the output. |
| Show Silent Requests | Generation → Inspection | **Display → Inspection** | Same. |
| Continue the Story | Accessibility → Choices | **Output → Choices** | It adds a choice the AI responds to. |
| Autosave | Accessibility → Saves & Worlds | **Data → Saves** | Housekeeping. |
| Restore Default Worlds, Clear Cached Images | Accessibility → Saves & Worlds | **Data → Storage** | Destructive housekeeping, grouped away from per-turn settings. |
| Reset Tutorials | Accessibility → Help | **Data → Storage** | It clears stored dismissal state. Same class of action. |

Moving Show Reasoning and Show Silent Requests out is what makes **Output** honest — every remaining row in that tab demonstrably changes what comes out.

### Section map

| Tab | Sections |
|---|---|
| Display | Appearance · Scene · Narration · Accessibility · Inspection |
| Output | Turn Extras · Reasoning · Memory · Characters · Choices · Performance |
| Endpoints | *(Text / Image / Tag Prompt sub-tabs, sections unchanged)* |
| Prompts | *(unchanged)* |
| Data | Saves · Storage |

`Characters` is new — it splits Describe New Characters, Character Diaries, and Diary Recall out of `Memory`, where they currently sit only because they're memory-adjacent in the code.

---

## 3. Copy — Display

### Appearance

| Label | Before | After |
|---|---|---|
| Theme | *(per-option help)* | Sets the app's light or dark color scheme. |
| Theme Color | Recolors the whole app; applies to both light and dark. | Recolors the whole app in light and dark. |
| Font | The typeface for the whole app. | Sets the typeface for the whole app. |

Per-option help (unchanged in substance, "Recommended." lead kept — it's a genuine steer, not a description):
- Light → `Always uses the light color scheme.`
- Dark → `Always uses the dark color scheme.`
- System → `Recommended. Follows your OS light/dark setting.`

### Scene

| Label | Before | After |
|---|---|---|
| Background Music | *(none)* | **Plays each location's music during the scene.** |
| Location Background | Show the location image behind the game. Off uses a blank themed background. | Shows the location image behind the game. |
| Background Fade | Fades the location image toward the background color for readability. 0% shows the full image. | Fades the location image toward the background for readability. |

`Background Fade` gains a ⓘ carrying the dropped detail: *0% shows the full image; higher values trade the picture for legibility.*
`Location Background` drops "Off uses a blank themed background" — that's what "off" means.

### Narration

| Label | Before | After |
|---|---|---|
| Narration Reveal | How each sentence appears as it streams. | Sets how each sentence appears as it streams. |
| AI Language | *(none, ⓘ only)* | **Sets the language or style the AI writes in.** |
| Narration Reveal / demo button | — | *(button, no change)* |

`AI Language` ⓘ stays — it teaches the style trick (*"formal English"*, *"pirate speak"*), which is mechanism, not restatement.

### Accessibility *(new section here)*

Section hint: `Applies to the story text only, not the rest of the app.` *(unchanged — this earns its place)*

| Label | Before | After |
|---|---|---|
| Narration Font | *(none, ⓘ only)* | **Sets a separate typeface for the story text.** |
| Narration Text Size | *(none)* | **Scales the story text without affecting the app.** |
| Line Spacing | *(none)* | **Sets the gap between lines of story text.** |
| Reset Size & Spacing *(button)* | `Reset size & spacing` | `Reset Size & Spacing` |

### Inspection *(moved here)*

Section hint: `Surfaces work that normally happens out of sight.` *(unchanged)*

| Label | Before | After |
|---|---|---|
| Show Reasoning | Show the model's private reasoning above each turn. | Shows the model's private reasoning above each turn. |
| Show Silent Requests | Surface background requests for inspection. | Shows background requests in the status bar and context viewer. |

---

## 4. Copy — Output

### Turn Extras

Section hint: `Optional passes that run alongside each turn's narration.` *(unchanged)*

| Label | Before | After |
|---|---|---|
| System Prompts | *(none)* | **Chooses which extra passes run after each turn.** |
| ↳ Choices / Stat Updates / Location Change | *(checkboxes, no copy)* | *(unchanged)* |
| Move Automatically | Resolve the move before the scene is written. | Resolves the move before the scene is written. |

### Reasoning

| Label | Before | After |
|---|---|---|
| Thinking | *(per-option help)* | Sets how the AI plans a turn before writing it. |
| Limit Active Characters | Cap characters the director stages per turn. | Caps how many characters the director stages per turn. |
| Native Reasoning | *(per-option help)* | Sets how hard reasoning models think per request. |

`REASONING_EFFORT_HELP` currently repeats *"Only applies to models with native reasoning."* eight times — once per level. That sentence is a property of the whole control, not of any level. **Move it to the row's ⓘ and delete it from all eight strings**, leaving `Minimal effort.` / `Low effort.` / etc. This is the cleanest single instance of the piled-on problem in the modal.

The "unsupported model" variant keeps its inert message but gains Title Case treatment as a row, not a bare paragraph.

### Memory

Section hint: `What the AI carries forward from earlier turns.` *(unchanged)*

| Label | Before | After | Badge |
|---|---|---|---|
| Memory Summaries | Condense older turns so long stories stay coherent. | Condenses older turns so long stories stay coherent. | — |
| Semantic Memory | Experimental. Keep the memories most relevant to your action, not just the newest. | Keeps the memories most relevant to your action. | ⚗ |
| Memory Cap | Cap how many memories ride along each turn. | Caps how many memories ride along each turn. | — |
| Scene Recall | Experimental. Recall a full past scene when your action returns to it. | Recalls a full past scene when your action returns to it. | ⚗ |
| Time in Memory | Experimental. Tell the AI when each memory happened. | Records when each memory happened. | ⚗ |
| Measured Clock | Experimental. Measure how long each turn takes instead of assuming an hour. | Measures how long each turn actually takes. | ⚗ |
| Semantic Lore | Experimental. Activate dictionary entries by meaning, not just keywords. | Activates dictionary entries by meaning, not just keywords. | ⚗ |

All seven ⓘ bodies stay as written — they are exemplary under R5 (each states a cost, a limit, or a mechanism). This is the part of the modal that was already right; the sweep is bringing everything else up to it.

**Naming fix:** the row is `Memory Summaries` but its ⓘ points at `Prompts → Summary` and the code calls them digests. Pick one word. Spec proposes **Summaries** everywhere — row label, ⓘ cross-reference, prompt rail entry, and the comments in `settingsAdvancedData.ts`.

### Characters *(new section)*

| Label | Before | After | Badge |
|---|---|---|---|
| Describe New Characters | Write a description for each character the story invents. | Writes a description for each character the story invents. | — |
| Character Diaries | Characters keep diaries that shape their motivation. | Gives each character a diary that shapes their motivation. | — |
| Diary Recall | Experimental. Characters also recall older, relevant diary entries. | Recalls older diary entries relevant to the moment. | ⚗ |

Note: per the entity-vs-character convention these rows are genuinely about *characters* (staged participants), not entities generally, so the wording stands.

### Choices *(moved here)*

| Label | Before | After |
|---|---|---|
| Continue the Story | *(none, ⓘ only)* | **Adds a choice that nudges the story forward.** |

ⓘ unchanged — it explains the mechanism and the `Always` case.

### Performance

| Label | Before | After |
|---|---|---|
| Concurrent Requests | Fetch post-narration requests in parallel. | Fetches post-narration requests in parallel. |

### Moved out of Output

| Label | Before | After | New home |
|---|---|---|---|
| Paragraph Limit | *(per-option help)* | Limits how many paragraphs each turn may run to. | Display → Narration |
| Markdown Formatting | Let the AI use bold, lists, and tables. | Allows bold, lists, and tables in narration. | Display → Narration |

Both are presentation of the prose, not what the prose says — they belong with Narration Reveal. *(This is a judgment call worth flagging: an argument exists that they shape output. Decide before implementation.)*

---

## 5. Copy — Endpoints

### Text

| Label | Before | After |
|---|---|---|
| Preset | *(none)* | **Selects which endpoint configuration is active.** |
| Endpoint URL | *(conditional status line)* | **Points requests at your model server.** *(status line kept below)* |
| API Token | *(none)* | **Authenticates you with this endpoint.** |
| Model Name | *(none)* | **Names the model this endpoint should use.** |
| Context Window (tokens) | *(status line only)* | **Sets how much the model keeps in context.** *(status line kept)* |
| Max Output Tokens | *(none)* | **Caps how long each reply may run.** |
| Reset AI Endpoint *(button)* | — | *(unchanged, already Title Case)* |
| Trouble Connecting? *(button)* | `Trouble connecting?` | `Trouble Connecting?` |

The six status-line variants for Context Window are dynamic feedback, not descriptions — they stay verbatim and sit *below* the field, exempt from R2.

### Image

| Label | Before | After |
|---|---|---|
| Enable Image Generation | Shows the "Generate with AI" buttons. | Shows the "Generate with AI" buttons. ✓ |
| Scene Images | Draw every turn automatically (slower turns). | Draws a picture of every turn automatically. |
| Provider | *(none)* | **Selects which image server Formamorph talks to.** |
| Endpoint URL | *(none)* | **Points image requests at your server.** |
| API Token | *(none)* | **Authenticates you with this image endpoint.** |
| Model | *(none)* | **Selects which checkpoint draws the image.** |
| Prompt Prefix | Prepended to every generated prompt (quality/style tags). Leave blank for none. | Prepends quality and style tags to every generated prompt. |
| Negative Prompt | *(none)* | **Lists tags the image should avoid.** |
| Portrait (W × H) | `entity portraits` | Sets the size of entity portraits. |
| Landscape (W × H) | `locations & thumbnail` | Sets the size of locations and thumbnails. |
| Steps / CFG | *(none)* | **Sets sampling steps and prompt adherence.** |
| Sampler | *(none)* | **Selects the sampling algorithm.** |
| Face Fix | *(provider-dependent, 2 sentences)* | Re-renders faces in a second pass. *(cost → ⓘ)* |
| Workflow (API Format) | *(token list)* | Replaces the default ComfyUI graph. *(token list → ⓘ)* |
| Board | *(2 sentences)* | Files generated images under an InvokeAI board. |
| Qwen3 Encoder | *(base-dependent, 2 sentences)* | Selects the text encoder this base requires. |
| Anima VAE / Z-Image VAE | *(base-dependent, 2 sentences)* | Selects the VAE this base requires. |

Button: `How to get this` → `How to Get This`. It sits beside `How to Set Up`; the casing split between those two is the single most visible violation in the modal.

**Structural:** Enable Image Generation and Scene Images are hand-built `Checkbox + Label` rows while Face Fix two rows down uses `CheckRow`, so their labels sit in different columns. All three become `CheckRow` (R7).

The four provider/base-dependent hints keep their conditional bodies — but the *variable* half moves to ⓘ and the description stays fixed. A description that changes shape when you switch providers is another kind of piled-on.

### Local engine panel

All 12 rows already carry hints and already use `Row`/`CheckRow`. They violate R2 badly, though — every one ends with `Applies on reload.` or `Applies to the next turn.`, a sentence that is a property of the field group, not of the field.

**Proposal: hoist it.** One line under the section header — *"Sampling changes apply to the next turn; the rest need a reload."* — and delete the trailing sentence from all 12. That alone removes ~50 redundant words.

| Label | After |
|---|---|
| Context Size | Sets how much the model keeps in context. |
| GPU Layers | Chooses how much of the model runs on the GPU. |
| Layers | Sets how many layers to offload. |
| GPU | Runs the model on the GPU. |
| Flash Attention | Uses less KV-cache VRAM and often runs faster. |
| Parallel Requests | Sets how many requests the model answers at once. |
| Temperature | Raises randomness; lower values stay focused. |
| Max Output Tokens | Caps how long each reply may run. |
| Top-p | Trims unlikely words below a probability cutoff. |
| Top-k | Limits sampling to the K most likely tokens. |
| Min-p | Drops tokens far below the top token's probability. |
| Repetition Penalty | Discourages repeating text above 1. |

The dropped detail (VRAM cost, the Auto/Max/Custom distinction, the recommended-GPU steer) moves to ⓘ per R5 — it is exactly cost-and-tradeoff material.

`Reset to defaults` → `Reset to Defaults`. This panel's own Simple/Advanced toggle duplicates the modal's — **flag for a decision**, out of scope here.

### Prompts → Options panel

| Label | Before | After |
|---|---|---|
| Verbatim Turns | `recent turns kept in full before older ones are summarized` | Sets how many recent turns stay word-for-word. |
| Custom Temperature | `override this prompt's sampling temperature` | Overrides this prompt's sampling temperature. |
| Custom Repetition Penalty | `override this prompt's repetition penalty` | Overrides this prompt's repetition penalty. |
| Reasoning Budget | `share of Max Output Tokens the model may think for; 0% = no reasoning` | Sets the share of output tokens spent on reasoning. |
| Native Reasoning | `Global follows Settings → Generation → Native Reasoning…` | Overrides the global reasoning effort for this prompt. |
| Endpoint | *(conditional)* | Routes this prompt to a specific endpoint. *(pin state → ⓘ)* |

Labels also need casing: `Verbatim turns` → `Verbatim Turns`.

The four Messages-view field hints (Recap / Now / Recall / Direction) are 25–45 words each. They are genuinely explanatory and sit in an advanced authoring surface. **Proposal: they keep long bodies but move to ⓘ, with a ≤12-word description above.** Flag if you'd rather exempt the Prompts tab from R2 entirely.

---

## 6. Copy — Data

### Saves

| Label | Before | After |
|---|---|---|
| Autosave | *(4 sentences, ~50 words)* | Saves after every turn to a per-world Autosave slot. |

Everything else moves to ⓘ: *never touches manual saves · appears in Load with an "Auto" tag · starts once the opening scene finishes.* This is the single worst R2 violation in the modal and the clearest demonstration of why the rule exists.

### Storage

| Label | Before | After |
|---|---|---|
| Restore Default Worlds | `Restore default worlds` | Title Case. Dynamic count line kept below. |
| Clear Cached Images | `Clear cached images` | Title Case. Dynamic size line kept below. |
| Reset Tutorials | `Reset tutorials` | Title Case. Dynamic count line kept below. |

Their dynamic status lines (`You haven't deleted any of the bundled worlds.` etc.) are feedback, not descriptions — exempt from R2, kept verbatim.

### ConfirmDialog titles

Five of fifteen are sentence case. All become Title Case:

| Before | After |
|---|---|
| `Reset size & spacing` | `Reset Size & Spacing` |
| `Restore default worlds` | `Restore Default Worlds` |
| `Clear cached images` | `Clear Cached Images` |
| `Reset tutorials` | `Reset Tutorials` |
| `Reset {f.label}` | *(already correct — label is Title Case)* |

Dialog **bodies** are sentences and stay sentence case with full punctuation. Their lengths vary legitimately (a destructive action deserves its explanation) — **ConfirmDialog bodies are exempt from R2**, subject only to R4 on the title.

---

## 7. The copy module

New file: `src/components/modals/settingsCopy.ts`

```ts
export type SettingCopy = {
  label: string;
  description: string;      // R1, R2, R3
  info?: string;            // R5 — markdown, only cost/tradeoff/mechanism
  experimental?: true;      // R6
};

export const SETTINGS_COPY = {
  memorySummaries: { … },
  semanticMemory: { …, experimental: true },
  …
} as const satisfies Record<string, SettingCopy>;
```

**In scope:** setting rows, section headers, ConfirmDialog titles and bodies, button labels inside the modal.
**Out of scope:** `LlmSetupGuide`, `ImageSetupGuide` (multi-paragraph tutorials with a different job), dynamic status lines, toasts.

Call sites read from the module; no user-facing string literals remain in `SettingsModal.tsx` or `LocalModelPanel.tsx` for in-scope surfaces.

---

## 8. The guard test

`src/components/modals/settingsCopy.test.ts` — walks `SETTINGS_COPY` and asserts:

| Assert | Rule | Notes |
|---|---|---|
| `description` is non-empty | R1 | |
| `description` ends with `.` | R2 | |
| `description` word count ≤ 12 | R2 | split on whitespace |
| `description` contains exactly one sentence | R2 | no interior `. ` |
| `label` is Title Case | R4 | allowlist of tokens that stay lowercase (`a`, `an`, `and`, `the`, `to`, `of`, `in`, `for`, `with`) and tokens that keep their own casing (`AI`, `URL`, `GPU`, `VRAM`, `Top-p`, `Top-k`, `Min-p`, `W × H`, `CFG`) |
| `description` starts with a third-person verb | R3 | heuristic: first word ends in `s` and is not in a small stopword set. **Advisory — flag if this proves too noisy to keep.** |
| ConfirmDialog `title` is Title Case | R4 | bodies exempt |
| no `description` starts with `Experimental` | R6 | |

**The test must fail on today's copy before any rewriting.** Write it first, capture the failure count, then sweep to green. That failure list *is* the work item; "feels consistent" never becomes the acceptance criterion.

The Title Case allowlist is the one place this can turn into busywork — if it grows past ~15 entries, downgrade R4's automation to a lint-by-review rule and say so.

---

## 9. Type tightening and cross-references

| Change | File |
|---|---|
| `SettingsTabId` union exported from `settingsTabs.ts`; `initialTab`, `requestSettings`, `setSettingsTab` all typed to it | `settingsTabs.ts`, `SettingsContext.tsx:1096`, `useSettingsOpenRequest.ts:9`, `SettingsModal.tsx:443` |
| `requestSettings('endpoints', 'img-endpoint')` — now compile-checked | `GenerateImageButton.tsx:230` |
| `setSettingsTab('endpoints')` — now compile-checked | `MainMenu.tsx:1472` |
| `DEV_MODAL_TABS.settings` updated; existing drift guard in `devRouter.test.ts:64` keeps them in sync | `devRoutes.ts:36` |
| e2e specs referencing `tab: 'prompts'` | `e2e/app.ts:58`, `e2e/focus-ring.spec.ts:111`, `e2e/prompt-history.spec.ts:33`, `e2e/README.md:54` |
| `SettingsModal.mode.test.tsx` — asserts the exact id array and ~22 row labels by tab | `SettingsModal.mode.test.tsx:57` |

**Stale references to fix:**

| File | Currently says | Should say |
|---|---|---|
| `helpTopics.ts:136` | Settings → Generation → Describe New Characters | Settings → Output → Characters |
| `LlmSetupGuide.tsx:64` | Settings → Endpoint *(already wrong today)* | Settings → Endpoints |
| `settingsAdvancedData.ts:22-56` | tab→section comments | rewritten to the new map |
| `settingsMode.ts:4-8` | module doc naming hidden tabs | updated |
| `SettingsContext.tsx:732,834,882,897,1016` | tab→section path comments | updated |
| `docs/WorldEditor.md:334` | Settings → System Prompts | Settings → Output → Turn Extras |
| `docs/Memory.md`, `README.md` | various | audited |

`docs/Changelog.md` history is **not** rewritten. Past entries describe where things were at the time.

Simple/Advanced gating is **carried over per-row unchanged** — the same ~23 rows stay hidden, at their new addresses. `HIDDEN_SETTING_DEFAULTS` (27 fields) is untouched.

---

## 10. Proposed delivery

Four commits, all four gates green at each.

| # | Commit | Contents | Risk |
|---|---|---|---|
| 1 | **Unify Settings Row Structure** | Migrate ~20 hand-rolled grids and the 3 Image checkbox rows onto `Row`/`CheckRow`; remove the 8 spacer divs. No copy changes. | Low — visual diff only, existing tests cover labels |
| 2 | **Move Settings Copy Into One Module** | Create `settingsCopy.ts` + the guard test (failing), then sweep all copy to green. Includes the `REASONING_EFFORT_HELP` dedupe, the LocalModelPanel "applies on reload" hoist, the Autosave split, and Title Case. | Medium — ~70 strings, all test-covered |
| 3 | **Reorganize Settings Tabs** | Display/Output/Endpoints/Prompts/Data, section map, row moves, `SettingsTabId` union, call-site and e2e updates, `settingsAdvancedData` comments. | Medium — touches devRoutes, e2e, mode tests |
| 4 | **Update Docs For The New Settings Layout** | `helpTopics`, `LlmSetupGuide`, `docs/*.md`, changelog In-Progress entry (👤 for the reorg, 🛠️ for the module + guard). | Low |

Rationale for the order: structure before copy means commit 2's diff is purely textual and reviewable as prose. Reorg last means the guard test already exists to catch anything the move breaks.

Alternative if you'd rather see it land smaller: commits 1 and 2 are independently shippable — the modal is measurably more consistent after 2 even if the reorg never happens.

---

## 11. Open questions before implementation

1. **Paragraph Limit + Markdown Formatting** — Display → Narration (spec's call, they shape presentation of prose) or Output (they change what the model emits)? Genuine coin-flip.
2. **Prompts tab and R2** — the Messages-view hints are 25–45 words of real explanation in an advanced authoring surface. Enforce R2 there and push the bodies to ⓘ, or exempt the Prompts tab?
3. **LocalModelPanel's own Simple/Advanced toggle** duplicates the modal's mode switch. Out of scope, but it's a visible seam — fold, rename, or leave?
4. **R3's automated check** is a heuristic and may be more trouble than it's worth. Keep it advisory, or drop it to review-only?
5. **"Summaries" vs "Digests"** — the spec picks Summaries as the one word. Confirm.
