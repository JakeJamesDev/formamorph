# 04: One Context Hook

Status: done
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: one hook replaces three derivations and the box's own home derivation, under parity tests, and ships a Test Code behavior fix on linked stats.

## What to build

One hook builds a script box's context from the script's home, as the Sandbox Snapshot names homes, and an optional world (spec: One context hook; Q3, Q8, Q9, Q10). It returns the Owner, the self name, the owner's stats under their code names, the owner stat names where they are checked, and the card lookup when a world exists. The Owner derives from the home through the snapshot's own derivation; the home decides the rest. `self` is the stat or trait as the stored world holds it, found by its home. On an entity's linked stat it is the resolved stat under the original id, never the link id. The stat panel reads it from the world, not from its draft. Without a world, as in the library entity editor, the hook returns no lookup and takes the owner's stats from the entity it is given.

All three surfaces switch to the hook. The code box's own home derivation for Test Code is replaced by the same home, so a box runs under the home its context was built from. The extracted builders from ticket 03 are deleted, and the parity tests now run the hook against the recorded values, with the linked stat's self id asserted as the original id on every surface.

## Acceptance criteria

- [x] The parity tests pass against the hook for every home on every surface, with the linked stat's self id now the original id on the stat panel too. `useScriptBoxContext.parity.test.tsx`: 15 home × surface rows on one `RECORD`, no disagreements; T04-2 rows absent; the linked stat case red with the link-id self back.
- [x] Test Code on a root-linked stat, from the stat panel and from the Scripts tab: a script that writes through `owner.stats` to itself reports the written value with no dropped-write line; proven by reinstating the link-id self. `WorldEditor.scriptSurfaces.test.tsx` "Test Code on a root-linked stat", real executor, reports `Result: 7`; the stat panel case goes red with `statPanelHome` keyed on the row id.
- [x] Library entity editor: a script box on a library entity's stat and trait completes against the entity's own stats and runs Test Code with no card lookup. Parity "a library entity's boxes" (stat and trait, links resolved over the library world and alone, T04-3), `scriptBoxHome.test.ts` name-bound link, `StatManager.testCode` "runs a library entity stat's box"; each red with `offWorld` ignored.
- [x] The box's Test Code home comes from the hook's home; the box's own derivation is gone. `ScriptBox` runs `context.home`; `boxHome` and the `self` prop are deleted.
- [x] The three extracted builders are deleted; no surface builds its context outside the hook. `scriptBoxBuilders.ts` and `useScriptEntryContext.ts` deleted; stat panel, trait tab and Scripts tab call `useScriptBoxContext`.
- [x] A Blueprint trait box's lookup lists the owners that link the trait on both surfaces, as a Blueprint stat's does (T04-1); the parity row that recorded no owners is updated to the owners. `RECORD.blueprintTrait` lists Odette; red without `traitId`. Find All Uses too (T04-4): `codeItemUses.test.ts` Blueprint trait case, red without `traitId`.
- [x] Changelog fragment in `docs-internal/changelog.d/`, under Fixed, 👤: Test Code on a linked stat now routes writes through `owner.stats` to the stat itself, as play does. `docs-internal/changelog.d/script-surfaces-04.md`.

For you: on a world with an entity linking a Blueprint stat, run Test Code on that stat's script from its panel and from the Scripts tab, and confirm the two reports match.

## Landed

**Not verified**
- Library trait box Test Code: no test runs it from a rendered trait panel. Its context is tested at the hook level, and the box's run path is the one the stat panel's library case drives.

**For you**
- For you: on a world with an entity linking a Blueprint stat, run Test Code on that stat's script from its panel and from the Scripts tab, and confirm the two reports match.
- A Blueprint trait's script: hover `owner` and confirm the card lists the entities that link the trait.

Seen in passing: in the library, `entityStatPanels` builds the off-world on each render, so the library's boxes rebuild their context per render (the World Editor's do not).
