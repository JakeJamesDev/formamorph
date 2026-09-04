# Spec — discovering narrator-invented characters without an AI call

Status: done

Item 4c of [long-session-recall-findings](long-session-recall-findings.md).
**✅ SHIPPED.** Implementation: [characterCandidates.ts](src/lib/characterCandidates.ts) +
`GameViewer` wiring + the settings split + the entity-panel delete flow. This document is the
design record; the code is the source of truth.

**Validated against both real sessions at implementation time, with the progressive known-set the
app actually uses: recall 1.00 / precision 1.00 on each.** The fragment false positives predicted
below (`Chen`, `Wolfram`, `Rainsley`) are absorbed exactly as designed once the full name is known.

## Final rule set and measured precision

The prototype below is the *starting* point. Everything after it came from running four real authored
worlds through both model tiers — 36 sessions, 900 turns — via
[`character-discovery-probe.mjs`](testing/baseline/harness/character-discovery-probe.mjs), scoring with
[`disc-aggregate.mjs`](testing/baseline/harness/disc-aggregate.mjs), and re-scoring saved transcripts
after each rule change with [`disc-rescore.mjs`](testing/baseline/harness/disc-rescore.mjs) (seconds,
no model time).

| corpus | sessions | promotions | real | precision |
|---|---|---|---|---|
| tuning (seeds 7, 21) | 16 | 9 | 9 | 1.00 |
| held-out #1 (seeds 42, 99) | 12 | 9 | 9 | 1.00 |
| held-out #2 (seeds 123, 777) | 8 | 5 | 5 | 1.00 |

Before the last two rules the held-out sets read 0.90 and 0.71 — the overfit gradient was real and
visible, which is the reason to keep re-running held-out seeds rather than trusting the tuning number.

**Rules added after the prototype, each traced to a measured failure:**

| rule | what it fixed |
|---|---|
| hyphens stay in a token | `Demi-Human` split and leaked a bare `Human` |
| only `'s` may ride in a token | `I'm Doctor` matched as one run; rejecting it swallowed the title and left a bare `Vance` |
| abbreviated titles normalized | the model writes `Dr. Vance`; the period faked a sentence end AND `dr` wasn't a title |
| abbreviations expanded to full form | `Dr. Chen` and `Doctor Chen` became two entities |
| up to three tokens per run | `Doctor Evelyn Rainsley` truncated to a name matching nobody |
| surname collision, **people only** | that full name became a second `Professor Rainsley`; scoping it to characters avoided barring anything ending `office`/`demi-human`/`studio`/`skill` |
| non-prose lines dropped | `**Professor Assignments:**` promoted as a titled character |
| lone short all-caps rejected | `12:00 PM` promoted `PM` |
| bracketed spans dropped | `Welcome to Praetoria Academy, [Player Name]` |
| greeting stopwords | `"Hey"` shouted across a street, twice |
| leading stopwords shed, not fatal | `And Alice said…` discarded the whole run — 1.33% of all runs |
| **person signal required on repetition** | two thirds of repetition-path promotions were agencies, cafés, shows, weekdays, places |
| `madame`; third-person naming | `her name is Madame Yuki` — a producer with 13 mentions, missed |
| contraction stems dropped | `Don't` left a bare `Don` |
| **must appear outside quoted speech** | an absent library patron (`"Ms Drake hasn't arrived yet"`) and a child's stuffed toy (`"Mr Rabbit approves of you"`) |

**Known blind spot:** quoted signage is treated as dialogue, so a name that appears only as
`a plaque reads "…"` needs a prose mention elsewhere. Cost nothing across 36 sessions, but it is a
real limitation rather than a solved case.

**Tier asymmetry:** the cloud endpoint promoted **nothing** across 8 sessions / 200 turns, and that
is correct — it writes characters as "she" and "the woman in the white coat" and never names them.
Every precision number above is therefore a Cydonia measurement.

## The problem in one line

A character the narrator invents can never be discovered, because discovery requires already having
been discovered.

`turnParticipants` is built from three sources ([GameViewer.tsx](src/views/GameViewer.tsx)):

| source | matches |
|---|---|
| `findEntityNames(narration, allEntities)` | **already-known** entities only |
| `matchNamesLoose(narration, directorCandidates)` | staged planning only |
| `matchNames(narration, adHocCandidates)` | staged planning only |

On pure narration (no staged planning) the last two are empty and the first can't match an unknown
name. So a new character never becomes a participant → never reaches `selectDueDiscovery` → never
becomes an entity → never becomes known.

**Measured cost in the real session:** Doctor Chen speaks on **23 of 50 turns** and is invisible to
the system on every one — absent from the presence list, the `## Characters` block, the choices
filter, and participation-based recall. Professor Krafft appears only because she is authored.

## Goal

Narrator-invented characters become first-class entities on pure narration, with **no additional
per-turn AI request and no new request for anyone who has not opted in**.

## Where it plugs in

One new pure function, `extractCharacterCandidates(narration, context)`, feeding the **existing**
pipeline at exactly one point — a fourth source for `turnParticipants`:

```
findEntityNames(...)  ∪  matchNamesLoose(...)  ∪  matchNames(...)  ∪  extractCharacterCandidates(...)
                                                                     └─ new, pure, no network
```

Everything downstream is untouched: `selectDueDiscovery` → describe → `discoveredEntities` already
works and is already tested. Deliberately the smallest possible incision.

## Algorithm

Applied to the committed narration text, per turn. Ordered — each step feeds the next.

**1. Segment into sentences.** Split on `.!?` plus optional closing quote/markdown, and on newlines.
Sentence position is the strongest signal and is lost if you skip this.

**2. Extract capitalized runs.** A token starting `[A-Z]`, optionally joined to following
capitalized tokens, allowing internal `of/de/van/von`.

**3. Reject contractions.** A token ending `'d 'll 'm 've 're 't` is not a name. Kills
`I'd / I'll / I'm / I've`.

**4. Strip possessives.** Trailing `'s` → the bare name, so `Sarah's` folds into `Sarah` rather than
becoming a second character. A *merge*, not a rejection.

**5. Drop stopwords.** A closed list of pronouns, articles, conjunctions, modals, common sentence
openers, and speech verbs. Rejects a run whose first word is a stopword, or all of whose words are.

**5b. Drop bare kinship terms.** `Mom`, `Dad`, `Sis`, `Grandma`, `Mother`, `Father`, … used *alone*
are forms of address, not names. Found in the second validation sample, where `Mom` appears **23
times** and was promoted — she is in fact Dean Wolfram, already known under her own name.
`Sister`/`Mother`/`Father` stay in the **titles** list, so `Sister Agnes` still qualifies. Bare
kinship word → reject; kinship word + name → title path.

**6. Drop already-known terms.** Excluded:
- authored entity names and already-discovered entity names;
- **every location name in the world**, not just the current one and its neighbors;
- dictionary entry names and keywords;
- **trait names and stat names**;
- **placeholder / wildcard values** (author-defined Variables and Wildcards, whose resolved values
  are often capitalized proper nouns);
- the player's own name;
- the suppression list (see deletion flow).

**7. Score and qualify.** Two ways to pass:
- **Titled:** first word is a known title (`Dean`, `Professor`, `Doctor`, `Captain`, `Sister`, …)
  and there is at least one more word. A title plus a name is a character on sight.
- **Mid-sentence use:** the name appears **not sentence-initially at least twice**, accumulated
  across turns. This is what separates `Sarah` (59% sentence-initial) from `But` (100%).

The threshold is a **named constant in the lib**, not a user setting — same treatment as
`RELEVANCE_HALF_LIFE_TURNS` ("tuning needs probe evidence, not a player knob"). Its comment carries
the measurement behind it.

Step 7's accumulation needs **no new persisted state** — `selectDueDiscovery` already rescans
history on each idle tick, so evidence is recomputed from the transcript.

## Measured results

Two samples, both from the Praetoria session (`aftermath.json`, `did something happen.json` — 50
turns each, 13 overlapping, ~87 distinct turns of narration).

| sample | recall | precision (raw) | false positives |
|---|---|---|---|
| 1 — `aftermath` (65k chars) | **1.00** | 0.75 | `Chen`, `Dean` |
| 2 — `did something happen` | **1.00** | 0.83 | `Wolfram` |

Every remaining false positive is a **fragment of a true name**, and `selectDueDiscovery`'s existing
`isKnown` check uses `sameCharacterName`, which exists precisely to stop this ("a variant — 'Aldric'
of 'Sergeant Aldric' — doesn't spawn a duplicate entity"). **Effective precision ≈ 1.00 on both.**

First-qualifying turn (sample 1): Professor Rainsley 0 · Sarah 2 · Professor Krafft 8 ·
Dean Wolfram 23 · Doctor Chen 26.

**Two corrections made while validating:**
- Sample 2 first read as recall 0.83 with `Doctor Chen` "missed". She appears **once** there, so the
  ≥2 threshold rejected her correctly — a single passing mention *should not* spawn an entity. The
  truth set was wrong, not the heuristic.
- Sample 2 surfaced the `Mom` failure class (step 5b), which sample 1 could not have shown.

### Validation status

Both samples are one session, one world, one narrating model — shared cast, genre, and prose style,
so not independent evidence. Still unvalidated: a large authored cast; heavily capitalized lore
nouns (the `Art History` failure at scale); a different narrating model, since capitalization habits
are model-specific; non-English or stylized capitalization.

**Plan: build now, validate before enabling.** The threshold ships as a named constant behind an
off-by-default setting, and is tuned once 2–3 exports from different worlds exist. The scorer runs
a session in under a second.

## Settings

Two separate settings — one checkbox cannot honestly govern two jobs.

| setting | storage key | visible in | governs |
|---|---|---|---|
| Character Diaries (existing) | `${APP_ID}_characterDiaries` | staged mode only — **unchanged** | diary writing + read-back |
| **Discover New Characters** (new) | `${APP_ID}_discoverCharacters` | **all thinking modes** | promoting a narration participant to a `discoveredEntity` |

`discoverNames` moves from `characterDiaries ? … : []` to `discoverCharacters ? … : []`. The
Character Diaries row keeps its `thinkingMode === 'staged'` wrapper; the new row has none.

Follows the inline `usePersistentState` pattern in `SettingsContext` (like `characterDiaries` at
line 344), **not** `settingsDefaults.ts` — so no `VITE_DEFAULT_*` twin and no `.env.local` reminder.

**Default: seeded from `characterDiaries` on first read.** A plain `false` would silently remove
discovery from staged players who have diaries on today; a plain `true` would hand everyone else a
request type they never opted into. `usePersistentState` writes its default on first mount, making
this a one-time migration with no ongoing coupling.

- Staged + diaries on → discovery keeps working, no action needed.
- Diaries off (the default, and everyone on pure narration) → discovery off, request volume
  unchanged, toggle now visible.

**Turning it off later keeps already-discovered characters.** They remain in the scene and the save;
the setting governs future discovery only. Flipping a switch never loses data.

**Row copy**, placed near Character Diaries in the Generation tab:

> Characters the story invents are remembered as real characters, so they keep their description,
> appear in the scene list, and can be spoken to later. Runs one extra request the first time each
> new character appears.

**Discovery is silent** — no toast, no log entry. The character simply appears in the entity panel,
matching current staged-path behavior.

## What it costs

- **Per-turn AI requests: zero.** Pure string work on text already in hand.
- **No new request type, and none for anyone who has not opted in.** The only AI cost is the
  existing `discoverEntity` describe call — one per newly promoted character (~5 across 87 turns).
- Runtime: one regex pass over ~1.3k chars of narration per turn. Negligible.

## The deletion flow

**None of this exists today** — there is no delete affordance for `discoveredEntities` anywhere in
the UI, verified across the entity panel and the whole `src/` tree. It **ships with the heuristic**,
not as a follow-up: accepting mis-promotion is only reasonable if the remedy exists.

What already exists to lean on:

| exists | detail |
|---|---|
| the state | `discoveredEntities: DiscoveredEntity[]` in `GameplayContext` |
| undo | part of the turn snapshot, so rollback restores it automatically — via full-snapshot restore, **not** via `sourceTurnId` |
| a provenance field | `DiscoveredEntity.sourceTurnId` — currently **written in 4 places, read in none**. Dead metadata today; the natural hook for "discovered on turn N" |
| a display surface | the `entities` tab of the game side panel (`GAME_LEFT_PANEL_TABS`) |

### Pieces

**1. Mark discovered entities in the entity panel.** The panel renders authored and discovered
entities identically, so a player cannot tell which are runtime inventions. A badge, with
`sourceTurnId` giving "discovered on turn N".

**2. A remove action on the row**, in the `entities` tab beside the badge — where the player already
sees them. Removal clears the entry from `discoveredEntities`; because that array is in the turn
snapshot, removal participates in undo for free.

**3. A confirm dialog naming the character.** Suppression makes deletion permanent, so an accidental
tap should not lose a character the story has been building.

**4. A suppression list — the load-bearing part.** Removal alone is whack-a-mole: delete
"the Grey Heron", and the next turn mentioning it twice mid-sentence re-promotes it. Deleting means
*never again*, so removal records the name and it becomes an exclusion in step 6.

**Suppression blocks both discovery paths** — the heuristic *and* staged/director-invented. Applied
once inside `selectDueDiscovery` so a single filter covers everything, and matched with
`sameCharacterName` rather than exact string, so deleting `Grey Heron` also suppresses
`The Grey Heron`.

### Save shape

> ⚠️ **Additive save-envelope field:** `suppressedCharacterNames: string[]`. A deletion that forgets
> itself on reload is not a deletion, so it has to persist.

**No version bump, no migration.** The field is optional; absent on old saves means "nothing
suppressed", which is correct, and old builds ignore it. Same precedent as the dictionary keyword
arrays. Flagged here per hard constraint #2 and to be called out in the changelog.

### Deliberately out of scope

- Deleting *authored* entities — those belong to the world, not the playthrough.
- Undo beyond normal turn rollback.
- Editing a discovered entity's description — the existing entity editor's job.
- **Prior turns are left untouched.** A deleted character stays in the `entities` recorded on turns
  that already happened, so participation recall and the presence list on those turns are unchanged.
  Rewriting committed history is the larger and riskier change, and could desync the digest and
  milestone layers built on top of it.

## Known limitation — location may be wrong

A discovered character is attached to the current location, and item 4 showed the current location
can be stale for long stretches (Doctor Chen would attach to "Dean Wolfram's office" while the scene
is in the medical wing). **Accepted as-is** — the same behavior the staged path already has. The
character exists and is reachable; only its location tag may be wrong. Fixing it belongs with item
4a's location tracking, not here.

## Follow-ups (not scheduled)

### A. Author-defined titles per world

`TITLES` is 21 hand-written entries and **only 3 are exercised by any evidence we have** — measured
over both sessions (129k chars of narration): `professor` 179 uses, `dean` 52, `doctor` 33, and
**zero** for the other 18. The list was written from general knowledge, not derived from a corpus,
and it reflects a modern-academy register because that is the world it was built against. A
fantasy, military, or institutional world gets no benefit: `Warden Bex` was observed waiting a turn
for repetition because `warden` isn't listed.

A per-world authored field ("titles used in this world": `warden`, `arch-magus`, `overseer`) would
let the author fix this for their own setting, which no global list can.

> ⚠️ That would be an **additive world-export shape change**, not a save change — the field belongs
> to the authored world. Needs the usual approval.

Cheaper interim option: expand the global list deliberately from real register lists (military,
clergy, nobility, medical, law enforcement). Still unvalidated, just longer — and a title only
fires when followed by a capitalized word, so the risk is low either way.

### B. Characters named once, late, in their own dialogue

The case: the player writes "I speak with the old man", and the narration ends
`"I'm Bran, by the way."` — one mention, so it never reaches the mid-sentence threshold of 2 and
`Bran` is not discovered.

**No evidence base for this in the current corpus.** Self-introduction patterns were measured
across both sessions and are essentially absent: `I'm X` 1 hit in 129k chars, and `I am X`,
`My name is X`, `call me X`, `This is X` all **zero**. Every character in these worlds arrived
either authored or title-introduced. So any rule here is reasoning, not measurement, and wants a
session where it actually happens before it ships.

Two candidate mechanisms, recorded for when that evidence exists:

1. **Self-introduction as a qualify-on-sight path**, alongside the title rule — `"I'm X"`,
   `"My name is X"`, `"call me X"`. Scope it to **quoted speech only** (34% of narration in these
   sessions): inside quotes, first person is an NPC naming themselves; outside quotes it is the
   player character, and treating that as a new entity would be badly wrong.
2. **The player's action as corroborating evidence, never as sole proof.** Today extraction reads
   narration only. If the player writes "I ask Bran about the road", they have adopted the name,
   which is a deliberate signal the narrator's prose can't match. The safe shape: the name must
   appear in narration at least once (provenance), and action uses may supply the *second*
   occurrence. That catches Bran on the very next turn without letting a player conjure entities by
   typing capitalized words, and without the extractor having to interpret `[bracketed]` author
   directions or place names.

Worth weighing against doing nothing: the miss is self-limiting. A character who matters gets
mentioned again, and repetition is exactly what the threshold detects — so the cost of missing a
genuinely one-off NPC is small, while lowering the threshold to 1 would collapse precision across
the board.

## Test plan

- Unit tests on `extractCharacterCandidates` using real strings from these sessions as fixtures:
  contraction, possessive, sentence-initial stopword, bare kinship term, title+name, player name,
  dictionary term, trait name, placeholder value.
- A guard test per rejection rule proving its removal reproduces a known false positive — per the
  project's "guards must bite" bar.
- A regression fixture asserting `Doctor Chen` is found and `Art History` is not.
- Suppression: a deleted name is not re-promoted on a later turn, via either discovery path.
- Setting: `discoverCharacters` off → `discoverNames` empty → no describe request.
- No probe run needed — nothing here touches prompt text or the model.


## Anatomical possessives carry alone (2026-07-26)

`qualifiesAsCharacter` gained a third path: `titled || bodied || (mid >= 2 && person)`.

**Why.** `mid` ignores sentence-initial occurrences — the guard that stops "But"/"That" becoming
characters. A character whose name opens every sentence it appears in therefore scores `mid: 0` forever:

> Lyria's hand is warm and firm as it closes around yours. […] Lyria glances back at you with a playful smile.

She speaks four times, is touched, and sits down — and never qualified. `person` was already true (the
possessive check set it); only the repetition bar blocked her.

**Why it's safe.** `PERSON_POSSESSIVE` is a tight body/expression list (eyes, hands, voice, face, hair,
smile, shoulders, lips, gaze, fingers, arms, head, expression, cheeks, brow, chin, throat). Nothing but a
person owns one. Place and object possessives — "Timbermaw's border", "the Inn's roof", "Teldorill's
markets" — don't match, and are covered by tests. Sentence-initial function words never reach the check:
`That's`/`There's`/`It's` have stopword heads and are rejected a branch earlier.

**Measured** across 47 distinct recorded sessions (one per playthrough; the semQ/freeze families are the
same session re-run and were deduped): **+2 names, both genuine characters** (Sable, Pell — authored
NPCs in the gate world), **0 demotions, 0 false positives** out of 416 sentence-initial possessives seen.

A weaker variant was measured and rejected: counting a sentence-initial possessive toward `mid` promotes
only 1 name and does **not** fix the reported case, since one possessive still leaves `mid` at 1.

**Caveat on the evidence.** The recorded sessions are harness runs in test worlds with authored casts, so
`findEntityNames` catches those characters anyway and the narrator-invented path barely fires. The change
rests on the reasoning above; the dumps establish it does no harm, not that it fixes the field reports.
A real playthrough export where a character went undiscovered would still be worth running through
`collectCandidateEvidence` to confirm `mid` was the blocker.
