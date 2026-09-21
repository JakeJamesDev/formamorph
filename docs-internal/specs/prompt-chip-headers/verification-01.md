# Header Authoring Verification

Scope: [ticket 01](issues/01-author-headers-on-format-capable-chips.md). Stats, Traits, Persona, Location, and Entities share the token, rendering, editor, and clipboard paths. Built-in prompt conversion and the remaining chip families belong to later tickets.

## Behavior checked

- Production parser/serializer and vocabulary edits retain raw Header text, Format, Content, Scope, and literal affixes.
- Exact output assertions cover all casing examples, three formats, empty values, unresolved tokens, inline sections, adjacent sections, authored blank lines, and deliberate extra whitespace.
- XML fragments are parsed with `DOMParser`, including punctuation, Unicode, numeric prefixes, authored parent blocks, and omitted sections.
- Preview, narration assembly, and request-anatomy text agree; anatomy runs tile the request and own generated boundaries and spacing.
- Production preset JSON/share codes and world JSON export/import retain editable Header tokens and existing custom prompt strings.
- Both real editors exercise add/edit/clear, format/content switching, highlighted boundaries, clipboard, persistence, native dragging, blank-line placement, self-drop rejection, cancellation, and undo/redo.
- Mobile full-screen editing, read-only protection, light/dark themes, and the production Prompt Chips reference are covered by browser checks.

## Browser evidence

`e2e/prompt-headers.spec.ts`: **13 passed, 3 intentionally skipped**, exit 0, **98.37 seconds**. The mobile project skips two native-pointer drag cases and the viewport-independent world serialization case, which run on desktop.

Static captures use 1280 × 860 desktop and 375 × 812 mobile viewports. Generated boundaries use the existing conditional highlight. Long options panels scroll within the viewport.

| Surface | Light | Dark |
| --- | --- | --- |
| Settings, desktop | `.scratch/prompt-headers/settings-light-desktop.png` | `.scratch/prompt-headers/settings-dark-desktop.png` |
| Settings, mobile | `.scratch/prompt-headers/settings-light-mobile.png` | `.scratch/prompt-headers/settings-dark-mobile.png` |
| World Editor, desktop | `.scratch/prompt-headers/world-light-desktop.png` | `.scratch/prompt-headers/world-dark-desktop.png` |
| World Editor, mobile | `.scratch/prompt-headers/world-light-mobile.png` | `.scratch/prompt-headers/world-dark-mobile.png` |

The local captures and raw logs are temporary evidence; the checked-in browser tests reproduce them. Browser execution uses an independently launched Vite server because the Windows runner's managed-server shutdown did not complete.

## Defects exposed during verification

Native plaintext copying omitted decorator nodes. Variable nodes now serialize their complete token, and prompt paste rebuilds editable placements. A separate native-paste race showed a collapsed browser caret alongside a stale full-document Lexical selection; paste now reads the current browser range through Lexical's public selection API.

Tall chip options could clip Header controls. Their available-height constraint and scrolling keep all fields reachable in Settings dialogs and mobile layouts.

## Compatibility

Header is JSON-escaped placement metadata inside the existing prompt string. **Older parsers do not recognize Header tokens; shared presets/worlds using them require the updated parser.** Export-envelope shapes, the application version, and stored custom prompts are unchanged. No migration is added.

## Final checks

| Gate | Result | Wall time |
| --- | --- | --- |
| Typecheck after review | 0 errors, exit 0 | 18.29 s |
| Lint after review | 0 errors, one existing WorldOverviewManager refresh warning, exit 0 | 18.40 s |
| Full unit suite | 743 files passed; 12,261 tests passed, 3 skipped; exit 0 | 185.16 s |
| Production build | Success, exit 0; existing chunk-size and externalization warnings | 22.39 s |
| Targeted coverage after mutation restoration | 42 files, 617 tests passed, exit 0 | 17.05 s |
| Clipboard coverage after review | 2 files, 6 tests passed, including the new race guard; exit 0 | 6.67 s |

The four gates invoke the package scripts' exact executables through the bundled Node runtime. The full suite reports 637.98 seconds of summed test work across 12 workers and 184.37 seconds of runner time, with no prolonged idle tail. Review added one test and documentation; production code is identical to the full-suite/build run. No built-in AI prompt text changed, so model probes are outside this slice.

### Measured coverage

| Changed module | Lines | Branches | Functions |
| --- | --- | --- | --- |
| promptHeader | 100% | 90.90% | 100% |
| promptTemplate | 100% | 98.27% | 100% |
| promptVariables | 99.57% | 94.52% | 100% |
| chipVocabulary | 98.47% | 91.16% | 82.75% |
| sectionStyle | 100% | 100% | 100% |
| PromptField | 91.90% | 88.78% | 81.57% |
| VariableNode | 95.27% | 86.19% | 89.06% |
| TokenChip | 100% | 90% | 100% |
| PromptTokenPastePlugin | 100% | 50% | 100% |

Aggregate: 93.36% lines, 90.15% branches, 87.43% functions. PromptChipsReference has no unit coverage; its real rendered surface is exercised by desktop and mobile browser checks. Native clipboard selection and permissions run in the browser, beyond the unit coverage measurement.

### Mutation evidence

Each decision was changed in production code, tested, and restored from its original bytes. All mutations exited 1 with the expected assertion failures; the restored targeted suite passed.

| Reintroduced defect | Expected failures observed | Wall time |
| --- | --- | --- |
| Drop Header while serializing | Round-trip, raw text, sharing, and vocabulary preservation | 2.34 s |
| Leave uppercase phrases unchanged | PLAYER CHARACTER casing | 2.23 s |
| Remove XML closing tag | XML parser and exact section output | 2.32 s |
| Keep empty headed sections | Blank/N/A omission and empty-parent cases | 2.35 s |
| Remove leading section spacing | Inline placement, authored newline reuse, anatomy | 2.30 s |
| Disable clipboard reconstruction | Cut/paste fails to restore editable placement | 3.44 s |
| Replace DOM-selection synchronization with the stale Lexical selection | Pending-update paste deletes preceding text | 3.45 s |

The selection mutation initially survived three ordinary browser repeats (29.95 s). A focused production-plugin regression now holds a noncollapsed pending Lexical range and collapsed browser caret in one update and asserts both trigger states before paste. Removing synchronization loses `Before`; restoring it preserves `Before` and inserts the editable chip at the caret. The two restored clipboard test files passed all six tests in 2.95 seconds. The test exercises the public editor command and selection APIs.

### Closing review

- **Spec:** no actionable findings. Independent renderer/editor checks passed 41 tests in 2.98 seconds.
- **Standards:** no implementation violations. The missing selection-guard mutation evidence is supplied above.
- **Nonblocking follow-up:** each headed chip calculates spacing from the document on updates. A synthetic benchmark measured 0.68 / 7.34 / 55.24 ms at 20 / 50 / 100 headed chips (0.77 s command wall), excluding traversal and React overhead. Sharing one calculation per editor update is an optimization opportunity; this ticket retains the existing per-chip subscription approach.

Copy sweep found no new Header-label or hint issues. Version, defaults, new-screen routes, export envelopes, and the existing sanctioned `any` exception are untouched. Changelog and design authority are updated; the AST graph refresh and closing reviews are recorded on the ticket.
