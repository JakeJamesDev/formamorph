# 01: Map Shows Strangers

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

The player's map counts every unmet entity. In the player's place and every Nearby place, an unmet stranger shows under its stranger label. Everywhere else it shows as an unknown "?". An unmet entity with no label is an unknown everywhere. The badge splits into named and unknown parts. Every entity behaves as On Map: Always, because the field arrives in ticket 02.

- A pure **map roster** module replaces the met roster builder and owns the rule. Input: the presence of every cast entity, the player's place, the locations, and the Connections. Output per location id: the named entries (true names, then stranger labels) and an unknown count. Shape it so ticket 02 adds the On Map branch without changing the output.
- The reach is the existing Nearby helper, not presence's `connectedPlaces`, which includes Far.
- The game view feeds the roster the full presence record, not only the known set.
- The map badge shows the named count and the unknown count. A zero part is dropped. The tooltip lists names, then stranger labels, then one line for the unknowns. Write that copy from the Writing Guide.
- A stranger's true name never reaches the map before it is met.
- Help topics and `docs/` pages that describe the map count follow.
- Changelog fragment in `docs-internal/changelog.d/`.

Spec rulings: Q1, Q2, Q3, Q5, Q6, Q8, Q12, Q14.

## Acceptance criteria

- [x] The roster puts an unmet stranger with a label under that label in the player's place, in a place Nearby by implicit link, and in a place Nearby by a Connection with no distance. A roster test covers each. Verified: `mapRoster.test.ts` (3 cases, one per place kind).
- [x] The roster counts the same stranger as one unknown in a place reached only by a Far Connection, and in a place with no link. A roster test covers each. Verified: `mapRoster.test.ts` (Far and no-link cases).
- [x] An unmet entity with a blank Stranger Name and no alias is one unknown in every place, its own and Nearby places included. A roster test. Verified: `mapRoster.test.ts` (blank Stranger Name in four places).
- [x] A met entity, and an unmet entity with no Stranger Name, show under the true name everywhere. A roster test. Verified: `mapRoster.test.ts` (met, and no Stranger Name, at the tower and moor).
- [x] A Generic entity with instances at two places counts at both. A roster test. Verified: `mapRoster.test.ts` (Generic with instances at two places).
- [x] Named entries order true names before stranger labels. A roster test. Verified: `mapRoster.test.ts` (names before labels).
- [x] The badge shows both parts when both are non-zero, only the named count with no unknowns, and only the unknown part with no named entries. A map render test covers each. Verified: `LocationMap.test.tsx` (split, named only, unknown only; zero part drops).
- [x] The tooltip lists names, then stranger labels, then the unknown line, and a stranger's true name never renders. The map test "never draws a stranger" is rewritten to this rule. Verified: `LocationMap.test.tsx` (tip lists names then the unknown line; true name never in the DOM). The old test is rewritten.
- [x] Each roster guard fails when its rule is reverted (test-bar). The landing names the reverts tried. Verified: 8 of 9 reverts killed, see Landed.
- [ ] Frames of the map with all three kinds of entries: `.scratch/frames/map-badge-light.png` and `.scratch/frames/map-badge-dark.png`, desktop width, tooltip open.

For you: the split badge's look and the unknown line's copy on the in-game map (Change Location dialog, Map view).

## Landed

**Not verified**
- Frames: both frames are stored (`.scratch/map-strangers-01/frames/map-badge-light.png`, `map-badge-dark.png`, tooltip open on the Vent Crawl box). They show a named entry plus an unknown ("1+1?"), not a stranger label with no-label unknown in one view. The label case shows in the White Room box ("a stooped scholar" in its tooltip), but that tooltip is not open in a frame. The files are JPEG bytes with a `.png` name.
- The `jsdom` render tests ran directly, 14 passed in `LocationMap.test.tsx`; the gate's first run covered only the node project.

**Reverts tried** (reintroduced one at a time in `mapRoster.ts`, the roster test file went red each time):
- Reach ignores Nearby places: killed by the implicit-link and Connection cases.
- Reach spans every place (labels shown everywhere): killed by the Far, no-link and unknown-count cases.
- Reach includes Far Connections: killed by the Far case.
- A stranger shows its true name: killed by the three label cases.
- A label-less stranger is dropped instead of unknown: killed by the blank Stranger Name case.
- An unmet entity with no label is treated as known: killed by the same case.
- Labels before names: killed by the ordering case.
- No `numbered()`: killed by the numbering case.
- Not killed: the player place kept when it is null. It is an equivalent mutant, since a null id matches no place.
- Badge reverts in `LocationMap.tsx` (zero unknown part shown, zero named part shown, tip drops the unknown line, tip puts it first): all killed.

**For you**
- The split badge's look and the unknown line's copy on the in-game map (Change Location dialog, Map view). Badge text is `2+2?` for both parts, `3?` for unknown only; the tip reads "N unknown". The `+` and `?` format and the tip wording are my choice, written without a spec line for them.
- Run the dev router at `#dev?view=gameViewer&modal=location&fixture=mapStrangers` to see all three kinds.
- Q12 asks for names, then stranger labels, then unknowns. The roster's one `named` list keeps that order but does not mark which entries are labels.
