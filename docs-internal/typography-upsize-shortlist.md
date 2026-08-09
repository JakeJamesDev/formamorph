# Typography — where 12px may be the wrong size

The role-token sweep mapped every `text-xs` to `text-meta` (12px), which is what those sites already rendered at, so nothing moved. But `meta` means counts and timestamps, and 64 of those sites are **helper prose** — full sentences explaining something. Moving them to `text-helper` (14px) makes them visibly larger, so it is a design call.

Grouped by surface, because the decision is per-surface: one call covers a whole group. Nothing here has been changed.

| Group | Sites | Call |
| --- | --: | --- |
| Settings panel | 25 | Upsize — but as a templating fix, not 25 edits |
| First-run setup | 3 | Upsize |
| World Editor / authoring | 14 | Leave at meta |
| Desktop / local models | 7 | Leave at meta |
| Staff / admin | 8 | Leave at meta |
| World entry and in-play | 7 | Leave for now |

**Taking the two recommended groups covers 28 of the 64** and leaves the dense surfaces alone.

---

## Settings panel — 25 sites

The descriptions under each setting — read while deciding whether to turn something on. Roomy two-column layout with space to spare.

**Upsize.** The size change is cheap and doesn't wait on any refactor: every one of these spans, plus the four hint slots in [SettingsRows.tsx](src/components/SettingsRows.tsx), renders the identical pair `text-meta text-muted-foreground` — swap it for the `Hint` primitive (`text-helper text-muted-foreground`) and the group moves together.

Separately, about half the group is duplication worth collapsing: SettingsModal already routes 21 rows through `Row`/`CheckRow`, and ~11 of these hand-built rows exist only because `CheckRow` has no `info` prop for the ⓘ `HintInfo` popover their `RowLabel` carries. Give `CheckRow` an `info` slot and they fold in. The other ~9 are genuinely bespoke — inline suffix hints beside a control, and standalone paragraphs — and stay hand-written either way.

| Site | Text |
| --- | --- |
| [SettingsModal.tsx:146](src/components/modals/SettingsModal.tsx:146) | recent turns kept in full before older ones are summarized |
| [SettingsModal.tsx:318](src/components/modals/SettingsModal.tsx:318) | Global follows Settings → Generation → Native Reasoning. Only applies to models with native reasoning. |
| [SettingsModal.tsx:337](src/components/modals/SettingsModal.tsx:337) | share of Max Output Tokens the model may think for; 0% = no reasoning |
| [SettingsModal.tsx:1142](src/components/modals/SettingsModal.tsx:1142) | Recolors the whole app; applies to both light and dark. |
| [SettingsModal.tsx:1184](src/components/modals/SettingsModal.tsx:1184) | Show the location image behind the game. Off uses a blank themed background. |
| [SettingsModal.tsx:1204](src/components/modals/SettingsModal.tsx:1204) | Fades the location image toward the background color for readability. 0% shows the full image. |
| [SettingsModal.tsx:1341](src/components/modals/SettingsModal.tsx:1341) | Resolve the move before the scene is written. |
| [SettingsModal.tsx:1404](src/components/modals/SettingsModal.tsx:1404) | This model doesn&apos;t support reasoning, so there&apos;s nothing to configure. |
| [SettingsModal.tsx:1448](src/components/modals/SettingsModal.tsx:1448) | Condense older turns so long stories stay coherent. |
| [SettingsModal.tsx:1468](src/components/modals/SettingsModal.tsx:1468) | Experimental. Keep the memories most relevant to your action, not just the newest. |
| [SettingsModal.tsx:1515](src/components/modals/SettingsModal.tsx:1515) | Experimental. Recall a full past scene when your action returns to it. |
| [SettingsModal.tsx:1535](src/components/modals/SettingsModal.tsx:1535) | Experimental. Tell the AI when each memory happened. |
| [SettingsModal.tsx:1553](src/components/modals/SettingsModal.tsx:1553) | Experimental. Measure how long each turn takes instead of assuming an hour. |
| [SettingsModal.tsx:1572](src/components/modals/SettingsModal.tsx:1572) | Experimental. Activate dictionary entries by meaning, not just keywords. |
| [SettingsModal.tsx:1614](src/components/modals/SettingsModal.tsx:1614) | Write a description for each character the story invents. |
| [SettingsModal.tsx:1633](src/components/modals/SettingsModal.tsx:1633) | Characters keep diaries that shape their motivation. |
| [SettingsModal.tsx:1652](src/components/modals/SettingsModal.tsx:1652) | Experimental. Characters also recall older, relevant diary entries. |
| [SettingsModal.tsx:1695](src/components/modals/SettingsModal.tsx:1695) | Show the model&apos;s private reasoning above each turn. |
| [SettingsModal.tsx:1921](src/components/modals/SettingsModal.tsx:1921) | Shows the &ldquo;Generate with AI&rdquo; buttons. |
| [SettingsModal.tsx:1937](src/components/modals/SettingsModal.tsx:1937) | Draw every turn automatically (slower turns). |
| [SettingsModal.tsx:2157](src/components/modals/SettingsModal.tsx:2157) | The prompt sent to your text model to turn a subject’s description into booru tags. The chip expands per kind |
| [SettingsModal.tsx:2233](src/components/modals/SettingsModal.tsx:2233) | The world you&apos;re playing is pinned to this preset, so changing it here re-pins this world. Your usual pre |
| [RevealAnimationDemo.tsx:181](src/components/RevealAnimationDemo.tsx:181) | Your system’s setting is on, so and  are disabled to respect it. Fade and Blur still apply. Turn it off in you |
| [RevealAnimationDemo.tsx:275](src/components/RevealAnimationDemo.tsx:275) | In game the pace follows the model’s tokens/sec, but never goes faster than these floors. 0 = no limit. The pr |
| [ThemePreviewDialog.tsx:331](src/components/ThemePreviewDialog.tsx:331) | Live viewer — nothing is saved. Seeded from your current theme ( ); edits reset on reopen. |

## First-run setup — 3 sites

What a brand-new player reads before anything works — connect a model, wait for a download. Nearly empty screen, and the reader has no context yet.

**Upsize.** Strongest case of the six, and only three sites.

| Site | Text |
| --- | --- |
| [AiSetupGate.tsx:146](src/components/AiSetupGate.tsx:146) | You can keep browsing while this downloads — the game starts on its own once it’s ready. |
| [AiSetupGate.tsx:151](src/components/AiSetupGate.tsx:151) | Load a model in LM Studio and this continues on its own — no need to reload. |
| [AiSetupGate.tsx:155](src/components/AiSetupGate.tsx:155) | Start your server and this will continue on its own — no need to reload. |

## World Editor / authoring — 14 sites

Field hints inside the editor panels. Dense multi-column forms, and the reader is an author who has seen them before.

**Leave at meta.** Denser is correct here; 14px would push these forms taller.

| Site | Text |
| --- | --- |
| [TagsField.tsx:31](src/components/TagsField.tsx:31) | Shown on the listing in Community Creations, and what people filter by when browsing. |
| [DictionaryBookManager.tsx:42](src/managers/DictionaryBookManager.tsx:42) | . Use the + on this dictionary (left) to add one, then select an entry to edit it. |
| [DictionaryManager.tsx:65](src/managers/DictionaryManager.tsx:65) | Labels this entry in the list, and prefixes its value in the AI prompt. Falls back to the first keyword when b |
| [DictionaryManager.tsx:73](src/managers/DictionaryManager.tsx:73) | Type a keyword and press Enter to add it. Tap (or double-click) to edit, drag to reorder, click the × to remov |
| [DictionaryOverviewManager.tsx:34](src/managers/DictionaryOverviewManager.tsx:34) | Optional. A dictionary published without one gets a stand-in cover. |
| [GroupManager.tsx:46](src/managers/GroupManager.tsx:46) | (at most one trait here; picked as radio buttons) |
| [StatManager.tsx:396](src/managers/StatManager.tsx:396) | Dayparts are , , , ,  , . Code that mentions any of these variables re-runs every turn; other code only re-run |
| [StatManager.tsx:452](src/managers/StatManager.tsx:452) | Note: When code is provided, it will override the manual value setting. Leave empty to use the manual value. A |
| [TraitManager.tsx:22](src/managers/TraitManager.tsx:22) | Also set by . wins — the lower trait in the list does. |
| [TraitManager.tsx:107](src/managers/TraitManager.tsx:107) | (switchable from the Traits panel during play) |
| [TraitManager.tsx:163](src/managers/TraitManager.tsx:163) | Switches a stat on or off while this trait is active, overriding the stat&apos;s own default. A stat that is o |
| [TraitManager.tsx:210](src/managers/TraitManager.tsx:210) | Holds a placeholder at a fixed value while this trait is active. The playthrough&apos;s own roll is kept under |
| [WorldDetailsManager.tsx:83](src/managers/WorldDetailsManager.tsx:83) | Replaces the player&apos;s narration prompt while they play this world. They can decline it from the world&apo |
| [WorldDetailsManager.tsx:89](src/managers/WorldDetailsManager.tsx:89) | This world uses whichever narration prompt the player has set. Turn this on to write your own. |

## Desktop / local models — 7 sites

Model-folder and voice panels — desktop-only, and sat beside VRAM readouts and download rows that are meta by nature.

**Leave at meta.** Mixing 14px prose into a status panel reads as inconsistent.

| Site | Text |
| --- | --- |
| [TTSModal.tsx:342](src/components/game/TTSModal.tsx:342) | Applies to newly generated audio — use the regenerate button (↻) to re-speak the current text. |
| [TTSModal.tsx:353](src/components/game/TTSModal.tsx:353) | Start speaking each sentence as soon as it finishes streaming, instead of after the whole story. Lower latency |
| [TTSModal.tsx:366](src/components/game/TTSModal.tsx:366) | Highlight the sentence being narrated and follow the playhead when you scrub. Falls back gracefully on browser |
| [LocalModelModal.tsx:315](src/components/modals/LocalModelModal.tsx:315) | That folder isn&apos;t available right now — downloads are paused until it&apos;s back or you choose another. |
| [LocalModelModal.tsx:320](src/components/modals/LocalModelModal.tsx:320) | Models live outside the app folder now, so copying the app folder won&apos;t bring them along. The default is |
| [LocalModelModal.tsx:377](src/components/modals/LocalModelModal.tsx:377) | That folder isn&apos;t available right now — its models are hidden until it&apos;s back. |
| [LocalModelPanel.tsx:225](src/components/modals/LocalModelPanel.tsx:225) | The model didn’t fit in VRAM at these settings. Lower  , then reload. |

## Staff / admin — 8 sites

Moderation and feedback surfaces. Never seen by a player, and sit above dense tables.

**Leave at meta.** Lowest value per edit.

| Site | Text |
| --- | --- |
| [FeedbackDialog.tsx:190](src/components/menu/FeedbackDialog.tsx:190) | Picked up where you left off — this was still unsent. Discard it below to start fresh. |
| [FeedbackEditDialog.tsx:161](src/components/menu/FeedbackEditDialog.tsx:161) | Moving this to a sets its status back to Open . Its replies and votes stay. |
| [FeedbackList.tsx:125](src/components/menu/FeedbackList.tsx:125) | This page is incomplete — the server returned fewer rows than were asked for. Filter by a single status to see |
| [MessageComposerDialog.tsx:267](src/components/menu/MessageComposerDialog.tsx:267) | Re-badges everyone, restarts the read count, and returns it to anyone who dismissed it. |
| [MessagesTab.tsx:142](src/components/menu/MessagesTab.tsx:142) | Showing of . Dismiss one and the next appears. |
| [PoliciesTab.tsx:71](src/components/menu/PoliciesTab.tsx:71) | Off keeps the wording saved without showing it to anyone. |
| [PoliciesTab.tsx:120](src/components/menu/PoliciesTab.tsx:120) | Matched whole and ignoring case, so catches but not — list each wording you mean. |
| [PoliciesTab.tsx:136](src/components/menu/PoliciesTab.tsx:136) | For a real change to the terms. A typo fix should leave this off. |

## World entry and in-play — 7 sites

Setup screens on the way into a world, plus a couple of in-play modals. Mixed bag with no shared shape.

**Leave for now.** Too few and too scattered to be worth a pass of its own.

| Site | Text |
| --- | --- |
| [MemoryManagerModal.tsx:198](src/components/modals/MemoryManagerModal.tsx:198) | Memory Summaries are off, so the story isn&apos;t building its own memories — but anything you write here stil |
| [PresetShareDialogs.tsx:114](src/components/modals/PresetShareDialogs.tsx:114) | Include the preset&apos;s tuning (per-prompt samplers, reasoning, and verbatim turns). Uncheck to import the p |
| [PresetShareDialogs.tsx:120](src/components/modals/PresetShareDialogs.tsx:120) | A preset named “ ” already exists. Overwrite it — otherwise a separate copy is added. |
| [UtilityComponents.tsx:383](src/lib/UtilityComponents.tsx:383) | This Discord link will stop working. Re-upload the image or use a permanent host. |
| [CharacterSelectionModal.tsx:57](src/views/CharacterSelectionModal.tsx:57) | Pick characters from your library to bring into this playthrough. They join your starting location. |
| [DictionarySelectionModal.tsx:147](src/views/DictionarySelectionModal.tsx:147) | Enable, disable, and reorder the dictionaries for this playthrough. Order sets injection order; world dictiona |
| [StartingLocationModal.tsx:48](src/views/StartingLocationModal.tsx:48) | Begin somewhere random among the starting locations for this world. |
