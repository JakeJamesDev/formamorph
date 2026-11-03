# 09: Send Funnel Totals

Status: ready-for-human
Blocked by: 05, 06, 08, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: a small fire-and-forget call at four known points.

**What to build:** the app reports each funnel step to the totals route once per device: offer shown, See Levels, Patreon click, checklist finished. A failed send is dropped, and the player never sees it.

- [x] The app posts to `POST /api/funnel/:step` with `offer_shown`, `see_levels`, `patreon_click` and `checklist_finished` (Q41). `funnel.test.ts` "posts the step name alone"; call sites in `useDemoAIOffer.ts`, `roadSceneStore.ts`, `useSupportChecklist.ts`.
- [x] Each step sends once per device, proven by a test that fires the step twice. "sends each step once per device".
- [x] A failed or refused send changes nothing the player sees, and raises no unhandled error. Rejected and synchronous-throw tests.
- [x] The call carries only the step name, with no install header or account token. The test asserts the exact fetch init: no headers, body or credentials.
- [x] A build without hosted AI sends nothing. "sends nothing in a build without hosted AI".
- [x] No changelog entry names this as a player feature, and the docs stay current if they mention what the app sends. No fragment written; a grep of `docs/` for the funnel found no mention.

## Landed

**Not verified**
- The call sites are not covered by a component test. Only the sender is tested; the wiring was read, not run in the preview.

**For you**
- `patreon_click` fires only from the checklist's Open Patreon action. The other Patreon links (hosted notices, preset status, Supporters Wall) do not report. Say if they should.
- `checklist_finished` fires once all four rows are done on this device.
- Once a step is marked sent, a failed send is not retried (a dropped send is final).
