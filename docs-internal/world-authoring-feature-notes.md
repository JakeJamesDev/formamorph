# What Authoring A Showcase World Taught Us

Notes from rebuilding **Centaur Breeder** into a reference world (see `worlds-wip/Centaur Breeder — rework plan.md`). Everything here is friction hit while authoring, not speculation. A real play session confirmed the world works — characters entered when they made sense, and the generic-mare template did its job.

---

## 1. Tracking many similar characters — the list-stat replacement

**Rejected:** list stats. The spun-off investigation found them barely implemented, incompatible with every option stats currently carry, and a dead end. Removed from the codebase 2026-08-05; evidence and migration in [list-stat-removal.md](docs-internal/list-stat-removal.md).

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
| ~~**Chips in `aliases`**~~ | ~~A wildcard-named character can't have aliases that track her rolled name~~ | ✅ **Shipped 2.10.0** — names, aliases and dictionary keywords all resolve chips |
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
- Orphaned entity references, an entity name colliding with a wildcard value pool, and placeholder chips proposed for fields the resolver didn't scan *(aliases, at the time — they resolve now; stat descriptions still don't)*.

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
| **Which fields resolve chips** | The scanned set is real but undiscoverable ([GameViewer.tsx:1418](../src/views/GameViewer.tsx:1418)). **Stat descriptions** are still not scanned; nothing says so. Aliases and names now are |

---

## 5. Suggested order

1. **Activation tester** — unlocks confident authoring of the two systems that are currently guesswork
2. **World Doctor lint** — catches the exact class of bug that survived into a finished world twice

   *Items 1–2 (plus location/start inspectors) are now one specced feature — the Test Bench, `.scratch/test-bench/spec.md`.*
3. **`connections` editor field** — smallest of the dead features, data already renders
4. **Per-entity runtime fields** (§1) — the real answer to the herd problem; needs a version decision first
5. **Trait-gated content** — the one structural gap the world genuinely wanted

> 📌 **Revised after the second world (§7–§9).** The order still holds, with two changes: **trait-gated content moves up** — two worlds have now worked around it — and **"which AI call sees which field" (§9)** slots in beside the Doctor, since it prevents the same class of error rather than reporting it.

---

## 6. Authoring lessons worth keeping

- **Only demonstrate what an author can reproduce in the editor.** A feature reachable solely by hand-editing JSON teaches a dead end.
- **Spatial relationships go in prose.** `parentId` is editor-only and `connections` is unreachable, so the AI's map is whatever the descriptions say.
- **Aliases collide with each other across entities**, and matching is case-sensitive, so a title needs every casing narration writes. *(They do take chips — that shipped in 2.10.0.)*
- **Guards where they're honest.** `noIncrease`/`noDecrease` belong on derived stats only; putting them everywhere teaches the wrong habit.

---

# Second world — Fantasy Futanari

Notes from the **Fantasy Futanari** pass (see `worlds-wip/Fantasy Futanari — rework plan.md`). A different shape of world: not a minimal one being built out, but a large, already-well-authored one — 24 entities, 24 locations, existing stat code — brought up to the current feature set. Nothing here is unverified; every item is something that actually bit.

## 7. What the second world confirmed

Three items from §3/§4 hit again, independently, which is the argument for building them:

- **Trait-gated content** — the genitalia group is meaningless unless you picked Futanari. Worked around with a "Human Genitalia" default trait, the same shape as Centaur Breeder's locked-door cover story. **This is now the twice-wanted feature, and it wants to extend to traits, not just locations and entities.**
- **The Doctor's alias rules** — 14 `the `-prefixed aliases there; here, every alias needed hand-written case variants and one still matched nothing. Same rule class, second world.
- **Entities in zero locations / locations with no entities** — seven empty rooms here, several of which had random events written for a cast that could never be present.

## 8. New wants

| Want | Concrete case | Rough shape |
|---|---|---|
| **Random events as a real feature** | The largest gap. This world hand-authored weighted per-location events (*"Mak'gora (Uncommon - 20%)"*) — but the AI cannot roll, so the percentages were decoration. Rebuilt as a stat with a `Math.random()` roll and four descriptor bands, with the events relabeled to match. It works, and it is entirely a workaround | `location.events[]` carrying weight + text; the engine rolls and injects only the one that fired |
| **Stat code can see the character** | Fertility's `code` recovers toward a hardcoded number, which healed away every race's Fertility penalty within two turns. Fixing it meant encoding each race's resting value in `max` and computing `max * 0.25` — legible only to whoever wrote it | expose the active trait ids/names to the sandbox |
| **Draw without replacement** | Three `Unique` chips from one pool repeat ~30% of the time — two "unique" district trees sharing a name. Forcing distinctness cost **27 placeholders instead of 9**, one disjoint sub-pool per chip slot | a `distinct` mode, or "same placeholder, different placement ⇒ never repeat" |
| **Case-insensitive aliases** | Every alias was authored 2–3 times for casing, and all the variants then render into the prompt as noise (`also known as: orcs, Orcs`) | a per-alias or per-world toggle |
| **A stat that runs every turn** | The Weave must reroll each turn, but stat code only runs when the AI reported a stat change unless *something* reads the clock. The fix is to reference `elapsedHours` in a roll that doesn't otherwise need it | an explicit `runEveryTurn` flag, so the clock reference isn't load-bearing trivia |

## 9. The editor tweak that outranks the rest

**Show which AI call sees which field.** Not a lint — a legend in the editor.

Most of this pass's mistakes trace to one root: nothing tells the author that `aiDescription` reaches the **narrator only**, that `aiSummary` is what the choice writer, continuity planner and location router get, that `playerDescription` reaches nobody, and — the sharp edge — that **filling in a summary redirects four of the six AI calls away from the full description**.

That last one caused a real regression here: adding summaries to every location silently hid the random-event tables from the planner and the choice writer. It was invisible until the behavior was traced by hand.

§4.3 already asks for a "which fields resolve chips" indicator. This is the same request one level up, and it's worth more.

## 10. Lessons worth keeping

- **Read `docs/` before reverse-engineering `src/`.** Two things this pass "discovered" were already documented correctly: the stat-code run schedule ([StatCodeGuide.md](../docs/StatCodeGuide.md)) and the starting-location table ([WorldEditor.md](../docs/WorldEditor.md)).
- **A `max` delta moves the value; don't pair it with a `starting` delta.** Raising a full stat's ceiling fills it, lowering one below the value clamps it — so pairing double-counts.
- **Writing an `aiSummary` is a behavior change**, not just a context saving.
- **Verify intent against the engine, not against the design.** The pass that checked *"does the world work the way it's written"* found more than any section's own verification did — an entire subsystem that would have silently never run.
- **Measure voice against the author's own text in the same field**, not against a style memo. Their trait descriptions open uncontracted; their entity descriptions run 0.40 uncontracted-per-contraction. Both are conventions, and only measurement told them apart from drift.
