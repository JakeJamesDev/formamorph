# Linked content help: a wiki page and an in-app help topic

Status: ready-for-human
Base: 72a604fa

## Problem Statement

A player meets linked content in four separate places: a **Linked** badge on an entity in the World Editor, an **Update Available** window that opens from the library, a **Linked Content** section in a community world's download window, and **Manage Add-ons** on their own listing. Each dialog explains its own step in one line. Nothing explains what a linked copy is, why a copy follows a library item, or what changes when it does. The only full description is the unreleased changelog entry, thirteen paragraphs written as release notes.

The player who sees **Linked** for the first time has no way to learn what it means without reading the changelog. The player who opens Update Available does not know what **Keep Mine** costs them later, or what **Unlink** leaves behind.

## Solution

One wiki page, **Linked Content**, tells the whole story in the reader's order: what a linked copy is, how a copy becomes one, what edits do to it, how updates reach it, what publishing and downloading carry, and how to repair a copy whose source is gone.

One in-app help topic, `library.linkedContent`, carries the same story as tabs. In the World Editor it opens once, on the first link a profile makes, and afterwards from the linked copy's footer menu as **About Linked Content…**. A `?` button mounts in the title bar of **Update Available** and **Update This World**. Each tab stands alone. The topic's **Learn more** link opens the wiki page.

## User Stories

1. As an author, I want the help to open on its own the first time I link a copy, so that I learn what Linked means the moment it first appears, and never again unasked.
2. As an author, I want the help to say that a linked copy follows a library item, so that I know edits to the library item reach this copy.
3. As an author, I want the help to say what a local replacement is, so that I know my edit stopped updates from overwriting this copy.
4. As an author, I want the help to name every way a copy becomes linked, so that I know Save to Library, Add from Library, and Import all create the same link.
5. As an author, I want the help to say what Unlink leaves behind, so that I know the copy keeps its content and follows nothing.
6. As an author, I want the help to say what Open in Library does, so that I know where the source lives.
7. As an author, I want the help to explain Connect World References, so that I know why a step asks me what a Placeholder or location means in this world.
8. As an author, I want the help to explain Save Connections, so that I can point a copy's references somewhere else after I remove a Placeholder.
9. As a player, I want a `?` on Update Available, so that I understand Update, Keep Mine, Use Author's, and Unlink before I press Apply Updates.
10. As a player, I want the help to say that Keep Mine remembers the revision I answered for, so that I know the same update does not come back.
11. As a player, I want the help to say that Cancel applies nothing, so that I can close the window without fear.
12. As a player, I want a `?` on Update This World, so that I know why a world update lists linked copies and what New Required Content and No Longer Required mean.
13. As a player, I want the help to say that a local replacement starts on Keep Mine, so that I know my edits survive a world update by default.
14. As a player, I want the wiki page to explain Required, Approved Add-ons, and Unreviewed add-ons, so that I know what a world download installs and what I choose.
15. As a player, I want the wiki page to say that a declined add-on stays downloadable on its own, so that I can still install it from its listing.
16. As a player, I want the wiki page to say that downloading a world places its required items in my library, so that I know where they went.
17. As an author, I want the wiki page to explain Include as required on the publish dialog, so that I know what my players download with the world.
18. As an author, I want the wiki page to explain Offer as add-on and the review states, so that I know what happens after I offer my entity for someone's world.
19. As an author, I want the wiki page to explain Manage Add-ons, so that I know what Approved, Unreviewed, and Declined do to my world's download.
20. As an author, I want the wiki page to explain Check Sources and the three repairs, so that I can repair a copy whose source was removed.
21. As a player, I want the wiki page to say why Enter World is off while a required source is gone, so that I know the way back is Repair Sources.
22. As an author, I want the wiki page to explain Link bundled content to my library, so that I know what an imported world file does with the content it carries.
23. As an author, I want the wiki page to say what removing a library item does to the worlds that follow it, so that I know no world breaks.
24. As a reader, I want the page in the wiki sidebar and on the Home table, so that I can find it without a link from the app.
25. As a reader, I want the help topic's Learn more to open the Linked Content wiki page, so that the short version leads to the full one.
26. As a reader, I want each help tab to stand alone, so that the first tab I land on gives me the essentials.
27. As a reader, I want the help and the wiki to use the same words as the dialogs, so that Approved, Unreviewed, Declined, linked copy, local replacement, and library item mean one thing everywhere.
28. As a maintainer, I want a test that every wiki page a help topic names exists in the docs folder, so that a renamed page cannot leave a dead Learn more link.
29. As a maintainer, I want a test that pins the topic id each mount asks for, so that a renamed id cannot silently remove the button.
30. As a phone user, I want the `?` to fit in the dialog title bar at phone width, so that the title does not wrap under the button.

## Implementation Decisions

- **One topic, tabbed.** The registry gets `library.linkedContent` with tabs, in this order: **Linked Copies**, **Updates**, **Publishing**, **Downloading**, **Repairs**. The first tab holds what a linked copy is, how one is made, and what a local replacement and Unlink are. Every mount shows the same topic. The dialog a reader opened decides which tab they read first, and each tab stands alone.
- **Wiki page `LinkedContent`.** A new page under Reference in the sidebar, with a Home table row. Its sections match the tab order. The help topic names it as its `wikiPage`, with no anchor.
- **Mounts.** Three: an **About Linked Content…** item first in the linked copy's footer menu, the Update Available title bar, and the Update This World title bar. The editor also opens the topic on its own once, when the session's first link lands and the topic has never been opened; opening marks it seen, so the nudge never repeats. A `?` beside the Linked badge was tried and rejected: it forced the badge row to button height. The badge-and-source header went with it: the state and the source now read from the footer button's tip and the row marker's tip, through one shared status line. The download window and Manage Add-ons get no button in this spec.
- **The `?` in a dialog title bar** sits at the header's trailing edge, before the close control, the way the Memory Manager mounts it. The help pop-out opens as a second dialog over the review dialog.
- **Copy register.** The topic body and the wiki page use the terms the Writing Guide registers: library item, linked copy, independent copy, local replacement, source, add-on, bundled content. Approved, Unreviewed, and Declined are the three review words. The tone follows the existing help topics: lead with what it is, then why it exists, then the controls that are not self-evident. The wiki page uses the human formatting the other pages use: short sections, a table for the three link states and one for the four update actions, callouts for the traps.
- **Traps the page names.** A republished source is a new listing and never reconnects on its own. Keep Mine remembers one revision, so the next revision asks again. The file's content always wins on import. Removing a library item leaves independent copies.
- **Changelog.** One 👤 In-Progress entry for the help button and the page.

## Testing Decisions

- A good test reads the rendered dialog or the registry as the reader does. It asserts the button's accessible name, the tab labels, and the Learn more target. It does not assert sentence text beyond the tab labels.
- **Registry drift guard.** Extend the help-topic test: for every topic with a `wikiPage`, a file `docs/<wikiPage>.md` exists. This guards every existing topic too.
- **Mount pins.** One test per mount, in the pattern of the entities-topic pin: the review dialogs render a button named "About Linked Content", and the linked copy's menu holds the item. The nudge has three cases: a fresh profile's first Save to Library opens the dialog and records the topic as seen; a profile that has seen it links in silence; the menu item opens it on demand.
- **Prior art.** The help-topic registry tests, the Memory Manager help mount, and the review dialog tests that already render each dialog with a fixture review.

## Out of Scope

- A `?` on the download window's Linked Content section, on Manage Add-ons, or on Connect World References.
- Tutorial popovers for the Linked badge or the Add split button.
- Changes to any dialog's own body copy.
- Rewriting the changelog entry.
- Anchors from individual tabs to wiki sections.

## Further Notes

The changelog entry for the feature is the source for the page's content. Write the page from it and from the dialogs, not from the spec's design prose, so the page claims only what shipped.
