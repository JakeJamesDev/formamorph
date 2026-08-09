# World Doctor — Spec

Companion to [world-authoring-feature-notes.md](world-authoring-feature-notes.md) and [activation-tester-spec.md](activation-tester-spec.md), which shares its dock.

---

## 1. The problem

**A world can be wrong in ways the editor renders as perfectly fine.**

Every field is filled in, every panel looks complete, and the world is broken anyway — because the defects live in *relationships between items*, not in any one item. An author reviewing the Entities tab cannot see that an alias collides with a different entity's alias. An author on the Stats tab cannot see that a stat is disabled and no trait ever switches it on.

Rebuilding **Centaur Breeder** produced a world we twice considered finished. Two manual sweeps then found:

| Defect | Why no panel showed it |
|---|---|
| 14 aliases beginning with "the" — silently missing at sentence start | The alias field looks correct; the rule lives in the matcher |
| Bramble undetectable by her own alias, beaten by another entity's plural | Aliases are authored per-entity; the collision is cross-entity |
| Farm Visitors present in **zero** locations — could never appear | Locations own the entity list; the entity has no back-reference |
| *Mares Bred* starting at 1 while its active descriptor read "No mares carrying yet" | Descriptors are a list; nothing marks which one is live at start |
| The legacy `isStartLocation` field, dead since the TS rebuild, with **no** location flagged `isStarting` | The dead field renders nowhere, so its absence renders nowhere |

Both sweeps were Node scripts written for the occasion. Every finding was **mechanical** — a rule a machine can hold. None required judgment about prose.

That's the case for this feature: the checks are cheap, the bugs are real, and they survived to a "done" world twice.

---

## 2. What it does

A continuously-updating list of findings about the world as a whole, grouped by severity, each one **clickable to the item it's about** and — where the fix is unambiguous — repairable in one click.

It is a *linter*, not a critic. It never comments on writing quality, tone, or content. Every rule is one an author would agree with instantly once shown.

---

## 3. Placement

**A second tab in the editor dock**, beside the Activation Tester, with a **badge in the editor header** carrying the current error/warning counts.

The badge is the real surface. An author who never opens the panel still sees `⚠ 3` appear the moment they create a problem, which is most of the value.

Findings are recomputed on world change (debounced). Everything except stat-code execution is pure object inspection over an already-in-memory world — cheap enough to run on every keystroke without ceremony.

### 3.1 Downloaded worlds

**It runs on every world, including downloaded ones.** Downloading someone's world as inspiration and editing it into something new is an encouraged path in a community app, so a downloaded world is a *starting point*, not a read-only artifact — and its findings are exactly as actionable as any other world's.

Two consequences for the wording, since findings about downloaded content are read differently:

- **Findings describe the copy, never the author.** "This alias won't match at the start of a sentence", not "the author made a mistake". No rule should read as a review of somebody's work — a real risk when the panel is looking at a stranger's world.
- **Quick fixes are edits like any other**, so applying one sets the world `dirty` and diverges it from its source, exactly as hand-editing does. The panel needs no special case; it should simply not surprise anyone, so the first quick fix on a never-edited download is worth a one-line note that it will mark the copy as edited.

A useful side effect: an author learning from a downloaded world gets the same structural feedback the original author had, which makes the Doctor a teaching surface as much as a linter. Dismissals stay local and keyed by world id, so they survive a re-download of the same listing.

---

## 4. The rules

Severity model:

- **Error** — this cannot work. Something will never fire, never resolve, or points at nothing.
- **Warning** — this works but is very likely not what was meant.
- **Info** — completeness and consistency; safe to ignore deliberately.

### Entities

| Sev | Rule | Found in the real world? |
|---|---|---|
| ⚠ | Alias begins with `the ` — case-sensitive matching makes it miss at sentence start | **Yes — 14 of them** |
| ⚠ | Two entities can match the same text (alias/name overlap, accounting for plural tolerance) | **Yes — Bramble vs Farm Visitors** |
| ⚠ | Entity appears in **zero** locations | **Yes — Farm Visitors** |
| ℹ | Lowercase multi-word alias with no capitalized twin — case-sensitive matching misses the form narration usually writes (`matron of Teldorill`) | **Yes — matched nothing until fixed** |
| ⚠ | Entity name collides with a value in a Wildcard's pool — a rolled generic can shadow a real character | Checked manually for Bramble and Cass |
| ℹ | Alias duplicates the entity's own name (redundant) | **Yes — Sarah** |
| ℹ | No `playerDescription` or no `aiDescription` | **Yes — two inherited entities** |
| ℹ | Long `aiDescription` with no `aiSummary` | |

### Locations

| Sev | Rule | |
|---|---|---|
| ✖ | `entities[]` references an entity id that doesn't exist | |
| ✖ | `parentId` references a location that doesn't exist | |
| ✖ | **No location is flagged `isStarting`** | **Yes — after the legacy field was ignored** |
| ⚠ | Legacy `isStartLocation` present (dead since the TS rebuild) | **Yes** |
| ℹ | Location with no entities | **Yes — seven of them, including rooms whose own events needed a cast** |
| ℹ | Location or entity has an `aiSummary`, so only the narrator sees its full description — everything else is sent the summary | **Yes — adding summaries hid the event tables from the planner and choice writer** |

### Stats

| Sev | Rule | |
|---|---|---|
| ✖ | `code` references a stat name that doesn't exist — a silent break on any rename | *Mares In Season* depends on this |
| ✖ | `code` throws, times out, or returns a non-number when executed | |
| ✖ | `starting` outside `[min, max]` | |
| ⚠ | Stat is `enabled: false` and **no trait's `statToggles` ever switches it on** — invisible forever | |
| ⚠ | No descriptor covers the starting value's band, or the active-at-start descriptor is the `@0` one while `starting > 0` | **Yes — Mares Bred** |
| ⚠ | Duplicate or unordered descriptor thresholds | |
| ⚠ | `percentage` stat whose `min`/`max` aren't 0/100 | |
| ⚠ | **A stat has `code` but no stat in the world reads a clock variable** — code then runs only on turns the AI reported a stat change, so a "every turn" stat silently doesn't | **Yes — a pregnancy timer stalled and a per-turn roll held its value** |
| ⚠ | A trait's negative `starting` delta lands on a stat already sitting at its floor — the clamp swallows it | **Yes — a race's Virility penalty vanished** |
| ⚠ | A trait sets a stat below a value the stat's own `code` raises it back to — the trait's effect erases itself within a turn or two | **Yes — five of nine race Fertility values were fiction** |
| ℹ | AI-change locks on a stat with no `code` (usually a misunderstanding) | |

### Traits

| Sev | Rule | |
|---|---|---|
| ✖ | `statToggles` references a missing stat id | |
| ✖ | `placeholderPins` references a missing placeholder, **or a value not in that placeholder's list** | Silent no-op if wrong |
| ⚠ | Exclusive group with two or more `isDefault` traits | |
| ℹ | Exclusive group containing fewer than two traits | |

### Placeholders

| Sev | Rule | |
|---|---|---|
| ✖ | A chip in world text references an undefined placeholder id | |
| ✖ | A chip sits in a field the resolver never scans — **stat descriptions and descriptors**. Names, aliases and dictionary keywords resolve since 2.10.0 ([the scanned set](../src/views/GameViewer.tsx:1418)) | |
| ⚠ | Several `Unique` chips share one placeholder with few values — independent draws repeat (3 chips over 10 values ≈ 30% of the time) | **Yes — two "unique" towns shared a name** |
| ⚠ | `weights` names a value that isn't in `values` | |
| ℹ | Placeholder defined but never used in any text | |
| ℹ | Wildcard with a single value (it's a Variable) | |

### Dictionary

| Sev | Rule | |
|---|---|---|
| ✖ | Entry has no keywords and isn't `constant` — it can never fire | |
| ✖ | `secondaryKeys` with no primary keywords | |
| ✖ | `useRegex` entry whose pattern doesn't compile | |
| ⚠ | Keyword is a substring of another entry's keyword while whole-word matching is off | |
| ℹ | Entry disabled, or its whole book is disabled | |

### World

| Sev | Rule | |
|---|---|---|
| ⚠ | Empty `systemPrompt` | |
| ℹ | No `readme` | |
| ℹ | Oversized embedded images — link to the existing **Optimize Images** action | |

---

## 5. UX

```
┌─ World Doctor ──────────── 2 ✖  5 ⚠  3 ℹ ─┐
│ [All] [Errors] [Warnings] [Info]           │
│                                            │
│ ✖ ERRORS                                   │
│  Stat code references a stat that no        │
│  longer exists: "Farm Rep"                  │
│  → Mares In Season · Stats        [Open]    │
│                                            │
│  Chip points at a deleted placeholder       │
│  → Intake Pen · Locations         [Open]    │
│                                            │
│ ⚠ WARNINGS                                  │
│  14 aliases begin with "the" — these miss   │
│  at the start of a sentence                 │
│  → Bellamy, Wisp, Poppy, +8      [Fix all]  │
│                                            │
│  Farm Visitors appears in no location       │
│  → Farm Visitors · Entities       [Open]    │
│                                            │
│ ℹ INFO ▸ (collapsed)                        │
└────────────────────────────────────────────┘
```

**Grouped by severity, not by section** — an author wants the broken things first, wherever they live.

**Every finding navigates.** Click routes to the owning tab with the item selected, using the editor's existing `activeTab` + `selectedItemId`.

**Findings collapse across items.** "14 aliases begin with the" is one row naming the affected entities, not fourteen rows. Ungroupable findings stay individual.

**Quick fixes** only where the repair is unambiguous and reversible:

| Finding | Fix |
|---|---|
| Alias begins with "the" | Strip the article — the exact fix applied by hand here |
| Alias duplicates the entity name | Remove it |
| Legacy `isStartLocation` present | Delete the field |
| Placeholder never used | Delete it |
| Orphaned entity reference in a location | Remove the reference |

Anything requiring a judgment call — which location should be `isStarting`, how to resolve an alias collision — navigates instead. **No bulk "fix everything" button**; each quick fix is its own act.

**Dismissal.** A finding can be muted per world for authors who mean it. Stored **locally, keyed by world id — never in the world**, since that would be export-shape-visible and would ship an author's suppressions to players.

**Empty state.** "No problems found" plus the count of rules checked, so a clean result reads as verified rather than as a panel that failed to load.

---

## 6. Scope

**Out:**

- **No prose or content judgment.** Not "this description is short", not tone, not spelling. Every rule is structural, or it doesn't belong.
- **No AI calls.** Fully local and instant.
- **Not a gate.** It never blocks saving, exporting, or publishing. Publishing with warnings is the author's call.
- **No auto-fix on load.** Existing worlds are diagnosed, never silently rewritten — the same reasoning as never migrating a shipped world unasked.

---

## 7. Build order

The rules are independent, so this ships incrementally. Highest evidence first — each of these caught a real bug in a world already believed finished:

1. Alias hygiene (leading article, cross-entity collision, self-duplicate)
2. Reference integrity (orphan entity refs, missing stat/placeholder ids in toggles, pins, chips, and stat code)
3. Reachability (entity in no location, disabled stat no trait enables, entry that can never fire, no starting location)
4. Stat sanity (descriptor coverage at start, threshold order, code execution)
5. Everything remaining as Info

Rules 1–3 alone would have caught every defect that survived two sweeps of this world.

---

## 8. The rule engine

**One engine, surfaced in three places.** The alias-hygiene rules are simultaneously Doctor findings and the Activation Tester's inline warnings; two implementations would drift, and the drift would be invisible until they disagreed in front of an author.

```
lib/worldRules.ts
  Rule            = { id, severity, section, check(world) → Finding[] }
  Finding         = { ruleId, severity, message, items[], fix? }
  runRules(world, opts?) → Finding[]
```

- **The Doctor** runs the full set and groups by severity.
- **The Activation Tester** runs the same set filtered to the matching-related rules (`section: 'entities' | 'dictionary'`), rendering them inline next to the thing being tested.
- **Quick fixes live on the rule**, as an optional `fix(world) → World`, so a repair offered in one surface is identical in the other.

Rules are pure functions over a `World`, which makes them trivially unit-testable — and the fixture is right here: the pre-sweep [Centaur Breeder](../worlds-wip/Centaur%20Breeder.json) states that carried real defects are the natural regression corpus. Each rule ships with the world snippet that motivated it.

---

## 9. New since last open

The badge distinguishes **new** findings from ones already seen. A world carrying three accepted infos must not look identical to one that just broke.

- On close, persist the set of finding **identities** (`ruleId` + the item ids it names) locally, keyed by world id — the same store as dismissals, and never in the world.
- On recompute, any finding whose identity isn't in that set is **new**.
- The badge shows new counts prominently and known counts muted: `⚠ 2 new · 5`. With nothing new, it stays quiet.
- New findings sort to the top of their severity group with a marker, and the panel offers **Mark all as seen**.

This is what makes the badge trustworthy enough to ignore. An author who has consciously accepted their infos sees a still badge — so when it moves, it means something, and the signal survives the long tail of deliberate warnings that would otherwise make it wallpaper.

Identity is `ruleId` + item ids specifically, so **editing an item re-raises its finding**: fixing an alias and reintroducing the same mistake is new again, while an untouched accepted warning stays quiet.

---

## 10. Resolved decisions

**Stat code — static checks live, execution on demand.** Broken stat-name references and syntax are cheap string work and run live, so the silent-rename break (rename *Farm Reputation* and *Mares In Season* stops working with no visible error) is caught immediately. Actually executing the code sits behind a **Check stat code** action in the panel, since each run spins a real QuickJS VM per stat and the badge must stay instant.

**Re-download re-raises everything.** Seen-state is keyed by world id and so survives a re-download by default — which is wrong when the listing was updated, because you now hold genuinely different content and stale "seen" marks would hide defects the update introduced. On a source update (a changed `sourceUpdatedAt`), clear the seen set for that world. A plain refresh of unchanged content leaves it alone.

## 11. Open questions

None currently. Remaining unknowns are implementation-level: how `runRules` is invoked from the editor's existing state, and whether the seen-state store shares a key namespace with dismissals.
