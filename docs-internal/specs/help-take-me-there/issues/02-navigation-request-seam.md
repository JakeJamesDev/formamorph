# 02: Navigation request seam

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

One production path opens any player-facing surface by id, so a later ticket's button can jump there.

- A pure resolver turns a surface id into steps: the view to show, the dialog to open, the tab to select. It reads the ledger the surface map reads. An unknown id resolves to nothing.
- A new request in the settings context, beside the settings-open request: open a surface by id. The main menu and the game viewer consume it as they consume the settings-open request. The dev router stays DEV-only and unchanged.
- From a running game, a surface on another screen asks before leaving; a refusal clears the request and changes nothing. An editor surface runs the World Editor's own unsaved-edits prompt when the editor holds changes.
- A request for the surface already open re-selects its tab and does nothing else.

Spec: Q19; Implementation → Navigation request.

Recommended model rationale: a cross-cutting seam through App, two views and the editor's prompt, with confirm flows that must stay correct under every state.

## Acceptance criteria

- [ ] Resolver: a screen id gives the view alone; a dialog id adds the hosting view and the dialog; a tab id adds the tab; an unknown id gives nothing.
- [ ] Through the providers: a request opens the right view, dialog and tab from the main menu and from a game; from a running game the prompt shows and a refusal changes nothing; the editor's unsaved prompt runs for an editor surface with changes.
- [ ] A request for the open surface re-selects its tab only.
- [ ] Each guard proven by reinstating the old behavior.
- [ ] The four gates are green.
