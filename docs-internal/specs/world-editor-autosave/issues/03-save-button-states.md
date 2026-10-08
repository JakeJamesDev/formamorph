# 03: Save Button States

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: motion, a stable width across stacked labels, screen-reader status and per-frame Playwright sampling all have to agree.

Parent: [World Editor Auto Save spec](../spec.md)

## What to build

The Save button's face shows save state. This ticket drives it from the manual save, so it works before auto save exists. Ticket 04 reuses it.

| State | Face |
|---|---|
| Pending changes | Save icon, **Save**, enabled |
| Saving | Spinner, **Saving…** |
| Saved | Check, **Saved**, on `success` at 20%; label and icon in the normal text color. After about 2 s it fades to today's muted **Save**. |
| Failed | Alert icon, **Failed**, destructive fill, enabled. No fade. The tooltip says the save failed and a click tries again. |

- Every label sits in one grid cell, so the face is always as wide as the widest label (**Saving…**) and never shifts. This shape came from the prototype:

  ```tsx
  <span className="grid">
    {labels.map((l) => (
      <span key={l} aria-hidden={l !== current}
        className={cn('[grid-area:1/1] flex items-center justify-center transition-opacity', l === current ? 'opacity-100' : 'opacity-0')}>
        …
      </span>
    ))}
  </span>
  ```

- A polite `aria-live` region announces Saving, Saved and the failure.
- An edit during Saved ends the hold and returns the face to pending.
- Mobile's icon-only Save morphs its icon through the same states.
- A failed manual save keeps today's failure toast.
- No new color token (Q28).

Rulings: Q3, Q27, Q28. Prototype: `prototype/autosave-button`, `878f9cfb`, variant A.

## Acceptance criteria

- [ ] A manual save walks Save → Saving… → Saved → muted Save; the face width never changes (measured).
- [ ] A failed save shows Failed with the destructive fill and stays until the next save succeeds.
- [ ] Saved meets 4.5:1 text contrast in both themes (measured).
- [ ] The `aria-live` region announces each state.
- [ ] Playwright per-frame sampling proves the Saved hold and the fade.
- [ ] Mobile shows the icon morph.
- [ ] Changelog fragment written.
