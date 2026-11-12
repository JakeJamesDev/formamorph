# 01: Map Shows Strangers

Status: ready-for-agent
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

- [ ] The roster puts an unmet stranger with a label under that label in the player's place, in a place Nearby by implicit link, and in a place Nearby by a Connection with no distance. A roster test covers each.
- [ ] The roster counts the same stranger as one unknown in a place reached only by a Far Connection, and in a place with no link. A roster test covers each.
- [ ] An unmet entity with a blank Stranger Name and no alias is one unknown in every place, its own and Nearby places included. A roster test.
- [ ] A met entity, and an unmet entity with no Stranger Name, show under the true name everywhere. A roster test.
- [ ] A Generic entity with instances at two places counts at both. A roster test.
- [ ] Named entries order true names before stranger labels. A roster test.
- [ ] The badge shows both parts when both are non-zero, only the named count with no unknowns, and only the unknown part with no named entries. A map render test covers each.
- [ ] The tooltip lists names, then stranger labels, then the unknown line, and a stranger's true name never renders. The map test "never draws a stranger" is rewritten to this rule.
- [ ] Each roster guard fails when its rule is reverted (test-bar). The landing names the reverts tried.
- [ ] Frames of the map with all three kinds of entries: `.scratch/frames/map-badge-light.png` and `.scratch/frames/map-badge-dark.png`, desktop width, tooltip open.

For you: the split badge's look and the unknown line's copy on the in-game map (Change Location dialog, Map view).
