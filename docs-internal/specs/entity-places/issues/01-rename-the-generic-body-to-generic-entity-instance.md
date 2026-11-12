# 01: Rename the Generic Body to Generic Entity Instance

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

One standing body of a Generic entity is called a "presence" in code, comments and specs. The glossary now uses Presence for every place an entity can be, and Generic Entity Instance for the body (Q15). Rename the body everywhere so the word has one meaning before the Entity Places module is written.

- Rename types, functions, variables, comments and TSDoc that use "presence" for the body of a Generic entity. In code the form is `genericEntityInstance`.
- Leave every use of "presence" that means "who can be at a place" or the Presence tab. Read each hit; this is not a blind replace.
- Do not rename any key that is written to a save file or a world file. The save shape and the world shape do not change. If a type name and a stored key share a word, rename the type and keep the key.
- Internal docs and human docs that name the body follow. Closed specs keep their text.
- User-facing copy does not change.

Spec rulings: Q15, Q12.

## Acceptance criteria

- [x] No type, function, variable or comment in the app source uses "presence" for one standing body of a Generic entity. The landing lists the renamed identifiers. (grep of `presences?\b` over `src` read hit by hit)
- [x] Every remaining "presence" in the app source means the places an entity can be, the Presence tab, or the turn's "who is here" computation. The landing lists the kept uses by area. (same grep; see Landed)
- [x] A save written before the change loads with every Generic Entity Instance at its place. A test loads a stored save fixture and compares the position book. (`GameplayContext.positions.test.tsx`, "loads a stored save at its places…")
- [x] The stored keys of the save envelope and the world file are byte-equal before and after for one fixture. A test asserts it. (same test, `genericStates` text compared to the pre-change literal; no stored-key line changed in the diff)
- [x] No user-facing string changes. The landing states the check used. (diff holds no JSX text, copy string or `docs/` change; only comments, identifiers and test titles)

## Landed

**Renamed identifiers**
- `PresenceState` → `GenericEntityInstanceState` (`src/types/gameplay.ts`, `positionEngine.ts`)
- `advancePresence` → `advanceGenericEntityInstance` (`positionEngine.ts`)
- `SandboxState.presences` → `genericPositions` (Q17), with the `StatCodeTurn` input, the player view cut, `sandboxSnapshot.ts`, `positionPlay.ts` and the stat-code fixture
- Locals `presences` → `instances` in `positionEngine.ts` and `positionPlay.ts`; test helper `presences` → `instancePositions`
- Comments and test titles that named the body, in `types`, `entityKind`, `entityPresence`, `presence`, `liveScene`, `version`, `GameplayContext` and their tests

**Kept uses of "presence", by area**
- The module and tab: `lib/presence.ts`, `usePresence`, `computePresence`, `EntityPresence`, `PresenceInput`, `entityPresence.ts`, `locationPresenceReasons.ts`, the Presence tab, `presenceLines`, `presenceEntity`, `PresenceReveal`, `data-testid="presence-*"`, the `subTab: 'presence'` slot
- The inventory pass `Presence` (who is present after the turn's moves)
- The legacy entity `presence` field and its migration in `version.ts`, and the tests for it
- Unrelated senses: Radix `Presence`, `AnimatePresence`, `useSlidePresence`, the seeder and token "presence check", the narration "who is in the scene" comments

**Not verified**
- Wiki prose in `docs/WorldFormat.md` and `docs/Scripts-Reference.md` still says "presences" for the body. It is author-facing copy, so I left it for the copy owner (Q12).

**For you**
- Decide whether the two wiki pages above should say "Generic Entity Instance" or keep their own words.
