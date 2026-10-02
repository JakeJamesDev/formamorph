# 07: Audit World-Content Selects

Status: ready-for-human
Base: 3a36f880
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Breadcrumb Picker spec](../spec.md)

## What to build

A list of every plain Select that offers world content and so falls under the Q11 rule (Q13). No code change.

- World content: stats, traits, trait groups, entities, placeholders, locations, dictionaries, and anything else an author creates in a world.
- One row per call site: the screen, what the list offers, whether it can grow long, whether it has a nesting source (folders, groups, owners), and a short note on fit.
- Add the list to this ticket under an `## Answer` heading. The user picks which ones become follow-up tickets.

## Acceptance criteria

- [ ] Every Select call site was checked. The ticket records the total and how many match.
- [ ] Each matching row names its screen and its nesting source, or "none".
- [ ] Fixed option sets (timing, daypart, theme and so on) are left out and counted, not listed.

## Answer

Checked 2026-10-02. I counted every `<SelectTrigger>` outside tests: **80 call sites in 47 files**.

- **14 match** the Q11 rule (offer world content). One of them, the Code Template slot select, is already in tickets 03–05.
- **66 don't match** and are counted, not listed: settings, endpoint and prompt presets, feedback and admin screens, community sort and filter, tool type and handler kinds, pick count, stat type, update actions, reasoning strength, VRM style, date parts, theme and design-system demos.
- No Select offers dictionaries. No Select offers trait groups on their own.

| # | Call site | Offers | Long list? | Nesting source | Fit |
| - | --------- | ------ | ---------- | -------------- | --- |
| 1 | [TraitManager.tsx:329](src/managers/TraitManager.tsx:329) Stat change | Stats | Yes | None | Search helps. Rows stay flat (story 11) |
| 2 | [TraitManager.tsx:383](src/managers/TraitManager.tsx:383) Stat toggle | Stats | Yes | None | Same as 1 |
| 3 | [LocationConnections.tsx:130](src/managers/LocationConnections.tsx:130) Connect To | Locations not yet connected | Yes | Parent location (`parentId`) | Strong. Breadcrumb shows the parent path |
| 4 | [OpeningsPanel.tsx:77](src/managers/OpeningsPanel.tsx:77) Starting Location filter | Start locations, plus an "All Locations" row | Sometimes | Parent location | Good. Needs a pinned sentinel row |
| 5 | [OpeningInstrument.tsx:251](src/components/editor/OpeningInstrument.tsx:251) Starting Location | Start locations | Sometimes | Parent location | Fair. Compact 24px trigger in a card |
| 6 | [EntityFields.tsx:279](src/managers/EntityFields.tsx:279) Starting Location | All locations, plus "Automatic" | Yes | Parent location | Strong. Needs a sentinel row |
| 7 | [OpeningInstrument.tsx:235](src/components/editor/OpeningInstrument.tsx:235) Persona | Persona entities, plus "None" | Rarely | Entity folders | Fair. Compact trigger. Short list |
| 8 | [WorldOverviewManager.tsx:143](src/managers/WorldOverviewManager.tsx:143) Starts On | Persona entities, plus "Player's Default" and "None/Custom" | Rarely | Entity folders | Fair. Sentinel rows lead the list |
| 9 | [PlaceholderPinsSection.tsx:75](src/components/editor/PlaceholderPinsSection.tsx:75) Pin Source | Pin sources of one kind: traits, locations, stat descriptors, placeholder values | Yes | Trait groups; owner stat for descriptors; placeholder for values | Strong. Row label carries a "Trait:" kind prefix to rework |
| 10 | [PlaceholderPinsSection.tsx:113](src/components/editor/PlaceholderPinsSection.tsx:113) New Pin Source | Same as 9 | Yes | Same as 9 | Strong. Move with 9 |
| 11 | [TestBench.tsx:144](src/components/editor/TestBench.tsx:144) Lens selects (two uses: persona traits, locations) | Origin traits and locations, with "Anyone" / "Nowhere" | Yes | Trait group headings today; parent location | Strong. Already groups with headings, which Q6 replaces. Compact trigger with icon |
| 12 | [ConnectReferencesModal.tsx:44](src/components/modals/ConnectReferencesModal.tsx:44) Use in This World | Library candidates for one broken reference | No (few) | None | Weak. Rows show a value line, which needs the meta hint |
| 13 | [ToolEditor.tsx:294](src/components/modals/ToolEditor.tsx:294) By Parameter | The tool's own parameter names | No | None | Keep Select. Short, one tool |
| 14 | [StatCodeTemplateDialog.tsx:212](src/components/modals/StatCodeTemplateDialog.tsx:212) Template slot | Stats, traits, entities, placeholders | Yes | All four sources | Already in tickets 03–05 |

Borderline, left out: [CharacterCustomization.tsx:121](src/views/CharacterCustomization.tsx:121) Player Avatar lists library VRM models, not world content. [ToolTryIt.tsx:45](src/components/modals/ToolTryIt.tsx:45) lists a tool's own enum values.

### Suggested groupings

Pick any. Each is one ticket.

- **Locations:** rows 3, 4, 5, 6. They share one source (location tree order with a parent path).
- **Persona entities:** rows 7, 8. They share one source and need sentinel rows.
- **Pin sources:** rows 9, 10. They share one options builder.
- **Test Bench lens:** row 11. It replaces its own group headings.
- **Stats:** rows 1, 2. Low value without groups.
- Rows 12 and 13 stay Select.

Sentinel rows ("All Locations", "Automatic", "None", "Anyone") appear in rows 4–8 and 11. The Breadcrumb Picker has no pinned-row support yet, so any of those tickets must add it first.
