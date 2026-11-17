# 09: Rename Rewrites Scripts

Status: ready-for-human
Blocked by: 04, 08
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Renaming a Media Entry rewrites the scripts that name it, as a stat rename does (Q4).

- A rename from the picker slot or the Media tab rewrites every script assignment and comparison that names the old name, using the existing rename machinery.
- The drift check flags a script that names a missing entry.

## Acceptance criteria

- [x] Renaming an entry rewrites `entities.X.image = "<old>"` to the new name in world scripts, stat code and item scripts. Verified: `statCodeRename.media.test.ts` "rewrites an assignment in a world script, a World Tool, a stat and a trait…" and "…an entity’s own stat"; `MediaPicker.test.tsx` "offers to rewrite the script, and Update Code moves the media literal alone". Item scripts: see Not verified.
- [x] A script naming a missing entry shows in the drift check with the name. Verified: `rules.test.ts` "flags a name the list lacks, once, naming it".
- [x] A string that only happens to match the name outside a media assignment is left alone. Verified: `statCodeRename.media.test.ts` "leaves a matching string outside a media assignment or comparison alone" (fails with the root and shadow filter removed).

## Landed

**Not verified**
- Item scripts: the stat rename's code boxes (world scripts, World Tools, stats, traits, entity-own stats, link overrides) hold no item scripts, so none is rewritten. An item's Item Instance `image` write in any of those boxes is rewritten.
- Nothing in the running app. The offer and the Test Bench row are covered by component and rule tests only.

**For you**
- Rename an entry a script names in the picker slot: the Update Code References dialog says `image “Old” 1 time`. Update Code rewrites the literal; Leave Code leaves it, and the Test Bench Issues list then flags the old name.
- Write `entities.X.image = "Typo"` in a stat script and open Issues in Advanced mode: a warning row names “Typo” and the script.
- Notes: a script that reads a media member through its own variable (`for (const g of entities.G.instances) g.image = "A"`) is not rewritten or flagged, since only the sandbox globals prove the member is a media one.
