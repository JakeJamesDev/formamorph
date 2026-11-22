# Spec: Quote Speaker Data

Status: ready-for-agent
Spec session: quote-speaker-data — spec

Fix the most common wrong quote speakers in Character Mentions, and make player contributions carry enough data to train and measure on. Spans both repos: the Formamorph client and FormamorphServer. Builds on the closed Character Mentions spec (`docs-internal/specs/character-mentions/`) and amends its Q36.

## Problem Statement

Players who contribute corrections mostly fix quote speakers. In the two review batches of 2026-11-20 and 2026-11-21, 135 of 145 contributions held only quote corrections (321 in all). Three things go wrong:

- **The speaker is wrong or missing.** A replay of the client's rules over those 321 corrections shows the speech-verb rule usually finds the right mention ("she says"), but its cluster has no name. The cluster holds only descriptors ("the Alpha", "the supervisor") in 73 cases, or a name outside the cast in 64. Only 14 are true pronoun-only splits. When no rule names a speaker, the quote keeps the default color, even when the paragraph makes the speaker plain.
- **The contribution teaches the model nothing.** The coref export skips quote corrections (Q36). A quote-only row therefore exports the model's own clusters for a passage the player just showed is wrong, and that output goes into `train`. Staff must review every such row, and the right decision is always to reject it.
- **Staff and replays can't see what the player saw.** A contribution does not say which entity is the player (99 of 145 rows could not tell), holds no cast aliases or stranger names, and does not record the speaker the client showed or the rule that picked it. An offline replay matched the client's cluster names in only 102 of 141 rows.

## Solution

1. **Learned speaker names.** When a player corrects a quote's speaker, and the mention that names the speaker ("the Alpha says") sits in a cluster the reading left unnamed, the playthrough learns that this head word means that entity. Later turns name unnamed clusters through it. Measured on the 321 corrections: 89 more right, none lost.
2. **Safer fallbacks.** When the rules would leave a quote with no speaker, four fallbacks try to name one from the same paragraph. They never replace a speaker a rule already found. Measured: 56 more right, none lost, 17 quotes go from no speaker to a wrong one. With 1: 125 of 315 wrong quotes fixed.
3. **No raw output as gold.** The export leaves out a row that changes no coref label. Staff can see those rows at a glance and clear them in bulk. The rows stay stored for a later quote-speaker set.
4. **Complete contributions.** A contribution also stores the player id, a snapshot of the scene's cast, every quote's shown speaker with the rule and mentions behind it, and the client and rules versions.
5. **Quote corrections become coref labels.** When the player names a quote's speaker, the export also labels the quote's speech-tag subject and the speaker's own "I/me/my" inside the quote as that entity. Staff see these labels apart from the player's own.

## User Stories

1. As a player, I want a quote's color to match its speaker when the narrator calls them by a title like "the Alpha", so that I can follow who speaks.
2. As a player, I want my speaker fix on one turn to carry to later turns that use the same title, so that I don't fix the same mistake every turn.
3. As a player, I want a learned title to name only clusters the reading left unnamed, so that my fix never overrides a name the reading found itself.
4. As a player, I want a title I gave to two different speakers to stop being used, so that an ambiguous title doesn't color quotes wrongly.
5. As a player, I want an undo to remove what a corrected turn taught, so that undoing a turn leaves no trace of it.
6. As a player, I want an unmet stranger learned through a title to still show under its stranger label, so that my speaker fix never reveals a true name.
7. As a player, I want a quote with no speech tag to take the speaker of the quote before it in the same paragraph, so that a speaker's run of lines keeps one color.
8. As a player, I want a quote whose own "I" belongs to a named character to take that character as speaker, so that self-reference counts.
9. As a player, I want a quote tagged with a bare "she" in an unnamed cluster to take the last named character the paragraph is about, so that common prose still gets a color.
10. As a player, I want the fallbacks to apply only when no rule found a speaker, so that quotes that are right today stay right.
11. As a player, I want character discovery to ignore these fallbacks, so that a guessed speaker never adds a character.
12. As a contributing player, I want my contribution to record what the app showed me, so that staff judge my fix against what I saw.
13. As a contributing player, I want the quotes I left alone to count as confirmed, so that my silence is useful data too.
14. As a contributing player, I want my speaker fixes to improve the model, so that contributing quote fixes is worth doing.
15. As a contributing player, I want contributions from older app versions to keep working, so that an update never makes a send fail.
16. As a staff reviewer, I want to see which entity is the player in each contribution, so that I can read "you" and "I" correctly.
17. As a staff reviewer, I want to see the cast's aliases and stranger names, so that I understand how clusters got their names.
18. As a staff reviewer, I want each quote correction to show the speaker the player saw and the rule that picked it, so that I know what was fixed.
19. As a staff reviewer, I want rows that change no coref label marked as such, so that I can clear them without reading each passage.
20. As a staff reviewer, I want to reject all no-change rows in one action, so that a large batch from one player doesn't cost an hour.
21. As a staff reviewer, I want labels derived from quote fixes shown apart from the player's own mention fixes, so that I can judge each kind on its own.
22. As a staff reviewer, I want no derived labels for a group entity, so that one person's line never labels a group.
23. As a staff reviewer, I want a player's explicit mention fix to win over a derived label on the same span, so that the player's direct answer counts most.
24. As a maintainer retraining the models, I want the export to hold no row that is raw model output, so that training never learns the model's own mistakes.
25. As a maintainer, I want derived labels in the export, so that quote fixes add coref signal where the model fails most.
26. As a maintainer, I want to replay stored contributions offline with exactly the client's inputs, so that I can measure a speaker-rule change on real data before shipping it.
27. As a maintainer, I want each contribution to name the client and rules versions, so that I can tell which rules produced the shown speakers.
28. As a maintainer, I want rows from before this change to read as having none of the new fields, so that old rows still export and display.
29. As a maintainer, I want the server to bound every new field, so that a malformed or huge send is refused like any other.
30. As a maintainer, I want quote-only rows kept in storage, so that a later quote-speaker set can use them.

## Implementation Decisions

**Learned speaker names (client, reading).**
- A learned name maps a head word to an entity id for one playthrough. The head word is the lowercased last word of the speaker mention, past any possessive, for example "alpha" from "the massive black-furred Alpha". A capitalized name outside the cast is learned whole, lowercased.
- A learned name comes from a quote correction whose quote's speaker mention (the speech-tag subject, or the beat opener) sits in a cluster the reading left unnamed. Pronouns and player words are never learned.
- A head word that two entities claim is dropped for that playthrough.
- Learned names are derived from the save's corrections, turn by turn, not stored separately. An undo removes them with the turn.
- Reading takes the learned names as an extra input. They name only a cluster the cast vote left unnamed and the player rule did not claim, and only when the cluster holds the head word. They never change a cluster the vote named.
- The reading's mentions carry entity ids only, so the stranger display rules apply unchanged.

**Fallbacks (client, quote speakers).** Each runs only when the speech-verb, beat and nearest-subject rules leave a quote with no speaker. None runs in the speech-verb-only mode that the discovery gate uses (Q73).
- The quote's own first-person mentions sit in a named cluster: that entity.
- An earlier quote in the same paragraph has a speaker: that speaker. Never across paragraphs: the measurement found 70 new errors when the carry crossed them.
- The tag, beat or subject mention is an unnamed he, she or her: the last named, non-player clause subject before the quote in the paragraph.
- Nearest subject skips unnamed pronouns to the last named subject.
- The ticket fixes the order of the four by measuring them against the fixture set.

**Contribution body (client) and submission (server).** New optional fields, all bounded and validated like today's:
- `playerId`: the persona's entity id, or null.
- `cast`: one record per cast entity the reading used, the persona included: id, name, aliases, stranger name and kind. Names are placeholder-resolved, as `entityNames` is today (Q71).
- `quotes`: one record per quote the reading attributed: span, shown speaker (id or null), the rule that fired (`after-subject-verb`, `after-verb-subject`, `before-verb`, `beat`, `nearest-subject`, one of the fallbacks, or `none`), the span of the mention the rule used, and the spans of the quote's own first-person mentions. A quote with no correction counts as confirmed.
- `clientVersion` and `readingVersion`. `readingVersion` is a constant in the reading module, raised when the speaker or naming rules change.
- The server stores each field in a new nullable column. A row without them reads as absent, and the export treats it as today's row.
- **Wire shape** (ticket 04 ruling):
  - `cast`: `[{ id, name, aliases: string[], strangerName: string | null, kind: 'unique' | 'generic' | null }]`. The kind is the world's entity kind; the persona sends null.
  - `quotes`: `[{ start, end, speakerId: string | null, rule: string, mention: { start, end } | null, firstPerson: { start, end }[] }]`. `mention` is null when no rule found a mention.
  - In the client's reading, a quote keeps `speaker` and gains `rule`, `mention` and `firstPerson` (ticket 01 ruling). `firstPerson` comes from scanning the quote's own text for word-bounded I, me, my, mine and myself, whether or not a cluster holds them. `mention` is the mention at the rule's subject span when one exists, even when the rule fired through a player word or the mention's entity is null; else null. `readingVersion` starts at 1.
  - `rule` is a bounded lowercase-kebab string (`^[a-z-]{1,40}$`), not a closed list, so a client with newer rules never has its send refused. Known names: `after-subject-verb`, `after-verb-subject`, `before-verb`, `beat`, `nearest-subject`, `none`, and ticket 02's fallbacks `own-first-person`, `earlier-quote`, `pronoun-subject`, `named-subject`.
  - `clientVersion` is a string of at most 64 characters. `readingVersion` is a positive integer.
  - Bounds: at most 200 cast records, 20 aliases per record, 500 quotes and 50 first-person spans per quote. Names and aliases use the 200-character name bound.
  - The server checks span validity only. It does not require a speaker or id to appear in `cast`, and it does not refuse overlapping quote spans.
  - A resend that replaces a pending row replaces it whole (Q35), so fields it omits become absent.
- **Known gap:** kind tells a Generic entity from a Unique one, but not a Unique entity that the author wrote as a group ("the Gatekeepers"). The export's group exclusion covers Generic entities only; a Unique group stays a known source of wrong derived labels.

**Export (server).**
- A **derived label** is a mention label the export makes from a quote correction. It needs the row's `quotes` and `cast`. For a quote correction naming an entity whose kind is an individual character:
  - the rule's mention becomes a label for that entity, when the rule is one of the three speech-verb rules;
  - each of the quote's own first-person mentions becomes a label for that entity.
  - Beat openers and fallback mentions make no label. Player words make a label only when the entity is the player.
- A quote correction naming a group or generic entity, or null, makes no derived label.
- Derived labels apply like mention corrections (Q35), before the player's own corrections. A player's mention or non-mention correction on an overlapping span wins (Q38).
- **One exception to Q35, for derived labels only** (ticket 06 ruling): when the derived span's cluster is unnamed (`clusterEntities` null), the whole cluster joins the entity's clusters instead of the span moving out alone. Moving only the span would pull "she" out of the right cluster ("the Alpha", "her", "she") and strand it as a singleton. A cluster that holds player words and other mentions (Q67's mixed cluster) is the exception to the exception: only the span moves. The mixed test reads the model's cluster. An unnamed cluster that derived labels claim for two or more entities is named by none: each span moves alone, so the result never depends on quote order.
- **Matching** (ticket 06 ruling): a quote correction joins its `quotes` record by exact span; no match gives no label; for several corrections on one span, the last counts. "Individual character" means an entity in `cast` with kind `unique`, or `playerId`. Server-side player words follow the client's `playerForm` test; the quote's own first-person spans are the speaker's words and skip that test.
- A row is **exportable** when its final clusters differ from the model's clusters (ticket 06 ruling). A derived label that changes nothing does not make a row exportable, so raw model output never exports. The export skips any other row, even when accepted.
- **Queue and routes** (ticket 06 ruling): each queue row carries `changesLabels` and `derivedLabels: [{ start, end, entityId, wholeCluster }]`, listing only labels the export applies; `wholeCluster` is true when the label named its whole unnamed cluster, so staff review can say so. The count route adds `noChange` beside `pending`. A staff `POST` route rejects every pending no-change row and returns the count it rejected.
- Q36 is amended: quote corrections now feed the coref export through derived labels. They also stay stored for a later quote-speaker set.

**Staff review (client admin, server queue).**
- The queue marks each row "changes labels" or "no label change", using the exportable rule above.
- Staff can reject every no-change row in the pending queue in one action, with a count shown first.
- A row's detail shows derived labels apart from the player's corrections, and each quote correction's shown speaker and rule.

## Testing Decisions

- Tests check behavior at the three agreed seams, never internal helpers.
  1. **Reading:** cast, clusters, scene and learned names go in; mentions, cluster entities and quote speakers come out. It covers learned names (learning, the unique rule, never overriding a vote, strangers by id) and each fallback (fires only when no rule spoke, never in speech-verb-only mode, never across paragraphs). Prior art: the client's `mentionReading.test.ts` and `mentionReading.gold.test.ts`.
  2. **Contribution body:** a turn goes in; the body comes out with `playerId`, `cast`, `quotes` and versions, and leaves out names the server would refuse. Prior art: `correctionContribution.test.tsx`.
  3. **Server submit and export:** a submitted body goes in through the route; stored fields and the export's lines come out. It covers bounds, old rows without the fields, derived labels (speech-verb only, first person, group exclusion, player fix wins) and skipping non-exportable rows. Prior art: the server's `tests/corefContributions.test.js`.
- **Fixture set:** passages that reproduce each measured error class: a descriptor-only speaker cluster, a name outside the cast, an untagged second quote, a first-person quote, a bare tagged "she" in an unnamed cluster. Passages are written for the tests or taken from the user's own saves. Never use contributed player text.
- Each new guard gets a mutation check: break it and confirm a test fails.

## Out of Scope

- Offering to save a learned name as an entity alias, or creating a new character from a speaker fix.
- A typed name for the "Not listed" choice in the correction picker.
- A separate group-entity rule for coref labels beyond excluding groups from derived labels.
- Dialogue alternation for untagged quotes, and carrying a speaker across paragraphs. Both were measured and rejected.
- Retraining the models, and the training focus on "you" merged with she/he. Both run after this lands.
- Exporting the stored quote-speaker set.

## Further Notes

- The measurements come from a replay of 321 real quote corrections with an instrumented copy of the reading code. The data is narrow: one contributor made 299 of the corrections, and 112 came from one world whose two uncast guards are labeled as a group. Treat the numbers as direction, not as a target.
- The replay's numbers count a changed speaker on the 600 uncorrected quotes as a break, on the reading that a player who left a quote alone accepted it.
- Rows already in the queue lack the new fields. They export only through their mention corrections, as today.
