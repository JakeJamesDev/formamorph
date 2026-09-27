# 09: Sweep: views, lib, contexts and managers

Status: ready-for-human
Base: 0b6d271f
Blocked by: 01 — Details field and headline
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The same sweep for the remaining sites: the top-level views, the hooks and helpers under lib, the contexts and the editor managers, about 60 sites. Caught-error toasts move to the shared helper with their current message as the headline; validation and refusal toasts stay plain. No wording changes.

The connection-guide toast keeps its **Fix connection →** link and does not gain View Details; a toast has one link. The in-game AI request toast is owned by ticket 02 and is left alone here. A canceled request still shows no toast. Ticket 08 adds an `errors` array to the default-world load result; the main menu's "Some default worlds failed to load" toast wraps that array in an AggregateError the same way Settings does.

Recommended model rationale: same mechanical sweep with two named exceptions to respect.

## Acceptance criteria

- [x] Every caught-error toast in the views, lib, contexts and managers goes through the shared helper and offers **View Details →**
- [x] Every validation or refusal toast in those files stays plain with no link
- [x] The connection-guide toast still shows **Fix connection →** and only that link
- [x] A canceled AI request shows no error toast
- [x] No toast's visible words changed; a test that asserted a plain string may switch to reading the toast's visible text, with the asserted words identical
- [x] Four gates green
