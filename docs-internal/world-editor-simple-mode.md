# World Editor — Simple / Advanced Mode

**Goal:** cut choice paralysis for new authors by thinning the World Editor's surface, without
removing anything an existing world already uses. Shipped; this file is the record of what it hides.

## The switch

| | |
|---|---|
| **Control** | Segmented control (ToggleGroup), editor header, beside the "World Editor" title |
| **Values** | `Simple` · `Advanced` |
| **Persistence** | Editor preference in localStorage. **Never** written to the world file — no export-shape impact |
| **Default** | `Simple` on first run, for everyone. Sticky once switched |
| **Scope** | The World Editor only. No gameplay, settings, or main-menu surface changes |

## Tabs

Simple mode hides **Placeholders** only. Every other tab, Dictionary included, is visible in both
modes — a lorebook is ordinary authoring; its tuning controls are what's advanced.

## Advanced-only fields

Everything not listed stays visible in Simple mode.

| Tab | Hidden in Simple |
|---|---|
| **Overview** | Custom Narration Prompt |
| **Stats** | Stat Code + Test Code · Stat Descriptors · Prevent AI Changes |
| **Entities** | Aliases · AI-Facing Summary · Type · 3D Model · Image Tags |
| **Locations** | AI-Facing Summary · Ambient Sound · Image Tags |
| **Traits** | Stat Availability · Placeholder Pins |
| **Dictionary** (entry) | Always inject · Regex · Recursive · Scan depth · Secondary Keywords + Require all / Exclude |
| **Dictionary** (book) | The Enabled toggle |
| **Dictionary** (tree) | Background/Foreground zone headings · every enable checkbox (book and entry) |

Simple keeps the entry's Name, Trigger Keywords, Value, and the **Whole words** and **Case-sensitive**
boxes under the same **Options** heading. A book keeps its Name and Description.

**Zones, flattened not merged.** Simple drops the zone headings and frames so a book's entries read as
one list, but each zone still owns its own drop target — an entry never silently changes where it sits
in the prompt. An empty zone renders nothing.

**Known limit:** with the enable toggles hidden, a book or entry that is already disabled can't be
re-enabled in Simple. It still renders faded, and the header icon flags the world.

Kept in Simple deliberately: Stats' Min/Max/Initial/Regen/Enabled **and Body Sliders**, Overview's
System Prompt Addition + 3D Player Avatar + BGM, Locations' nesting, trait groups incl. Exclusive.

Hiding Image Tags also drops the "use this image's embedded prompt as the tags?" offer on upload —
it writes the field Simple can't show.

## Simple means simple

**A hidden field stays hidden whether or not it holds a value.** An earlier draft revealed
non-empty advanced fields so nobody edited blind; it was dropped because it made the same tab look
different per item, and clearing the last value made the field vanish under the cursor mid-edit.

Uniform hiding is the rule for fields and tabs alike. The header icon is what prevents confusion:
a world with anything out of sight says so, and the switch is next to it.

## Placeholder traces

- The chip **palette bar** above every detail panel is hidden in Simple mode — no insert affordance.
- Chips already inside text **still render as chips**, so nothing looks corrupted or raw.
- Trait Placeholder Pins are hidden (already covered above).

## Lists and grouping

Simple mode is **flat** for Entities and Traits: the `+` adds an item directly instead of opening
the Add Group / Add Item popover. Existing groups still render and stay editable — the flat rule
governs *creation*, not display.

## Header hint

When the current world has data in **any** hidden surface (a placeholder, a dictionary entry, or
any hidden field non-empty anywhere in the world, a dictionary entry using a hidden option, anything
muted), an **info icon** sits beside the switch, captioned on
hover: "This world uses advanced features. Switch to Advanced to see them."

An icon rather than a line of text — the header is a single row in both layouts, and a sentence that
appears only for some worlds would push the tab strip down the moment it did. No action on it: the
switch is right there.

## Footer

On **Entities** and **Dictionary**, the two buttons split by mode: Simple offers **Add** only
(bringing a character or lorebook in from your library is beginner authoring), Advanced offers
**Export** alongside it (handing one to somebody else is not). **Optimize Images** is Advanced-only:
an oversized upload is already offered Optimize/Downscale as it lands (the trigger is the field's
size cap, not the file format), so the footer button only adds the bulk pass over an already-large
world. Export World and Save are unchanged.

## Mobile

Same header placement, compact (shortened labels or icon-sized). The mode is one preference across
viewports — mobile doesn't get its own.

## Help copy

No new help topic. Each tab's existing `HelpButton` topic gets a line naming which of its fields
are Advanced-only.

## Dev-router

`window.__fmDev.goto('worldEditor', { tab, mode })` — a `mode` param so UI verification can land
directly in either mode, instead of poking localStorage first.

## Test Bench

The Bench follows the same rule as the fields: **a finding whose repair needs a hidden field is
hidden too.** Every rule head carries an `advanced` marker (`lib/testBench/rules`), and a registry
test fails the build until a new rule declares one.

| In Simple | What happens |
|---|---|
| **Badge + new count** | Advanced-scoped findings excluded — the badge is a to-do list of things this mode can fix |
| **Issues list** | They aren't listed, so no **Fix** or **Open** can reach a field the author has never seen |
| **The fold** | One line at the bottom: *"N findings need Advanced mode"*, expanding to say the switch beside the title is the way in. Same interaction as the dismissed fold |
| **"No Problems Found"** | Suppressed while anything is folded — a world with hidden defects never reads as clean |
| **Check Stat Code** | Hidden — every verdict it raises is Advanced-scoped, so in Simple it would read as a button that does nothing |
| **Seen-state** | Only what was displayed is marked seen, so a folded finding is still **New** the first time Advanced shows it. Dismissals stay identity-keyed and mode-ignorant |
| **Triggers** | Inherits the same filter: alias hygiene is an Advanced field, and its inline **Fix** would rewrite one unseen |

Classification is per rule, not per finding — accepted cost: an `entity-match-collision` caused by an
alias still surfaces in Simple, where the name half of it is fixable.

## Out of scope

World *creation* is untouched. A new world is seeded exactly as today; Simple mode only changes
what the editor shows.
