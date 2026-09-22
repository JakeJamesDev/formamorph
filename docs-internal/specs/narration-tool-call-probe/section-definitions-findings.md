# Definitions beneath context headers: results

**The added definitions improved the observed retrieval scores and reduced aggregate thinking in this batch.** All twelve narrations completed. Four still mention entities whose full entries were not loaded, so the requested every-mention behavior is not reliable yet.

[Narration comparison](section-definitions-outputs.md) · [Thinking separately](section-definitions-thinking.md) · [Exact rendered prompt](section-definitions-prompt.md) · [Mention audit](section-definitions-review.csv) · [Protocol](section-definitions-protocol.md)

## What changed

The baseline already has the Entity definition and corrected, example-free tool description. The candidate adds short definitions under Game World, Player Stats, Traits, Current Location, and Foreground Lore. It also adds the proposed scope sentence beneath the existing Entity definition. Chip values, headers, order, cached tool history, narrator role, lookup description, model, seeds, and limits are unchanged.

The fixture leaves other sections empty. Definitions for Background Lore, Player Character, Player Notes, Sublocations, Reachable Locations, and their entity listings therefore do not appear in these requests. Their model effects remain untested; this is not evidence for every possible section configuration.

## Measurements

| Metric | Entity definition only | Definitions under populated headers |
|---|---:|---:|
| Cases retrieving all action-required new lore | 7/8 | 8/8 |
| Those cases also completing narration | 7/8 | 8/8 |
| Action-required individual entries fetched | 9/10 | 10/10 |
| New lookup calls | 9 | 10 |
| Completed narrations | 12/12 | 12/12 |
| Completed with every mentioned entity loaded | 5/12 | 8/12 |
| Reasoning tokens, all requests | 4,001 | 3,507 |
| Average narration words | 181.3 | 172.0 |
| Batch duration | 247.987 s | 230.874 s |

Reasoning fell by 12.3% despite one additional lookup. This is a measured batch result, not a guarantee that definitions reduce thinking. Both ferry inspections now fetch their entry. All ten candidate calls target required, uncached entries; neither cached-Bram case repeats his lookup. No retries or cap increases.

## Why every-mention coverage improved

The candidate newly passes both greetings, the first ferry inspection, the second quiet observation, and the second mixed-cache greeting. Except for the ferry inspection's added lookup, these gains come from omitting unfetched entities from the narration. It loses two earlier passes: the first mixed-cache greeting adds the raft, and the second ferry inspection adds both characters without retrieving them.

The four remaining failures are:

| Case | Missing entries for actual mentions |
|---|---|
| First quiet observation | Rope Ferry, through its mooring line |
| First mixed-cache greeting | Rope Ferry, described as the listing raft |
| Second ferry inspection | Bram and Odette, both named and described |
| Second cached-Bram question | Rope Ferry, described as the moored raft |

Mention scoring follows the prior rules: named or indirect references in narration and dialogue count; crossings as activities and unattached rope descriptions alone do not. A completed response with no listed-entity mentions passes without calls. A response that mentions an unloaded entry fails even if it only repeats a summary fact. The audit records the entities counted in each output.

The combined definitions are a promising candidate in this world and model. This test cannot identify which added definition caused a difference, establish that the behavior generalizes, or settle subjective prose quality. Complete outputs remain available for review. Application prompts were not changed.

## Evidence and checks

- Model: `g4-meromero-v2-31b-i1`, with matching loaded metadata. [Raw baseline](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-no-example-batch-2026-09-22T19-39-09-124Z.json) and [raw candidate](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-section-definitions-batch-2026-09-22T19-48-05-005Z.json).
- Offline validation reverses only the added definitions and checks complete request equality. All actual candidate initial requests match prepared requests. Review artifacts preserve all 24 narration texts and 39 thinking responses verbatim.
- Focused tests: 46 passed in 4.744 seconds. Shared probe coverage: 96.95% statements/lines, 87.67% branches, 100% functions. Disabling the additions failed the new preservation guard in 2.163 seconds; source restoration was verified.
- Application typecheck passed in 15.282 seconds; harness typecheck in 2.230 seconds; lint in 13.942 seconds with the existing Fast Refresh warning.
- Full suite: **12,551 passed, three skipped, exit 0 in 91.324 seconds**. Build passed in 18.042 seconds with the existing bundle-size warning. Graph refresh completed in 128.833 seconds.
- Changelog updated. Application defaults, export shapes, version, and cross-turn retention behavior are untouched. Cached fixtures remain as explicitly requested; per-turn lookup remains the intended app direction.
