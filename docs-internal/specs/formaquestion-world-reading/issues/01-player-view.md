# 01: Player View

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: every in-game leak rule lives here, and each exclusion needs a guard that bites.

## What to build

A pure **Player View** builder takes the authored world and the current playthrough and returns only what the player has met, in player text. Nothing reads it yet; tickets 05 and 06 wire it in.

- **Entities:** met entities by id, plus discovered entities the player did not delete. Player description only. An entity whose real name is not revealed yet appears under its scene alias.
- **Places:** the current location and every location a past turn recorded. Player description, with the legacy description as player text where none exists.
- **Items:** held by the player, or a visible copy at a met place. Hidden copies stay out until revealed. Runtime items use their description (Q25).
- **Stats and traits:** visible stats and the player's own traits. Hidden stats, disabled stats, hidden traits and AI-only group headings are out.
- **Never:** AI descriptions, AI summaries, diaries, script memory lines, unmet content.

A new ADR records world reading and the Player View, and marks ADR-0011's in-game "authored world, no playthrough" as superseded. CONTEXT.md gains **Player View**.

Spec: Q1, Q10, Q11, Q18, Q21, Q22, Q25, Q26; stories 11–22, 26.

## Acceptance criteria

- [x] An unmet entity, place or item is absent from the view: `playerView.test.ts` entity, location and item cases
- [x] No AI description, AI summary, diary or script memory text appears in the view: "holds no AI description…", plus the peeled-follower case
- [x] An unrevealed entity appears under its alias, and under its real name once revealed: alias cases, including a discovered entity and one that left the scene
- [x] A discovered entity appears; one the player deleted does not: "holds a discovered entity, and drops one the player deleted"
- [x] Places come from the current location and recorded turn locations; a turn without one adds nothing: location cases
- [x] An item counts once held or once a visible copy was at a met place; a hidden copy stays out until revealed: item cases (met place = where the player stood in that snapshot, per the spec session)
- [x] Hidden stats, disabled stats and hidden traits are absent; visible stats and the player's traits are present: stat and trait cases
- [x] Building from an earlier snapshot (undo) drops what later turns added: "drops what the undone turn added"
- [x] Each exclusion test fails when its filter is removed: 18 filter removals, each red (a mutation script run in the worktree)
- [x] The new ADR and the CONTEXT.md entry exist: ADR-0014, ADR-0011 status line, **Player View** glossary entry

## Landed

**Not verified**

- None. Nothing reads the view yet, so there is nothing to see in the app.

**For you**

- Nothing to play-test until tickets 05 and 06 wire the view in.
- Undo needs the snapshot chain and the history slice from the caller. Tickets 05 and 06 must pass the chain up to the current snapshot, not the whole `stateHistory`.
