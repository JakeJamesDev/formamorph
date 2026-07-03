# Baseline Prompt Test — "Sedge Landing"

A fork-local diagnostic harness for the Formamorph prompt pipeline. The world
[`sedge-landing.json`](./sedge-landing.json) is built so **the world is never the variable**: every fact is
unique, non-overlapping, and often a deliberate *shibboleth* — an invented or counter-intuitive detail the model
can only get right by actually reading the context. So any bad output pins to the **model** or the **prompt**.

> 🎯 **How to use:** import the world, pick a profile, run the fixed script on both reference models, export the
> AI-context dump, and grade each turn against the rubric. Fixed settings + a constant script make two runs
> directly comparable — so a prompt change can be A/B'd model-by-model.

---

## Setup

1. **Import** — MainMenu → upload `sedge-landing.json`. The trait screen shows **Wren the Mapmaker** and
   **Footsore** pre-checked; leave both and Start.
2. **Models** — run on both reference tiers: **Rocinante 12B** (average small tier) and **Cydonia 24B** (high
   tier). A prompt that holds on both spans most players.
3. **Capture** — after the run, export the AI-context dump (the same JSON the earlier Futanari dumps came from)
   and grade against the table below.

### Sanity check (turn 1 AI-context) — proves the world loaded right

| Section | Expected |
|---|---|
| `## Player Stats` | `Vigor: Drained`, `Resolve: Unshakable` — never raw numbers *(Drained proves Footsore's −15 applied; base 23 alone would read "Winded")* |
| `## Traits` | the Wren identity line, then a **Condition** group header + Footsore line |
| `## Current Location` | Sedge Landing, incl. a `connections: Far Bank, The Common Green` line and the gloamwater text |
| `## Sublocations` / `## Reachable Locations` | both **`N/A`** — Sedge Landing is top-level with no children or siblings |
| `## Characters and things that may appear in this location` | Bram, Odette, Rope Ferry (each with a `type:` line) — **not** Wren, **not** Tomas |
| `## Relevant Information` | **gloamwater** only (tollow-knot must NOT appear yet) |

If any of these is wrong, it's a world/engine issue — stop and fix before grading model output.

---

## Profiles & scripts

Run the **same script text every time** so runs are comparable.

### Profile A — narration-only (primary)
Thinking **off** · markdown **off** · choices / stats / location / summaries / diaries **off** · paragraph
limit **3** · English. Stays at Sedge Landing.

1. `START GAME`
2. `I read the notices nailed to the leaning post.`
3. `I ask the ferryman to take me across before dark.`
4. `I tie my usual tollow-knot in the mooring rope while I wait.`
5. `I heave my pack onto the ferry and grip the tar-black rope.`
6. `I glance at the eel-smoker and ask if she's crossing too.`
7. `I tell them both my name is Wren.`

### Profile B — full pipeline (variant)
Markdown **on** · choices / stats / **location-change** on · thinking **staged**. Same first 5 turns, then cross:

- 6b. `I pull hand over hand across the gloamwater to the far bank.`
- 7b. `I raise my empty hands and tell the watchman I'm only a mapmaker.`

Profile B is where `aiSummary`, `connections`, the staged director/character passes, and probes **15–16** get
exercised. After 6b the current location should flip to **Far Bank** and the roster should surface **Tomas**.

### Profile C — sub-location reachability (variant)
Thinking **off** · markdown **off** · choices / **location-change** on · stats / summaries / diaries **off**.
Exercises the nested **Sedge Hamlet** region: Wren climbs up from the landing, notices the ferryman's sister
in her cottage *across* the green (a reachable sibling, not present), invites her out, speaks with her, then
crosses to the eelhouse.

1. `START GAME` — at Sedge Landing (reachable = `N/A`).
2. `I climb the path up from the landing to the common green.` — moves to **The Common Green**; from here the
   reachable roster appears (siblings **Ferryman's Cottage** + **The Eelhouse** under Sedge Hamlet).
3. `I stop by the well and look toward the low blue-doored cottage, wondering who keeps it.`
4. `I call across the green toward the cottage, asking whoever is inside to come out and speak with me.`
5. `I ask her whether the ferry still runs after dark.`
6. `I leave her at the well and walk over to the eelhouse to look at the eel-racks.`

---

## Rubric

Grade each probe **pass / partial / fail** per turn, per model. The last column says where to look when it fails.

| # | Probe | What correct looks like | A failure implicates |
|---|-------|-------------------------|----------------------|
| 1 | **Opening turn** | ends on a concrete image / line of dialogue; no "What do you want to do?", no options | Prompt (turn-1 cue) / Model |
| 2 | **2nd person, present** | "You step onto the dock…" — never "I"/past tense | Model |
| 3 | **Prose format** | A: no `**`/`*`/lists · B: sparse, earned emphasis only | Model / Prompt (MARKDOWN axis) |
| 4 | **Name discipline (present)** | "the one-armed ferryman" / "the ferryman", *not* "Bram", until he says it | Prompt / Model |
| 5 | **World-fact fidelity** | Bram has **one** arm; any iron rusts **pale blue**; ferry lists **left** | Model (ignored context) |
| 6 | **Stat coloring — low** | Drained Vigor reads as strain heaving the pack / gripping the rope | Prompt / Model |
| 7 | **Stat coloring — high** | Unshakable Resolve reads as composure despite the strain | Prompt / Model |
| 8 | **No stat tabulation** | never prints "Vigor: 8/100" or a stat change | Model |
| 9 | **Dictionary always-on** | gloamwater used per the authored meaning (silent, milk-pale), not invented | Model / Prompt |
| 10 | **Dictionary conditional** | tollow-knot entry appears in AI-context **turn 4 only** | Engine sanity + Model use |
| 11 | **Object not personified** | the Rope Ferry is set-dressing — it never acts or speaks | Model |
| 12 | **Advancement, not repetition** | each turn moves; no verbatim re-narration of a prior beat | Prompt (repetition work) / Model |
| 13 | **Trait group + statChange** | `<TRAITS>` shows Condition→Footsore; Vigor renders **Drained** | World-load / Engine |
| 14 | **Name reveal timing** | after turn 7 (Wren names self), NPCs may reciprocate per the trust rule | Model / Prompt |
| 15 | **Arriving stranger (B)** | crossing surfaces Tomas as "the one-eyed watchman", name withheld | Prompt / Model |
| 16 | **Location grounding + connections (B)** | narration honors Far Bank facts; Far Bank ⇄ Sedge Landing exits respected | Model |

### Profile C — reachability probes
Grade at the Common Green (turn 2 on). These test the sub-location/reachability feature specifically.

| # | Probe | What correct looks like | A failure implicates |
|---|-------|-------------------------|----------------------|
| C1 | **Reachable awareness** | at the green, AI-context `## Reachable Locations` lists **Ferryman's Cottage** + **The Eelhouse**; the reachable-location roster shows **Wick** (summary). Narration treats her as *in the cottage*, not present | Engine (nesting) / Model |
| C2 | **No false teleport** | before the invite (turn 3), Wick is **not** written standing on the green — she's offstage in the cottage | Model / Prompt |
| C3 | **Name discipline (reachable)** | "the ferryman's sister" / "the one in the cottage", **not** "Wick", until trust — even though the reachable roster carries her authored name | Prompt / Model |
| C4 | **Invite → join** | after turn 4, the next turn's AI-context lists Wick under `## Characters and things that may appear in this location` (present) and **drops** her from the reachable roster; narration has her come out | Engine (visitor) / Model |
| C5 | **Shibboleth fidelity** | Wick: **silver eyetooth**, constant **humming**. Cottage: **blue door**, three-legged cat **Sixpence**. Green: well-rope coiled **widdershins**. Eelhouse: door-tally resets at **new moon** | Model (ignored context) |
| C6 | **Visit-anchoring** | after turn 6 (move to the eelhouse) Wick is **left at the green** — not present at the eelhouse; the reachable roster becomes green + cottage | Engine (visit anchor) / Model |

### The zero-overlap check (probe 5, at a glance)
Each character owns a **unique** pair of marks — if any bleeds onto another, the model isn't reading the roster:

| Character | Only these marks |
|---|---|
| Bram | one arm (right), brass ear-ring |
| Odette | burn scar (right cheek), green glass bead |
| Tomas | milky **left** eye, fishing spear |
| Wick | silver eyetooth, constant humming *(reachable in the cottage — Profile C)* |
| Wren (player) | silver hair, ink-stained hands, two missing **left** fingers, cannot swim |

---

## Notes
- The default prompts now carry **Sublocations**, **Reachable Locations**, and two matching entity sections.
  All profiles' dumps show them; for the flat Sedge Landing / Far Bank parts they render **`N/A`** (only
  Profile C's hamlet populates them). Profile B's location-change `Available Locations` list now also includes
  the hamlet places (Sedge Hamlet, The Common Green, Ferryman's Cottage, The Eelhouse) — expected.
- `<NOTES>` (player notes) starts empty → renders `N/A`. That's expected; it's a clean path, not a fault.
- A `list`-type stat is deliberately **absent** — it currently renders broken in the prompt (a separate,
  tracked engine bug). Don't add one to this world.
- This world is SFW by design, to keep tone/moderation from confounding the diagnosis. An adult-register variant
  can be authored separately if the app's real register needs exercising.
