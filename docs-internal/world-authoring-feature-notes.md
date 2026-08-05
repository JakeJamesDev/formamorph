# What Authoring A Showcase World Taught Us

Notes from rebuilding **Centaur Breeder** into a reference world (see `worlds-wip/Centaur Breeder — rework plan.md`). Everything here is friction hit while authoring, not speculation. A real play session confirmed the world works — characters entered when they made sense, and the generic-mare template did its job.

---

## 1. Tracking many similar characters — the list-stat replacement

**Rejected:** list stats. The spun-off investigation found them barely implemented, incompatible with every option stats currently carry, and a dead end.

**Also rejected:** a general inventory system. Wrong frame — a mare is a *character*, not a possession. Modeling the herd as items imports the wrong verbs (acquire, drop, stack, count) and none of the right ones.

### The middle ground: per-entity runtime fields

The thing we want to track is state *about a character*, and the app already has characters. What's missing is a small amount of **author-defined state that lives in the save rather than the authored world**.

```
Entity (authored)          → name, descriptions, aliases…            [immutable in play]
Entity fields (authored)   → daysCarrying: number, sired: boolean    [schema only]
Entity field values        → per-entity, per-save                    [runtime]
```

**Why this shape and not another:**

- It reuses `discoveredEntities` / `runtimeCharacters.ts`, which **already persists AI-invented characters into the save**. A mare the narrator names and characterizes is already becoming a real entity — she just can't carry anything.
- It respects the immutability rule: authored worlds define the *schema*, the save holds the *values*.
- The per-turn stat pass already asks the AI to move numbers. Entity fields can ride the same pass rather than inventing a second update channel.
- It renders naturally — the entity card is already the place a player looks for "what's true about her".

**What it buys immediately:** *Mares Bred* stops being a counter the AI has to remember to increment. Stat code counts entities whose `daysCarrying` is set, which closes the loop with machinery that already ships. Gestation becomes real per-mare state instead of one aggregate number standing in for a herd.

**Scope caution.** This is export-shape-visible on both the world (field schema) and the save (values), so it needs a version decision before anything is built.

### Zero-cost fallback available today

Milestone memory and the character diary already persist facts across a session. A mare's pregnancy *can* live as a pinned memory right now. It's unstructured and can't be counted or driven by stat code — but it costs nothing and is worth knowing before building anything.

---

## 2. Finish what's already built

Three features are fully implemented with the entry point disabled. All three trace to `e608a3d`, the original upstream import — none was deliberately disabled by this project.

| Feature | Blocked by | What it cost this world |
|---|---|---|
| **Stat updates** | absent from [`WORLD_EDITOR_TABS`](../src/views/worldEditorTabs.ts) though `WorldEditor` handles the tab in both panes and `StatUpdatesManager` is complete | The "farm tick" — gestation advancing, Composure eroding unprompted |
| **Location `connections`** | renders in gameplay ([GamePanels.tsx:1340](../src/components/game/GamePanels.tsx:1340)), no field in `LocationManager` | The entire farm layout had to be encoded in prose, because the AI can't see `parentId` either |
| ~~List stats~~ | — | **Investigated and rejected**; see §1 |

`connections` is the smallest and least ambiguous of these — the data already renders.

---

## 3. Features the world wanted and couldn't have

| Want | Concrete case | Rough shape |
|---|---|---|
| **Trait-gated content** | Sarah's Office is reachable playing the breeder. Worked around by writing "the door doesn't lock" — a hook, but a cover story | `requiresTrait` on locations/entities |
| **Time-of-day availability** | Bramble "only appears at night" is *prose the AI may ignore*, not a rule | daypart gating on presence |
| **Chips in `aliases`** | A wildcard-named character can't have aliases that track her rolled name. Worked around by listing **all six possible names** as aliases | scan `aliases` like other text fields |
| **Stat-driven availability** | Bramble appearing only while Suspicion is low; tours only above a Reputation floor | threshold conditions on presence |
| **`starting` beyond numbers** | `Stat.starting` is `number`-only | widen the type |

---

## 4. Editor UX

### 4.1 Activation tester — highest value

Paste a paragraph, see which entities and dictionary entries fire, and why.

Presence matching and lorebook activation are **invisible until mid-session**. `secondaryExclude` in particular is close to impossible to author confidently blind — an inverted secondary that fires when a keyword is *absent* has no observable behavior in the editor at all.

This was built by hand five times as throwaway vitest harnesses during this rework. An author has no equivalent.

### 4.2 World Doctor — a lint pass

Nearly every defect that survived into a "finished" world was **mechanical and detectable**. Two sweeps found:

- **14 aliases beginning with "the"** — matching is case-sensitive, so they silently missed at the start of a sentence, where narration puts them constantly. Presence detection was working roughly half the time for eleven characters.
- **An alias collision that made a character undetectable by her own alias** (Bramble's `the visitor` lost to Farm Visitors' `visitors` under plural-tolerant matching).
- **An entity in zero locations** — Farm Visitors could never be present anywhere.
- **A stat whose starting value contradicted its own descriptor** — *Mares Bred* started at 1 while its active descriptor read "No mares carrying yet."
- Orphaned entity references, an entity name colliding with a wildcard value pool, and placeholder chips proposed for fields that are never scanned.

Every one of those is a rule a linter can hold. None was visible in the editor.

> **Authoring rule worth surfacing in the UI: never begin an alias with "the".** It halves the hit rate, and nothing currently says so.

### 4.3 Smaller, still real

| | |
|---|---|
| **Clock scrubbing in the stat-code tester** | *Mares In Season* was verified across 21 days externally; the tester runs a single flat hour |
| **Active-descriptor highlight** | Show which descriptor is live at the starting value — would have caught the Mares Bred contradiction instantly |
| **Placeholder preview with re-roll** | `buildPlaceholderPreview` already exists; surface it |
| **Entity coverage warning** | "Appears in 0 locations" should be visible, not discoverable by script |
| **Cross-world find/replace** | Every sweep here ran through Node; renaming the serum everywhere is manual today |
| **Context budget indicator** | 14 entities and 9 lore entries — an author has no idea what that costs per turn |
| **Which fields resolve chips** | The scanned set is real but undiscoverable ([GameViewer.tsx:1313](../src/views/GameViewer.tsx:1313)). Stat text and aliases are *not* scanned; nothing says so |

---

## 5. Suggested order

1. **Activation tester** — unlocks confident authoring of the two systems that are currently guesswork
2. **World Doctor lint** — catches the exact class of bug that survived into a finished world twice
3. **`connections` editor field** — smallest of the dead features, data already renders
4. **Per-entity runtime fields** (§1) — the real answer to the herd problem; needs a version decision first
5. **Trait-gated content** — the one structural gap the world genuinely wanted

---

## 6. Authoring lessons worth keeping

- **Only demonstrate what an author can reproduce in the editor.** A feature reachable solely by hand-editing JSON teaches a dead end.
- **Spatial relationships go in prose.** `parentId` is editor-only and `connections` is unreachable, so the AI's map is whatever the descriptions say.
- **Aliases are matched, not rendered** — so they take no chips, and they collide with each other across entities.
- **Guards where they're honest.** `noIncrease`/`noDecrease` belong on derived stats only; putting them everywhere teaches the wrong habit.
