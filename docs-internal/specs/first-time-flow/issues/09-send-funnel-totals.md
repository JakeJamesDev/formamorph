# 09: Send Funnel Totals

Status: ready-for-agent
Blocked by: 05, 06, 08, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: a small fire-and-forget call at four known points.

**What to build:** the app reports each funnel step to the totals route once per device: offer shown, See Levels, Patreon click, checklist finished. A failed send is dropped, and the player never sees it.

- [ ] The app posts to `POST /api/funnel/:step` with `offer_shown`, `see_levels`, `patreon_click` and `checklist_finished` (Q41).
- [ ] Each step sends once per device, proven by a test that fires the step twice.
- [ ] A failed or refused send changes nothing the player sees, and raises no unhandled error.
- [ ] The call carries only the step name, with no install header or account token.
- [ ] A build without hosted AI sends nothing.
- [ ] No changelog entry names this as a player feature, and the docs stay current if they mention what the app sends.
