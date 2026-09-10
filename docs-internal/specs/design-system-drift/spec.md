# Design System Guide Drift

Status: done
Status note: Shipped on 2026-09-08 in 02e64080 (seven guide fixes), ccf08151 and 69a72664 (Find focus return), a0a1325e and 59d0370e (Settings reference states). An audit the same day compared every checkable claim in the Design System guide against the code it cites; nine deviated.

## Problem Statement

The Design System guide is the visual authority for Formamorph UI. Agents read it before composing a surface and trust its claims about production behavior. An audit found nine claims that the cited code does not support. Some name the wrong file. Some describe a behavior the production surface does not have. Some state a measure that does not exist. An agent that follows the guide in those places builds against a rule the app does not keep, or cites a source that does not hold the fact.

## Solution

Bring the guide and the code back into agreement. For seven claims the code is correct and the guide changes to match it. For two claims the guide states a rule the product wants and the code changes to keep it.

| # | Guide claim | Side that changes | Outcome |
| --- | --- | --- | --- |
| 1 | All palettes override the semantic status tokens | Guide | State that status tokens come from the base light and dark blocks and stay constant across palettes, matching the later sentence that already says so |
| 2 | Search exposes the complete node name in the Locations Canvas | Guide | State that search rows truncate and only the reference output exposes the full name |
| 3 | A host must return focus to a stable opener when the Find bar closes | Code | The World Editor returns focus to the element that had focus before Find opened, or to a stable fallback |
| 4 | The Settings reference shows all six states | Code | The Settings reference gains labeled Default and Selected examples |
| 5 | Font source is the settings defaults module | Guide | Cite where the app font variable is defined, set, and consumed |
| 6 | Hairlines separate formatting, history, and view groups | Guide | State that one hairline separates the view group and history sits at the row end |
| 7 | Fullscreen adds editing tools | Guide | State that fullscreen adds the toolbar, search, and minimap; drag, nesting, and the context menu work embedded |
| 8 | The canvas controls component owns the fullscreen toggle | Guide | State that the controls component renders zoom and fit, and the canvas supplies the fullscreen button |
| 9 | The editor keeps a 1rem internal text rhythm | Guide | Replace with the real measure: the label text role with its line height, and the editor surface padding |

## User Stories

1. As an agent, I want the guide's palette claim to match the stylesheet, so that I do not add status-token overrides to a new palette.
2. As an agent, I want the guide's font citation to point at the file that defines the variable, so that I find the mechanism on the first read.
3. As an agent, I want the toolbar composition rule to describe the shipped toolbar, so that I do not add a divider the product does not want.
4. As an agent, I want the canvas fullscreen claim to name what fullscreen adds, so that I do not gate editing behind fullscreen in a new surface.
5. As an agent, I want the canvas controls mapping to name the right owner of the fullscreen button, so that I extend the right component.
6. As an agent, I want the editor density claim to name a measure that exists, so that I can reproduce it.
7. As an agent, I want the canvas overflow row to state what search rows do, so that I do not promise a full name the search does not show.
8. As a World Editor author, I want focus to return to where I was when I close Find, so that I can keep typing or keep navigating without a mouse.
9. As a keyboard user, I want Escape in the Find bar to put focus back in the editor, so that focus does not fall to the document body.
10. As an agent, I want the live Settings reference to label every state the guide lists, so that I can compare a new surface against each one.
11. As a reviewer, I want the Default and Selected examples to use production rows and controls, so that the reference cannot drift from the app.
12. As a user of the guide, I want the palette rule stated once, so that two sentences do not contradict each other.
13. As an agent, I want each rewritten sentence to keep the Writing Guide's functional voice, so that the guide stays consistent.
14. As a reviewer, I want the two code changes covered by tests in existing suites, so that the rules cannot regress silently.
15. As a maintainer, I want the guide changes to carry no version pin and no reference to agent-only files, so that the wiki publish stays clean.

## Implementation Decisions

- The guide is edited in place. Each of the seven guide fixes changes only the sentence or table cell that carries the wrong claim. Surrounding rules stay as written.
- Item 1 removes the contradiction by making the foundations table cell agree with the later sentence about semantic colors across palettes. The later sentence is the correct statement.
- Item 5 cites the stylesheet for the variable definition, the settings context for where it is set, and the Tailwind config for where the sans stack consumes it. The settings defaults module remains the citation for the font registry only.
- Item 6 describes the toolbar as it ships: formatting group at the left, history at the right end, one hairline between history and the view controls.
- Item 9 names the real measure: the label text role with its line height and the editor surface's horizontal and vertical padding. No 1rem claim remains.
- Item 3 changes the World Editor's Find close path. Before opening Find, the editor records the active element. On close, focus returns to that element if it is still in the document, otherwise to a stable editor container. The Find bar component itself does not change; the host owns focus return, as the guide already states.
- Item 4 extends the Settings reference in the showcase. Two labeled examples are added to the state reference: Default shows a row with a valid initial value and normal border, Selected shows an option switcher with a selected segment. Both use the production settings rows and controls. The registry entry does not change.
- No production settings surface changes for item 4. The reference only demonstrates.
- No export shape, save shape, setting default, or version changes.
- The changelog gets one In Progress entry under the dev-tooling bucket for the Find focus return and the reference states. Guide-only edits get no changelog entry.

## Testing Decisions

- A good test drives the surface the way a user does and asserts what the user observes. It does not assert class names or internal state.
- Item 3: extend the existing World Editor or Find bar suite. Open Find from a focused field with the keyboard shortcut, close with Escape, assert that focus is back on that field. A second case removes the original field before close and asserts focus lands on the stable fallback, not the body.
- Item 4: extend the existing showcase suite. Render the Settings reference and assert that labeled Default and Selected examples are present and that the Selected example's segmented control has one selected item.
- Guide-only fixes get no automated test. The link checks that already run on the docs cover the new citations.
- Prior art: the Find bar reference suite and the showcase suite already render these surfaces with the real providers and assert focus and state by role.

## Out of Scope

- The three guide sections with no showcase registry entry: Compact Selection Lists, Searchable Group Picker, Scrollbars. Whether they get their own tabs is a separate decision.
- The navigation wording that says flexible columns where the code uses a grid.
- The partial claims that overstate the code: Find keys scoped to the bar, Replace skipping chip hits, reverse wrapping at the sm breakpoint only, the untested third-person rule, and the section title not using the typography export.
- The stale JSDoc on the tag component that says four rows.
- Delete Group having no destructive styling and no confirmation.
- Any app-wide alignment of existing screens to the guide.

## Further Notes

The audit's full findings live in the session that produced this spec. The two code fixes are small and independent of each other and of the guide edits. One agent can take all nine in one ticket, or the guide edits can go first as a doc-only commit.
