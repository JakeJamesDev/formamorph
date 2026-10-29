# 02: World Sources In Help Answers

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a mechanical prefactor of one type through its readers, with no behavior change.

## What to build

A help answer's sources can hold a **world item** beside guide sections: its kind, id and display name. Follow-up history, its topic rule and the AI Context trace carry world items the same way they carry guide sections. The answer card can render a world source as a plain name. Nothing produces world sources yet; tickets 04 and 05 do. Answers look the same as today.

Spec: Q17 (shape only); story 34.

## Acceptance criteria

- [x] A help answer can carry a world-item source beside guide sections (`AnswerSource` union; typecheck)
- [x] A follow-up after an answer with a world source keeps that source in its history and topic rule (`helpSession.worldSource.test.ts`; `useHelpChat` passes exchanges as history)
- [x] The AI Context trace lists a world source with its kind and name (`Formaquestion.worldSource.test.tsx`: "entity · Mira")
- [x] The answer card shows a world source as a plain name (same file: text, no button)
- [x] Existing help tests pass unchanged (all pass; 4 files got type-only `docSectionsOf` edits, no assertion changed)

## Landed

Not verified:
- None.

For you:
- The world source chip copies the `SourceLink` chip look without a button. Check in a Sources list that it reads as a name, not a link. Nothing produces one yet, so it shows only in tests.
- Spec ruling 3 applied: the topic is the first non-lead source of either kind. A world source first in the list means a follow-up favors no docs page.
