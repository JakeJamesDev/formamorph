# 01: You Mark on the Entities Tab

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This ticket builds the shared You pill, its Design System entry, and its first surface, the **Entities** tab. Rulings Q1, Q2, Q3. It sets the pattern that 02, 03 and 04 reuse, so the component and the showcase have to be right here. Opus, because the pattern is new and carries the rest.

## What to build

A player opens the **Entities** tab. The top row reads their persona's name with a small **You** pill after it, where it used to read `Kate (You)`.

The pill is one shared component with one option, `onFill`, for a row on the primary fill. It sits in a box one line tall, so it centers on flex and inline hosts alike. The markup below comes from the prototype (`prototype/you-mark`, commit `5f04d053e`):

```tsx
<span className="ml-1.5 inline-flex h-[1lh] shrink-0 items-center align-top">
  <span className="inline-flex h-3.5 items-center rounded-full px-1 text-[9px] font-semibold leading-none
                   bg-primary text-primary-foreground /* onFill: bg-primary-foreground text-primary */">
    You
  </span>
</span>
```

The Design System guide gets a section for the pill. It says the pill goes after the played persona's name in game, and that editor surfaces say **Persona** instead. The showcase gets a production-backed reference with the pill on a plain row and on a selected row. The **Entities** help topic and the Entities wiki page say the persona is marked **You**.

## Acceptance criteria

- [ ] One shared You mark component renders the pill. It takes `onFill` and a class name, and no variant or name.
- [ ] The **Entities** row takes a flag for the played persona and renders the name plus the pill. The `(You)` text is gone from its label.
- [ ] Under **None** with no Custom Persona, no row and no pill render.
- [ ] The Design System guide has a You pill section. The showcase has a reference card with a plain row and a selected row.
- [ ] The **Entities** help topic and the Entities wiki page say "marked **You**". Released changelog entries are unchanged.
- [ ] The GamePanels render test finds the persona's row by its name and the pill's **You** text. Putting back the `(You)` text without the pill makes it fail.
- [ ] Static frames through the dev-router fixture: dark theme, light theme, one colored palette, and mobile (375 px) on the **Character** tab.
- [ ] A changelog fragment. Four gates green, exit codes read.
