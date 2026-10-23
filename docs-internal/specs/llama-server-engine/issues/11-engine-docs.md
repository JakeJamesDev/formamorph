# 11: Engine Docs

Status: done
Base: 52995d835
Blocked by: 05, 06, 07, 08
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: player docs for settings that already exist, in a set house style.

## What to build

Player docs for the new engine (spec: Solution; Q15).

- Settings help: rows for Unified KV Cache, K Cache Type, V Cache Type, KV Cache in RAM and Context Overflow, plus the corrected Parallel Requests and Flash Attention rows.
- Image input: how a vision model finds its projector.
- Rebuild the Formaquestion help vectors so it answers about the new settings.
- Check the changelog leads from tickets 02–08 read as one coherent story for the release.

## Acceptance criteria

- [x] Settings help covers every new and changed engine setting; `copy-sweep` passes on it.
- [ ] The help vectors are rebuilt, and a Formaquestion query for each new setting returns its section. (Vectors rebuilt; the vision query was not re-run after the heading change.)
- [x] The changelog leads for this effort name the Unified KV Cache default and the Flash Attention change.

## Landed

Committed by hand as 4e2e245f7, outside the ticket flow: the session ran without the project's agent files, so it skipped the gates, the code review and prepare. The spec session restored this Status and wrote this section from the session's report.

**Not verified**
- The semantic side of help search. Keyword search returns each new setting's section first (7 queries); the vision queries land on the Desktop Engine section, which holds the vision subsection.

**Fixed after landing** (spec session): the four gates ran green on the branch (typecheck 36 s, lint 33 s, test 289 s, build 23 s). The two-axis review moved two misplaced paragraphs, filed the Flash Attention entry under Fixed, said that Rolling Window keeps the system prompt and that quantized V options are unavailable while Flash Attention is off, and dropped an idiom. Vectors rebuilt.

**For you**
- Read the new Settings help sections: Engine Memory and Context, Flash Attention, Context Overflow, and projector pairing in Connect Your Own AI.
