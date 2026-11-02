# 14: Scanners To ESLint

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: Each conversion is small, but each must keep what the scan guarded.

Parent: [Test Sweep spec](../spec.md)

## What to build

Source-scanning tests become ESLint rules where a rule can express them (Q10). Scans of docs, CSS and worlds stay tests. The changed-file lint only sees changed files, so `npm run lint` on the whole repo must stay clean to keep each guard honest. Remove converted entries from the always-run list.

Rulings: Q10, Q26.

## Acceptance criteria

- [x] Each converted scan has rule tests, with valid and invalid cases. `eslint.rules.test.ts`: RuleTester per rule, plus rows through the repo's own config.
- [x] Reintroducing each scanned problem produces a lint error. 18 reinstated problems in real files, linted through the repo config: all reported, 0 before each edit. Rule-test rows prove the same at each path.
- [x] The always-run list is smaller by the converted entries, and each scan that stayed has a stated reason. 28 entries to 20; the table below, and each entry's reason in `scripts/testSelection.mjs`.

## Scans

| Test | Result | Reason |
|---|---|---|
| `src/lib/scrollGuard.test.ts` | Rule `no-native-scroller`; deleted with its module | One file at a time |
| `src/lib/sandboxSnapshot.boundary.test.ts` | Rule `module-boundary`; deleted | One file at a time |
| `src/managers/fieldLabels.test.ts` | Rule `field-caption-prop`; deleted | One file at a time |
| `src/lib/elementIcons.test.ts` | Rule `element-icon-import`; the map tests stay | One file at a time |
| `src/lib/docs/bundledDocsIndex.test.ts` | Rule `module-boundary`; the docs tests stay | One file at a time |
| `src/components/FullscreenShell.test.tsx` | Rule `source-contract`; the mount tests stay | One file at a time |
| `src/lib/formaquestion/helpSettings.test.ts` | Rules `source-contract`, `no-restricted-imports`; the settings tests stay | One file at a time |
| `src/components/menu/feedbackCapabilities.test.tsx` | Core `no-restricted-imports`; the mount tests stay | One file at a time |
| `src/lib/personaReaders.test.ts` | Rule `no-raw-entity-list` for the per-file scan; stays listed | Pins the lists three files hand each reader |
| `src/lib/useResolvedWorld.playerName.test.tsx` | Stays | Pins a call's arguments |
| `src/lib/viewportSizing.test.ts` | Stays | Ties view classes to the CSS rule they name |
| `site/bundleBoundary.test.ts` | Stays | Walks imports across files |
| `src/lib/surface/surfaceReportChecks.test.ts` | Stays | Needs every source at once |
| `src/lib/worldSearchLabels.test.ts` | Stays | A caption must exist in some manager |
| `src/lib/aiRequest/localEngineImageDrop.test.ts` | Stays | Compares two files; lint ignores `electron` |
| `scripts/buildDecision.test.mjs`, `scripts/testSelection.test.mjs` | Stay | Need every file at once |
| `src/lib/ownerTermGuard.test.ts`, `src/lib/playerInputRename.test.ts`, `src/components/formaquestion/searchNaming.test.ts`, `src/lib/helpTopics.test.ts`, `scripts/changelogFormat.test.mjs` | Stay | Read docs |
| `site/supporterTokens.test.ts`, `src/lib/supporterTokens.test.ts`, `src/lib/codeHighlight.test.ts`, `src/components/menu/WebVersionChangelog.test.tsx` | Stay | Read CSS |
| `src/lib/bundledFingerprint.test.ts`, `src/test/tokenCorpus.ts` | Stay | Read worlds |

## Landed

**Not verified**

- Nothing unticked.

**Guards that changed**

- A ledger row for a deleted file is no longer caught. The row permits nothing, and a check would need a new always-run entry.
- `import(path)` with a variable and a prefixed name like `MY_HELP_MAX_TOKENS` now pass. The old text scans caught them, and both are contrived.
- Stricter than the scans: `Smile` counts as mapped (the old scan keyed on `displayName`, `FaceSlightlySmiling`), and a dynamic executor import must destructure other names. Text in a comment no longer counts as a scroller.

**For you**

- Nothing to judge in the app. Whole-repo `npm run lint` in CI now keeps these guards honest.
