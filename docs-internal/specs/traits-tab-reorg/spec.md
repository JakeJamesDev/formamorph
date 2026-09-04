# Traits Tab Reorganization

Status: ready-for-agent

## Problem Statement

A world with many player-toggleable traits turns the in-game Traits tab into a wall of text. Every trait — active, switched off, or merely acquirable — renders as one undifferentiated row of name-plus-description in a single flat scroll, with no grouping, no way to see at a glance what is currently active, and no way to find a specific trait short of reading the whole list. The trait groups the author carefully arranged (including nesting and exclusive groups) are invisible in play: group structure collapses into nothing but sort order, and exclusive groups behave as radios silently — the player ticks one checkbox and an unrelated checkbox unticks itself with no visual explanation.

## Solution

The Traits tab becomes a sectioned, glanceable panel. Each top-level trait group renders as a collapsible pill-header section showing the group name and a count of its enabled traits; nested subgroups appear as small subheaders inside their parent's section. Enabled traits sort first within each section; everything switched off or not yet taken folds into a collapsed "Disabled (N)" block per section. Exclusive groups render with radio controls, making the existing auto-switch behavior legible, and support deselecting down to none. A one-line muted summary above the sections names every active trait, a filter field narrows the whole panel to matches, and tapping a trait reveals its signed stat changes. Sections holding at least one enabled trait start open; a section with none shows a muted zero count and starts collapsed. Worlds without trait groups keep a plain flat list with no section chrome.

## User Stories

1. As a player, I want traits grouped under the categories the author created, so that a large trait list reads as an organized set instead of a wall of text.
2. As a player, I want each category header to show how many of its traits are enabled, so that I can survey my build without opening anything.
3. As a player, I want a category with zero enabled traits to show a muted count indicator, so that empty categories recede visually instead of competing with active ones.
4. As a player, I want one summary line listing all my active traits, so that I can glance at my whole build in a single place.
5. As a player, I want categories containing enabled traits to start expanded and the rest to start collapsed, so that opening the tab shows my active build with zero clicks.
6. As a player, I want disabled and un-taken traits tucked into a collapsed "Disabled" block inside each category, so that clutter is hidden but re-enabling stays one click away, in context.
7. As a player, I want enabled traits listed before disabled ones within a category, so that what is in force is always on top.
8. As a player, I want nested subgroups shown as subheadings inside their parent category, so that deep authoring structure stays readable in a narrow panel.
9. As a player, I want traits in an exclusive group presented as radio buttons, so that I can see they are alternatives before I toggle one.
10. As a player, I want selecting a trait in an exclusive group to automatically switch off its active sibling, so that the group's rule is enforced without me bookkeeping.
11. As a player, I want to deselect the active trait of an exclusive group and hold none of them, so that an optional group is not forced on me.
12. As a player, I want to type into a filter field and see only matching traits, so that I can find one trait in a hundred without scrolling.
13. As a player, I want filtering to open the sections and disabled blocks that contain matches, so that results are never hidden behind a collapsed header.
14. As a player, I want to tap a trait to reveal its stat changes with signs, so that I can judge what enabling it would do before I commit.
15. As a player, I want stat names inside a trait's details resolved through that trait's own placeholder pins, so that a pinning trait reads its own values.
16. As a player, I want traits the author did not mark toggleable to appear without a control, so that I can see what I permanently have without being teased with a switch.
17. As a player, I want the tab to show only the traits held on the turn I am reviewing, read-only, when I page back through history, so that the past stays the past.
18. As a player, I want a world with no trait groups to show a simple flat list, so that small worlds are not dressed in pointless section chrome.
19. As a player, I want ungrouped traits in a world that also has groups collected under a "General" section, so that nothing floats homeless above the structure.
20. As a player, I want my expand/collapse fiddling to reset to the sensible default next session rather than persist, so that the tab always opens predictably.
21. As a world author, I want the group structure I build (including nesting and exclusivity) reflected in play, so that my authoring effort reaches the player.
22. As a world author, I want a group's exclusivity visible as radio controls in-game, so that players understand the alternatives I designed.
23. As a world author, I want hidden stats omitted from a trait's stat-change details, so that my behind-the-scenes bookkeeping stays behind the scenes.

## Implementation Decisions

- **Layout**: one collapsible section per top-level trait group, pill-style header (name, enabled-count badge, chevron). Nested subgroups flatten to subheaders inside the top-level section — never nested accordions; deeper paths join with "›". Groups whose subtree holds no traits are hidden.
- **Section model as a pure builder**: the mapping from (listed traits, trait groups) to the render model is one pure function, the prototype's shape carried over (from the prototype):

  ```ts
  interface Block { key: string; subheader: string | null; exclusive: boolean; traits: Trait[] }
  interface Section { key: string; name: string | null; blocks: Block[] }
  ```

  A `name: null` section means the flat, chrome-less case (world has no groups). Ungrouped traits in a grouped world become a "General" section.
- **Enabled-first + Disabled split**: within a section, enabled traits render first (grouped by subheader), then a collapsed "Disabled (N)" block holding every off trait — switched-off and never-taken merged, preserving the existing deliberate non-distinction. Exclusive groups get the same split (uniformity chosen over showing all radio alternatives inline).
- **Exclusive groups**: radio-look controls; selecting one switches the active sibling off (the runtime already enforces this — the UI change makes it legible, no behavior change); clicking the selected radio clears it (at most one, possibly none). The existing explicit-target toggle contract (`traitId, enabled`) stays.
- **Counts and badges**: enabled-count badge per section; zero renders as a muted outline badge instead of the filled one. Counts recompute against filter matches while filtering.
- **Active summary line** (prototype winner): a single muted, truncating line — "N active: name, name, …" — above the sections, full list available on hover; hidden when nothing is active. The chip-strip and no-strip treatments were prototyped and rejected.
- **Default open state**: sections with at least one enabled trait start expanded, Disabled blocks always start collapsed, nothing persists across sessions — deliberately, so the save envelope and export shape are untouched.
- **Search/filter**: a compact filter field above the summary line matching trait name and player description; a non-empty query hides non-matching traits and sections and force-opens what remains, including Disabled blocks.
- **Trait rows**: name plus resolved player description; tapping the row toggles an inline signed stat-change list (hidden stats omitted, stat names resolved through the trait's own pins). Non-toggleable traits render without a control; past-turn viewing renders the same layout read-only with only that turn's held traits.
- **Placement**: this replaces the Traits tab body inside the right panel only; the Enter World selection modal is untouched.

## Testing Decisions

- Good tests here assert external behavior — what a player sees and what the section builder returns — never component internals or class names beyond stable accessible roles/labels.
- **Section builder (new pure seam)**: exhaustive combinatoric coverage — grouping, nesting depth to subheader paths, exclusive flags, empty-group hiding, ordering, flat/General cases. Prior art: the existing pure trait logic test suites.
- **Rendered behavior (existing seam)**: the right panel mounted in the existing GamePanels test harness (real providers, stubbed heavy views) — enabled-first split, Disabled collapse and counts, muted zero badge, summary line content and hiding, filter narrowing and force-open, default open state, radio semantics including deselect-to-none, read-only past turns.
- Exclusive auto-switch mechanics and stat reversal stay covered where they live today (the trait runtime suite) — no duplication at the UI layer.
- Every new guard is proven by reinstating the bug it guards (per the project test bar); no scenario-rigging.

## Out of Scope

- **The stat-reversal clamp bug** (both mechanisms: legacy saves without applied-value records paying out unearned reversals, and recorded clamps replaying against a moved value). Spun off as its own track; it fires identically today on manual toggles, so this UI work adds no new exposure.
- **Enter World modal changes** — it keeps its segmented paging layout; any later convergence can reuse the row rendering.
- **Persisting expand/collapse state** in the save or local storage.
- **The chip strip and no-strip treatments** — prototyped, rejected.

## Further Notes

- The full design was settled by a grilled decision tree (layout comparison, Disabled placement, exclusive semantics, scale target: unbounded community worlds) and a two-round UI prototype in the live app; the prototype file currently sits unshipped in the working tree and must be deleted when implementation lands (fold the winner in properly — prototype code was written without tests or polish).
- The runtime already silently retires exclusive siblings; the only behavior-adjacent change is that this becomes visible. Log lines that narrate the retirement stay as-is.
- No export-shape, save-shape, or version impact. No new screen or modal, so no dev-route entry is required.
