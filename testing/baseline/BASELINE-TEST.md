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
| `## Where The Player Can Go` (Profile C only; the location-router request's context) | `Far Bank`, `The Common Green` — Sedge Landing's scoped destination set, **not** the full world list |
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
Thinking **off** · markdown **off** · choices / **location-change** on · **location auto-apply** on · stats /
summaries / diaries **off**. Auto-apply matters: moves land **without** the "Move to X?" click, so the scripted
run actually walks into the hamlet (the harness can't confirm a dialog).
Exercises the nested **Sedge Hamlet** region: Wren climbs up from the landing, notices the ferryman's sister
in her cottage *across* the green (a reachable sibling, not present), invites her out, **earns her trust so she
gives her name** — which is what unlocks the bring-them-over join — then crosses to the eelhouse.

> ⚠️ **The join is name-gated by design.** `selectReachableVisitors` only pulls Wick into the scene once the
> narration *names* her — and name discipline forbids naming her until she trusts Wren. So the script spends a
> turn (4) introducing Wren and a turn (5) earning her name; only then can she join. Before that she's correctly
> *reachable-but-offstage*. If a faithful model keeps withholding her name past turn 5, C4/C6 simply stay
> unexercised that run — a model call, not a bug.

> ⚠️ **Auto-apply cascades.** A wrong router call now *physically moves* Wren, so a false teleport on a
> look/invite turn corrupts every probe after it. Grade **turn by turn** and note the *first* divergence
> rather than the whole run pass/fail.

> ⚠️ **The router reads the ACTION, not the narration.** The `locationChange` request's user message is just
> the player's action line — so the script's action phrasings *are* the router's entire input. The moves (T2,
> T7) use deliberately non-standard verbs ("make my way into", "wander over to"), and T3/T4/T6 name a live
> destination while not moving there — the router must still get every call right.

**Per-turn ledger** — grade each turn's router decision and the resulting Current Location in the *next* turn's AI-context:

| Turn | Action | Router should output | Current Location after | Roster state |
|---|---|---|---|---|
| 1 | `START GAME` | `NONE` | Sedge Landing | reachable `N/A` (top-level) |
| 2 | `I heave my pack up and make my way up the winding path into the common green.` | **The Common Green** → auto-move *(varied verb)* | The Common Green | reachable = Ferryman's Cottage + The Eelhouse; **Wick** in reachable roster |
| 3 | `I set my pack down by the well and study the low blue-doored cottage across the way…` | `NONE` *(names cottage, only observing)* | The Common Green | Wick still reachable/offstage, unnamed |
| 4 | `I cup my hands, call toward the cottage naming myself as Wren the mapmaker, and ask whoever keeps it to step out…` | `NONE` *(invite; player doesn't move)* | The Common Green | Wick may emerge as *"the ferryman's sister"*, unnamed → not yet joined |
| 5 | `I draw water from the well and offer it to her… gently ask what name she'd have me call her by.` | `NONE` | The Common Green | trust earned → she gives **"Wick"** → named in narration → **join fires** |
| 6 | `I ask her whether the path down to the eelhouse floods at high water…` | `NONE` **← false-positive trap (names "the eelhouse")** | The Common Green | Wick **present** (may-appear-here), **dropped** from reachable |
| 7 | `I take my leave of her and wander over to the eelhouse to look the eel-racks over.` | **The Eelhouse** → auto-move *(varied verb)* | The Eelhouse | Wick **left at the green**; reachable = The Common Green + Ferryman's Cottage |

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
Grade at the Common Green (turn 2 on), against the per-turn ledger above. These test the sub-location/reachability feature specifically.

| # | Probe | What correct looks like | A failure implicates |
|---|-------|-------------------------|----------------------|
| C0 | **Scoped auto-move** | the router outputs a name **only** on turns 2 & 7 (real moves) and `NONE` on 1, 3–6; each move auto-applies so the *next* turn's `## Current Location` advances per the ledger | Prompt (router scope) / Engine (auto-apply) / Model |
| C7 | **Named-not-moved & varied verbs** | router reads the **action** only: T6 outputs `NONE` even though "the eelhouse" is named (talk-about ≠ move); T2 & T7 still fire despite non-standard verbs ("make my way into", "wander over to"). Expect this to be **consistent across both runs** — the action input is fixed | Prompt (router) / Model |
| C1 | **Reachable awareness** | at the green, AI-context `## Reachable Locations` lists **Ferryman's Cottage** + **The Eelhouse**; the reachable-entity roster shows **Wick** (summary). Narration treats her as *in the cottage*, not present | Engine (nesting) / Model |
| C2 | **No false teleport** | on the look/invite/talk turns (3–6) the router returns `NONE` — Wick is never written standing on the green before she's invited out, and Wren never auto-moves into the cottage | Model / Prompt (router scope) |
| C3 | **Name discipline (until trust)** | "the ferryman's sister" / "the one in the cottage", **not** "Wick", through turns 3–4 — even though the reachable roster carries her authored name. Naming her is only allowed once trust is earned (turn 5) | Prompt / Model |
| C4 | **Trust → join** | once she's named (turn 5's trust beat), the **next** turn's AI-context lists Wick under `## Characters and things that may appear in this location` (present) and **drops** her from the reachable roster; narration has her out on the green | Engine (visitor) / Model |
| C5 | **Shibboleth fidelity** | Wick: **silver eyetooth**, constant **humming**. Cottage: **blue door**, three-legged cat **Sixpence**. Green: well-rope coiled **widdershins**. Eelhouse: door-tally resets at **new moon** | Model (ignored context) |
| C6 | **Visit-anchoring** | after the turn-7 auto-move to the eelhouse, Wick is **left at the green** — not present at the eelhouse; the reachable roster becomes green + cottage | Engine (visit anchor) / Model |

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
  Profile C's hamlet populates them).
- The **location-change router** is now scoped: instead of a flat *Available Locations* list of every place,
  it feeds only **Where The Player Can Go** = the current location's connections + sub-locations + reachable siblings
  (the `<DESTINATIONS>` chip), and its reply is matched against *only* that set. From Sedge Landing that's
  `Far Bank, The Common Green`; from The Common Green it's `Sedge Landing, Ferryman's Cottage, The Eelhouse`.
  With **auto-apply** on (Profile C), an in-scope move is applied immediately and logged; with it off, the
  "Move to X?" confirmation is shown as before.
- `<NOTES>` (player notes) starts empty → renders `N/A`. That's expected; it's a clean path, not a fault.
- A `list`-type stat is deliberately **absent** — it currently renders broken in the prompt (a separate,
  tracked engine bug). Don't add one to this world.
- This world is SFW by design, to keep tone/moderation from confounding the diagnosis. An adult-register variant
  can be authored separately if the app's real register needs exercising.
