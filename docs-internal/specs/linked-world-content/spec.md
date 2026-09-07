# Linked world content: dependencies and optional add-ons

Status: needs-info
Status note: The author confirmed the main UI checkpoint after four remaining-decision rounds. This is not implementation authorization; unresolved edge cases, contracts, and proposed testing boundaries must be reviewed before implementation tickets become ready-for-agent. The exploratory prototype has not been updated to represent every subsequent UI decision.

## Problem Statement

Moving a dictionary from a world into the local library currently requires exporting a JSON file and importing it from the main menu. That is unnecessary friction for a local operation.

The larger need is reusable content: an author should maintain entities and dictionaries shared across a series of worlds without repeating edits. Other authors should be able to publish optional extensions for those worlds. Players must still be able to download, customize, and keep their own content without an upstream update silently replacing their work.

## Solution

Introduce linked entities and dictionaries with separate rules for **authorship**, **world requirements**, **optional compatibility**, and **local customization**. The editor's save-to-library shortcut becomes one way to establish a local link.

### Terms used in this proposal

| Term | Meaning |
| --- | --- |
| Component | An entity or dictionary; not executable plugin code. |
| Source | The original component a linked copy follows. A published source belongs to its component author. |
| Required dependency | A component the world author explicitly declares necessary for the world's initial intended configuration. |
| Optional add-on | A component offered for a world but installed only when the player selects it. |
| Compatibility declaration | An add-on author's association with a world. It does not modify that world's requirements. |
| Author-approved add-on | Optional content endorsed by the world author. Approval does not transfer ownership. |
| Community add-on | Compatible optional content the world author has neither approved nor declined. |
| Declined add-on | Compatible content explicitly declined by the world author; excluded from that world's download review but still independently downloadable and linkable. |
| Local replacement | A player's edited version of a component in one world, retaining source tracking until explicitly unlinked. |
| Independent copy | Content with no active synchronization relationship. |

### Relationship authority and download behavior

**World authors declare dependencies; component authors declare compatibility.** Authorship alone does not make a component required. A world author may offer optional extras too.

| Relationship | Authority | Downloading the world |
| --- | --- | --- |
| Required dependency | World author | Download and link automatically as part of the world download. |
| Author-approved add-on | Add-on author declares compatibility; world author approves it | Offer in an Author-approved add-ons tab; download and link only selected items. |
| Unreviewed community add-on | Add-on author declares compatibility; world author has neither approved nor declined it | Offer in a separate Community add-ons tab; download and link only selected items. |
| Declined add-on | World author declines the compatibility offering | Exclude from that world's download review. Players may download and link it separately. |

Downloading an add-on offers its associated world but does not require or automatically download that world. Publishing an add-on cannot impose downloads on someone else's world. Players can explicitly unlink dependencies and add-ons after installation.

World-author review has three distinct states: unreviewed, approved, and declined. Declining an add-on excludes it from all optional offerings in that world's download review; it does not merely move it to the Community tab. Independent discovery/download and manual linking remain available, with a clear **Not recommended by the world author** label for the affected world. A decline is a recommendation decision, not a deletion or ban on the component.

**Canonical example:** User A publishes World A. User B publishes Entity B as compatible with World A. Entity B appears as an optional community add-on. User A may approve Entity B, moving it into the approved category without making it required. User A separately declares Entity A required; downloading World A installs and links Entity A automatically. Downloading Entity B alone merely offers World A.

### World-author add-on review

The world's add-on review list uses one three-way segmented control per item, ordered **Approved | Unreviewed | Declined**. Unreviewed occupies the center, so decisions stand out to either side when scanning a long list. Exactly one state is selected; choosing the current state does not toggle it off.

The list supports sorting and filtering and defaults to an **attention list: Unreviewed or Updated since review**. Sort oldest waiting first, based on when the association began needing attention. Offer newest waiting, recently updated, name, and author sorting too. Other review states remain reachable through filtering.

Review state applies to the add-on's association with this world. Approval leaves it optional; declaring a required dependency is a separate operation. Published updates preserve Approved/Declined status, add **Updated since review**, and put the association back in the default attention list. Declined content remains excluded from world-download offerings. **Mark reviewed** acknowledges the current revision without changing the decision; changing the decision also acknowledges it. Viewing content alone does not mark it reviewed. Open **Manage Add-ons** from the author's published-world actions.

Review decisions and Mark reviewed acknowledgments are staged. **Save Changes** applies them; clicking a segment does not immediately publish the decision. Keep pending rows visible in the current list until saving succeeds, label them **Pending change**, and offer **Discard Changes**. This supersedes the earlier immediate-save/Undo proposal.

### Local authoring

- Offer the save-to-library action in both editor modes, with the whole dictionary/entity selected. A dictionary entry selection does not imply saving its containing dictionary.
- Save the selected component to the local library immediately. Commit its new world link on the next world save. Canceling world edits leaves the library item but discards the pending world link.
- When adding library content to a world, offer linked or independent, defaulting to linked.
- Saving an author's linked content synchronizes their local library and linked worlds in both directions. Saving is distinct from publishing.
- Resolve competing saved edits explicitly, with a comparison and choices to retain either version or preserve the local edit as an independent copy. No silent last-save overwrite.
- Unlinking keeps the current content. Deleting a local library item leaves independent copies in its linked worlds. Removing a component from one world does not delete its source or other worlds' copies.
- Synchronize dictionary-owned Placeholders. World-owned references use the resolution flow below; their values remain specific to each world.

### Editor split buttons and file import

Use the existing split-button interaction pattern, such as Re-generate, for the two content actions in the editor footer. Apply the same pattern to entities and dictionaries in both editor modes.

| Selected content state | Primary action | Dropdown actions |
| --- | --- | --- |
| Not linked to the library | **Save to Library** — save and link the selected content | **Export Entity…** / **Export Dictionary…** |
| Already linked to the library | **Open in Library** — open the linked library item | **Export Entity…** / **Export Dictionary…**, **Unlink** |
| Adding content to the world | **Add Entity** / **Add Dictionary** — choose from the library | **Import Entity…** / **Import Dictionary…** |

The Save to Library tooltip explains that the action creates a linked library copy. The already-linked primary action opens the existing item rather than creating another copy. Unlink preserves the world's current content. Selected-content actions require the whole entity or dictionary; Add/Import remain actions for bringing content into the world.

Export writes the selected content in its appropriate supported file format using the existing file-export flow. Import opens the appropriate file picker, reads the chosen file, and presents a small review:

1. Show the content name.
2. Offer **Link through my library**, checked by default.
3. Confirm with **Add Entity** / **Add Dictionary**.

With linking checked, create the library copy and add a linked instance to the world. With linking unchecked, add an independent instance directly to the world without creating a library item. Resolve world Placeholder references using the flow below. World changes, including the new link, follow the world-save boundary described above.

### Add-from-library picker

The Add Entity / Add Dictionary picker lets the author select library content, review a **Link to library** checkbox (checked by default), and confirm with **Add Entity** / **Add Dictionary**.

| Selection | Explanation |
| --- | --- |
| Own content, linking checked | “Saved changes stay synchronized across your linked worlds.” |
| Another author's content, linking checked | “Receive source updates. Your edits stay specific to this world.” |
| Linking unchecked | “Add an independent copy.” |

After confirmation, unresolved world Placeholder references open the reference-resolution step below. When every reference already has a valid connection, no additional step is needed. Library selection and file import share the linked-versus-independent choice; choosing an existing library item does not create another library copy.

### World Placeholder reference resolution

A linked component names the world Placeholder it needs, while each receiving world supplies the value. Resolve the reference once when linking rather than relying on a raw brace expression or matching independently created IDs.

1. Suggest a matching world Placeholder for each required world-owned reference.
2. Let the author choose an existing world Placeholder, including one with a different name, or create a new world Placeholder when no suitable match exists.
3. Remember the connection for that linked component in that world across component updates. Preserve the destination world's values; source updates do not overwrite them.
4. Flag missing or broken connections as reference issues and offer the same choose-existing/create-new repair flow. Newly introduced references need resolution; established connections remain intact.

For example, a dictionary's `capital` reference can connect to World A's **Capital** and World B's **Royal Seat**. Each world resolves its own value. Raw braces are explanatory notation here, not an approved change to the Chip format.

This is the agreed reference-issue resolution flow for world-owned Placeholders used by linked content. Do not silently copy source-world values or replace unrelated world definitions.

#### Connect World Placeholders dialog

Show one row per unresolved world-owned reference, with **Content expects** and **Use in this world** columns. Each destination selector offers existing world Placeholders and **Create new…**. Preselect a matching suggestion when available and show a preview of the destination's values beneath it.

- **Connect & Add** confirms the connections and finishes adding the content. Keep it disabled until every required connection is resolved; do not insert incomplete content into the world first.
- **Back** returns to content selection without losing the user's choices.
- For existing content with broken references, reuse the dialog with **Save Connections** as the confirmation label.

The library/file selection confirmation starts this step when needed; insertion into the world waits for connection confirmation. Exact matching rules, incompatible nested references, and validation gates for operations other than adding content remain open.

### Publishing and updating

- Only the component's author publishes changes to its source. World-author approval of an add-on does not grant editing rights to that source.
- World authors may require another author's published component without a separate permission step. They control the requirement; the component author retains source ownership and publication control.
- Publication is explicit. Published worlds immediately resolve the latest published linked content, without requiring each world to be republished.
- Do not introduce retained server-side content versions or version pinning to support this feature. Revision markers for detecting changes are a separate implementation concern.
- Publishing a world can publish its linked components in the same action. Components may be publicly listed or unlisted but accessible through the world.
- Downloaded worlds retain installed content until updated. Offer component updates independently as well as through world updates.
- Preserve the existing ability to download a separate world copy. A world update that encounters edited linked components offers one combined conflict review rather than repeatedly prompting for every component.

### World publishing review: Linked Content

Declare published dependencies in a **Linked Content** section of the world's publishing review. List the entities and dictionaries already linked to library content, with an **Include as required** checkbox per item.

- Checked: downloading the published world also downloads and links the component source as a required dependency.
- Unchecked: include the content embedded in the published world without a required source relationship. Offering that component as an optional add-on is a separate choice.
- For an unpublished source owned by the world author, show **Will publish with this world** and a **Public / Unlisted** choice alongside it. Default to **Unlisted** when first publishing it as a dependency; preserve the choice on later publications.

These publication choices determine the relationships delivered to other users; they do not discard the author's local editing links. **Include as required** starts checked for linked components on first publication; subsequent publications preserve the author's choices. The immediate published-update rule applies to published source relationships, not content published as an embedded copy.

### Component publishing: Compatible Worlds

The entity/dictionary publishing form derives **Compatible Worlds** from actual local links. List only worlds that contain a linked instance of this component and have an identifiable published counterpart. Do not add a separate published-world search feature.

- Each eligible world has an **Offer as add-on** checkbox. Local use alone does not advertise compatibility; publication applies the author's selections.
- Associate the offering with the world's published identity, not its local copy identity.
- Show **Approved / Unreviewed / Declined** beside existing associations; the component author cannot change the world author's review decision.
- No eligible worlds does not prevent standalone component publication.

This includes another author's world: download World A, link Entity B into the local world, then publish Entity B with World A selected. If the eligible local link is removed, show that existing compatibility association as a pending removal in the next publishing review. The public association changes only on **Publish**.

### Player edits and update conflicts

Editing someone else's linked component creates a **world-specific replacement** by default. Saving that replacement to a personal library is a separate action. It does not publish to the original source or alter other worlds.

| Local state | Incoming source update |
| --- | --- |
| Linked, unmodified | Apply through the player's chosen update action. |
| Local replacement, source tracked | Compare versions; retain the local version or use the author's version and resume synchronization. |
| Independent / explicitly unlinked | Do not apply source updates or continue source-update notices. |

Keeping a local replacement retains its source association for future update offers. Accepting the author's version replaces the local content and resumes following the source. Update prompts must identify the affected world and component.

### Linked state and update entry points

Show a small link indicator in the editor list and a status label in the selected component's header: **Linked**, **Local replacement**, or **Link pending save**, with the source name available in the header.

Offer **Check linked content updates** in the world's actions and **Check for updates** in each linked component's split-button dropdown. Retain the Community browser's existing update indicators. Checks are user-initiated; do not add checks on editor open, game launch, or a background schedule. Creator-follow notifications are separate, and notifications for downloaded content are outside this feature's scope.

### Review Updates dialog

Review the affected world's component updates in one dialog, with an action dropdown for each listed component and a default selection appropriate to its state.

| Content state | Default action |
| --- | --- |
| Linked, unmodified content with an update | **Update** |
| Locally edited content with an update | **Keep mine** |

For locally edited content, the dropdown offers **Keep mine** and **Use author's**. Keeping the local version retains source tracking; using the author's version replaces the local content and resumes synchronization. **View changes** shows changed fields with current and incoming values together, with an option to expand unchanged content. Dictionaries group added, changed, and removed entries. Independent content is excluded from the review.

The player chooses the desired action for each item, then confirms with **Apply Updates** to execute those selections. Dropdown changes do not mutate content before confirmation. **Cancel** applies none of the proposed actions. A single-component update uses the same review with only that component listed. If the batch partly fails, retain successful updates, show the failed items with **Retry**, and preserve each failed component's previous installed content. Additional dropdown actions remain to be designed.

When a downloaded library component update affects multiple linked worlds, review all affected worlds together before applying changes. Each world's local replacement defaults to **Keep mine**. Make the affected world identity visible for every choice; do not silently propagate the library update outside the reviewed scope.

### Missing sources and offline use

- A confirmed deleted or inaccessible required source blocks new games and publishing until repaired, replaced, removed, or explicitly unlinked. Keep the editor available for repair.
- A network failure is not evidence that a source was deleted. Allow offline use of installed content; do not require a successful check on every launch.
- Unavailable optional add-ons do not block downloading the world. Handling already-installed missing optional add-ons is an open detail below.
- Existing saves follow the current world-update/save-loading behavior. Do not introduce a separate playthrough synchronization feature or a new missing-source block on resuming saves.

The missing-required-source repair dialog uses one action dropdown per affected component, followed by **Apply Repairs**. Offer replacement from the library, unlinking while keeping installed content, and removal from the world. Start with no repair selected; do not mutate content before explicit confirmation.

Open repairs from the blocked action and the editor's issue list, in both editor modes. An installed optional add-on whose source is confirmed missing retains its content and source association, displays **Unavailable**, and offers optional repair without blocking play. Unlinking or removal remains an explicit player action.

If a required component fails during an initial world download, keep the download pending and retain completed component downloads for retry. Do not present the incomplete world as ready. If only selected optional add-ons fail, finish the world download and offer **Retry** for those add-ons. Missing-source state on installed content comes from explicit operations; no new automatic source polling is introduced.

When publishing a world with components, retain successful component publications if a later component fails. Withhold world publication until required sources are ready and offer **Retry** for the failures; do not automatically undo successful component publications.

## User Stories

1. As a world author, I want to save a selected dictionary directly to my library, so that I avoid a JSON export/import round trip.
2. As a world author, I want the equivalent action for entities, so that both reusable content types behave consistently.
3. As a world author, I want the action in both editor modes, so that reuse does not depend on Advanced mode.
4. As a world author, I want saving a component to avoid saving unrelated pending world edits, so that I control when the world is saved.
5. As a world author, I want to add a linked or independent library component, so that reuse does not force synchronization.
6. As a series author, I want one saved local component to update my linked worlds, so that shared lore stays consistent.
7. As a component author, I want local saving separate from publication, so that unfinished edits stay local.
8. As an author with competing editor changes, I want an explicit conflict choice, so that neither edit is silently lost.
9. As a world author, I want to declare required dependencies, so that initial downloads preserve my intended configuration.
10. As a world author, I want my own optional components to remain optional, so that authorship does not imply necessity.
11. As another author, I want to declare my component compatible with a world, so that I can extend it without changing its requirements.
12. As a world author, I want to approve an add-on, so that players can distinguish my endorsement from a community claim.
13. As an add-on author, I want approval to leave ownership with me, so that I retain control of my component.
14. As a player, I want required components included in a world download, so that its initial configuration is complete.
15. As a player, I want approved and other community add-ons in separate tabs, so that endorsement is clear.
16. As a player, I want optional downloads limited to my selections, so that compatibility never becomes forced installation.
17. As a player, I want downloading an add-on to offer its world without requiring it, so that I can use content independently.
18. As a world author, I want to publish linked components alongside my world, so that publication is one coordinated action.
19. As a component author, I want public or unlisted publication, so that world dependencies need not clutter public discovery.
20. As a component author, I want published changes to immediately reach linked published worlds, so that I do not republish a whole series.
21. As a player, I want component updates separately from world updates, so that I can refresh shared content directly.
22. As a player, I want installed content to remain stable until I update it, so that remote publication does not silently edit my local world.
23. As a player, I want edits to another author's component to stay in my current world, so that customization does not affect other worlds.
24. As a player, I want to save my replacement to my library separately, so that I can choose to reuse it.
25. As a player, I want a combined review of update conflicts, so that a world with many components remains manageable.
26. As a player, I want to keep my local version while tracking its source, so that I can reconsider future author updates.
27. As a player, I want to accept the author's version and resume synchronization, so that I can return to maintained content.
28. As a player, I want the option to download a separate world copy, so that I can inspect an update without replacing my current world.
29. As a player, I want explicit unlinking to retain content and stop source tracking, so that I can take full local control.
30. As a library owner, I want local library deletion to preserve world contents, so that organizing the library does not destroy worlds.
31. As a world owner, I want removing one component to affect only that world, so that unrelated content remains intact.
32. As a world owner, I want to connect a component's world-owned references to existing or newly created world Placeholders and retain those connections across updates, so that shared content uses my world's values without rewriting unrelated lore.
33. As a player, I want installed worlds to work offline, so that a failed update check does not prevent play.
34. As a world owner, I want confirmed missing required content to be identified, so that I can repair it before starting a new game or publishing.
35. As a world owner, I want the editor to remain available when a dependency is missing, so that I can repair or unlink it.
36. As a player, I want unavailable optional content not to block the world download, so that an add-on cannot disable its associated world.
37. As a player with an existing save, I want current save-loading behavior preserved, so that this feature does not impose a new playthrough-update system.

38. As an author, I want Save to Library and Add content as split-button defaults with Export and Import in their dropdowns, so that common local actions stay prominent while file operations remain available.
39. As an author importing a file, I want to review its name and choose whether to link it through my library, so that I can add either reusable linked content or an independent world instance.
40. As an author selecting linked content, I want Open in Library and an Unlink option, so that I can manage the existing relationship without accidentally creating another library copy.

41. As an author adding library content, I want a default-on link choice with ownership-aware wording, so that I understand whether edits synchronize my own worlds or stay local while tracking another author's updates.
42. As an author adding content with world Placeholder references, I want resolution only when connections are unresolved, so that valid connections do not create an unnecessary extra step.

43. As an author resolving world Placeholder references, I want destination suggestions, value previews, and a create-new option in one dialog, so that I can verify the connections before adding content.
44. As an author, I want Back to preserve my choices and Connect & Add to require complete connections, so that navigation is reversible and newly added content has no unresolved required references.

45. As a world author, I want to decline an add-on and exclude it from my world's download review, so that downloading my content does not promote content I have rejected.
46. As a player, I want to download and link a declined add-on independently with a clear world-author recommendation label, so that I retain control without mistaking compatibility for endorsement.

47. As a world author, I want Approved, Unreviewed, and Declined arranged in a three-way control with Unreviewed centered, so that review decisions stand out while scanning a long list.
48. As a world author, I want a sortable and filterable add-on review list that initially shows Unreviewed and Updated since review items, oldest waiting first, so that I can quickly find content needing attention.

49. As a world author, I want a Linked Content section in publishing review with an Include as required choice per linked component, so that I explicitly control the dependencies delivered with my world.
50. As a world author, I want unchecked components embedded without a required source relationship, so that local editing links do not force public dependencies.
51. As a world author, I want unpublished owned sources marked Will publish with this world with a Public/Unlisted choice, so that I can review their publication alongside the world.

52. As a component author, I want Compatible Worlds derived from worlds actually linked to my component that have published counterparts, so that compatibility choices reflect my working content without a separate search.
53. As a component author, I want to explicitly select Offer as add-on and publish that choice against the world's published identity, so that local use does not automatically advertise compatibility.

54. As a player reviewing updates, I want an action dropdown with an appropriate default for each component, so that I can choose all outcomes before committing them together.
55. As a player, I want Apply Updates to execute my selections only after confirmation and Cancel to leave content unchanged, so that reviewing choices does not itself modify my world.

56. As a world author, I want to stage review decisions and acknowledgments while pending rows remain visible, so that I can inspect the batch before saving or discarding it.
57. As a player, I want explicit world/component update actions and visible editor link states, so that I control checks and understand which content is linked or locally replaced.
58. As a player, I want update review to show all affected worlds and changed content first, so that I can judge the full effect before applying it.
59. As a player, I want successful operations retained and failed items retryable, so that a partial failure does not discard completed work or damage prior installed content.
60. As a player, I want unavailable optional content to remain usable with its source association intact, so that its disappearance does not block my world or silently unlink my content.

## Implementation Decisions

### Agreed behavioral constraints

- Keep local author synchronization, published source resolution, and player-installed updates distinct. Two-way local author synchronization does not authorize another user to modify a published source.
- Represent dependency declarations separately from compatibility and world-author review (unreviewed, approved, declined). An optional compatibility claim cannot become a required dependency merely because it points at a world. Declined offerings must be excluded from that world's download review while remaining independently downloadable/linkable.
- Distinguish local instance identity, published source identity, source-change tracking, and local replacements. Display names alone cannot establish a link.
- Track enough information to recognize competing edits and offer a meaningful comparison. Exact revision and conflict contracts remain open.
- Keep gameplay state separate from authored world data. No gameplay write-back to the authored world.
- Preserve entity-owned location membership. Cross-world location references need an explicit mapping contract; this proposal does not reverse ownership.
- Persistent published relationships require serialization and API design. No field names, endpoint shapes, storage layout, version bump, or migration has been approved by this checkpoint.

### Proposed implementation boundary — not yet reviewed

Extend the existing download/update coordination boundary to orchestrate a complete world/component operation: resolve sources, obtain required content, review local conflicts, and commit the selected result. Reuse the existing world/library storage and catalog publication boundaries rather than distributing relationship decisions across editor buttons.

Keep remote authorship enforcement at the catalog mutation boundary. Local UI restrictions alone are insufficient to establish source ownership or dependency authority. Exact server integration requires investigation before tickets are estimated.

## Testing Decisions

**Proposed, not yet user-reviewed.** The conversation settled outcomes, not a production test architecture. This checkpoint records the recommended seams without treating them as approved implementation work.

- Prefer operation-level integration checks through the existing download/update coordinators and their storage effects. Keep the public operation as the main local seam; substitute external catalog transport when needed.
- Cover ownership and relationship mutations through the catalog API boundary, exercising requests by different actors. Do not simulate authorization solely by hiding buttons.
- Verify visible download selection and conflict choices through the existing community-browser/editor interaction surfaces. Test resulting installed content, identities, and saved relationships rather than component internals.
- Reuse dictionary file/Placeholder import and library identity tests for portability and collision protection. Check pre-game selection for accidental double activation of a linked library/world pair.
- Drive real production operations once implemented. Do not copy the prototype's transitions into tests or treat its sample revision text as a production contract.
- Keep failure triggers intact: exercise interrupted downloads and conflicting writes, then assert recovery and preserved data. Measure coverage and prove important guards fail when their bug is reintroduced. Time every run and investigate leaked-process gaps.

### Acceptance scenarios to cover

| Scenario | Observable result |
| --- | --- |
| First local save-to-library, then cancel world edits | Library item exists; new world link was not committed. |
| Editor entity/dictionary split buttons | Save to Library and Add are defaults; dropdowns expose the appropriate Export and Import actions. |
| Select content already linked to the library | Primary action opens its existing library item; dropdown offers Export and Unlink; no duplicate library item is created. |
| Import a file with linking checked | Review shows content name and a checked link option; confirmation creates a library copy and linked world instance. |
| Import a file with linking unchecked | Confirmation adds an independent world instance without a library copy. |
| Add content from the library | Link to library defaults on; ownership-aware wording explains synchronization; unchecked adds an independent copy without duplicating the library record. |
| Confirm addition with unresolved world Placeholder references | Open reference resolution; skip the extra step when all connections are valid. |
| Resolve references before addition | Suggested destinations and value previews are visible; Connect & Add stays disabled until all required connections resolve; content is not inserted early. |
| Go back from connection review or repair existing content | Back retains choices; existing-content repair uses Save Connections. |
| Save an author's linked content, then publish | Local linked worlds change on save; published worlds change on publication; player copies await an update action. |
| User B publishes compatibility with World A | Optional community offering appears; World A's requirements are unchanged. |
| World author approves an add-on | Discovery category changes; ownership and optional status do not. |
| World author declines an add-on | It appears in neither optional tab of that world's download review; independent download/link remains available with Not recommended by the world author labeling. |
| Open world-author add-on review | Default attention filter shows Unreviewed or Updated since review, oldest waiting first; each item uses Approved / Unreviewed / Declined in that order with one selected state. |
| Approved or declined add-on receives an update | Preserve its decision, mark Updated since review, and include it in the attention list; declined content stays excluded from the world's download review. |
| Some selected updates fail | Keep successes, preserve old content for failures, and offer Retry for failed items. |
| Repair missing required sources | Per-item repair dropdowns start without a selected repair; Apply Repairs explicitly commits the choices. |
| Stage an add-on decision or Mark reviewed | Keep the row visible as Pending change until Save Changes succeeds; Discard Changes cancels the pending changes. |
| Inspect changes | Show changed fields first, with unchanged content expandable and added/changed/removed dictionary entries grouped. |
| Update a library component used in multiple worlds | Review all affected worlds together and default each local replacement to Keep mine. |
| Download or publish partially succeeds | Required-download failures keep the world pending; optional failures permit completion; publication successes remain while the world waits for required sources. Offer retry for failures. |
| Installed optional source disappears | Preserve installed content and tracking, show Unavailable with optional repair, and do not block play. |
| Open a linked world or start a game without requesting updates | Do not initiate automatic source checks or downloaded-content notifications. |
| Review linked content during world publication | Each linked entity/dictionary has Include as required; checked publishes a required source relationship, unchecked embeds content without that relationship. |
| Review an unpublished owned source with the world | Show Will publish with this world and Public/Unlisted selection. |
| Publish a component with eligible linked worlds | Compatible Worlds lists only linked worlds with published counterparts; selected Offer as add-on choices publish against the remote world identity. |
| Publish a component without eligible worlds | Standalone publication remains available; no world-search step is required. |
| Download world with no optional selections | Required content is installed and linked; optional content is absent. |
| Download world with selected add-ons | Only selected optional content is installed, alongside requirements. |
| Download Entity B alone | Entity B installs; World A is offered and remains optional. |
| Edit one installed component, then update | Other worlds and the source are unchanged; edited content requires a conflict choice. |
| Review component updates | Each item has an action dropdown; unmodified content defaults to Update and locally edited content to Keep mine; independent content is excluded. |
| Change update selections, then cancel or confirm | Selections alone change no content; Cancel applies nothing; Apply Updates executes the selected per-item actions. |
| Keep local replacement, then receive another update | Local text remains; source tracking continues and a later update can be reviewed. |
| Accept source or explicitly unlink | Accept resumes synchronization; unlink preserves content and stops source tracking. |
| Competing author edits | Conflict resolution preserves a recoverable choice; no silent overwrite. |
| Source check fails offline | Installed content remains usable; no false missing-source state. |
| Required source is confirmed missing | New games/publishing are blocked; repair editor and existing-save loading remain available. |
| Optional source is unavailable | Initial world download is not blocked. |
| Component references world-owned Placeholders | Suggest a match; let the author choose existing or create new; retain the connection and world-specific values across updates. |
| World Placeholder connection is missing or broken | Surface a reference issue with the choose-existing/create-new repair flow. |

## Out of Scope

- Implementing the feature as part of this documentation task.
- Treating the prototype as production code, reusable architecture, final app styling, or proof of release readiness.
- Executable plugins, dependency package managers, server-side historical content versions, and version pinning.
- Automatic publishing on local save, automatic unrequested optional downloads, and background replacement of player edits.
- A new synchronization system for existing playthroughs.
- Unapproved export/schema changes, save/world migrations, or version changes.

## Further Notes

### Open design and engineering questions

These are recorded for continued design work, not answered by prototype behavior.

1. **Dependency scope:** third-party published dependencies are allowed without an additional permission step. Source ownership stays with the component author; no special availability guarantee has been specified.
2. **Relationship editing:** how do authors add/remove requirements, revoke compatibility or approval, and migrate installed worlds when the declared relationship changes? How should an add-on associated with several worlds offer them?
3. **Publication authority:** publishing a world together with linked content must not republish someone else's source. Owned required components can publish together; successes persist on partial failure while world publication waits for required sources. Define the server authorization and retry contracts.
4. **Unlisted discovery:** how do unlisted sources interact with compatibility lists, approval, access checks, moderation, and deleted accounts? Public approval cannot silently widen the source's access.
5. **Atomicity and recovery:** the UI outcomes for partial downloads, updates, and publication are settled above. Define source changes during resolution, cross-store commit guarantees, and idempotent retries before selecting storage/API contracts.
6. **Local propagation:** define synchronization across closed worlds, unsaved editor sessions, multiple local library copies, and multiple devices. The desired local-save result is settled; delivery and conflict granularity are not.
7. **Conflict review:** per-item action dropdowns and one Apply Updates confirmation are settled above. Define repeated notices for an already-kept revision, additional dropdown actions, independent-copy choices, and how component decisions interact with ordinary world-level overwrite/copy decisions.
8. **Local relationships:** the already-linked action opens the library item rather than creating duplicates. Define in-flight repeated clicks, intentional duplicate names, reconnecting independent copies, and whether deleting a local library item should also stop published-source tracking on its world copies.
9. **Missing-source checks:** checks are user-initiated, with no automatic open/launch/background checks. Installed optional-source loss is nonblocking and retains its association. Define confirmed inaccessible versus temporary failure and restoration after re-publication.
10. **World-specific references:** the world Placeholder connection/repair flow is settled above; matching ambiguity, nested paths, validation gates, entity location membership, and other cross-world references still need contracts.
11. **Portability:** specify how downloaded/file-exported worlds and components carry source links, local replacements, and installed content. Reimport and relinking behavior was not settled; the earlier local-only export proposal was superseded by published dependencies.
12. **Selection:** define how linked library/world copies appear in the pre-game entity/dictionary pickers so the same content is not accidentally activated twice.
13. **Validation:** review the proposed testing boundaries and unresolved decisions, then create scoped implementation tickets. This checkpoint must not be treated as AFK-ready.

### Current codebase evidence

The following are navigation references, not fixed implementation requirements:

- [World download coordinator](../../../src/lib/useDownloadCoordinator.ts) and its [interaction tests](../../../src/lib/useDownloadCoordinator.test.tsx): new downloads get a fresh local ID; overwrite replaces the selected stored world; source metadata supports update detection.
- [Library download coordinator](../../../src/lib/useLibraryDownload.ts) and its [tests](../../../src/lib/useLibraryDownload.test.ts): one local library copy per published listing, edited-copy confirmation, and independent local/source IDs.
- [Dictionary file boundary](../../../src/lib/dictionaryFile.ts) and its [tests](../../../src/lib/dictionaryFile.test.ts): fresh dictionary/entry IDs on import, owned and referenced shared Placeholder transport.
- [Library storage tests](../../../src/services/LibraryStore.test.ts) and [dictionary selection tests](../../../src/lib/dictionarySelection.test.ts): prior art for persistence and pre-game selection behavior.
- [Gameplay context](../../../src/contexts/GameplayContext.tsx): saves include runtime dictionaries and restore that saved dictionary set. Existing world updates do not rewrite those saves.
- [Entity-owned location membership decision](../../../docs/adr/0003-entity-owned-location-membership.md): entities own their location references; reusable entity content must respect that ownership.

### Prototype reference and limitations

The current standalone demo has four walkthroughs: dependencies/add-ons, preserving local edits, shared author content, and a missing source. It also offers author/player free-play controls. It is an exploratory aid, not an approved specification of every transition.

- [Standalone prototype on the original machine](C:/Users/benny/.codex/visualizations/2026/09/07/01a07d4f-021c-7bf1-94f5-3d4e5cab0754/linked-worlds-standalone.html)
- [Editable conversation prototype on the original machine](C:/Users/benny/.codex/visualizations/2026/09/07/01a07d4f-021c-7bf1-94f5-3d4e5cab0754/linked-worlds-prototype.html)

Those links are machine-local, not portable repository artifacts. The decisions and scenarios above stand on their own. Preserve a shareable prototype snapshot on a throwaway branch when design evaluation concludes; do not import the demo into application code.

The demo uses fixed sample actors/content and simplified revision counters. It omits real storage, authentication, export contracts, Placeholder mapping, concurrent author edits, and save internals. Its world-update button models component updates only, not the existing full-world overwrite flow. Interaction checks completed without JavaScript errors; browser visual inspection was blocked by the local-file URL policy. No production test evidence is implied.

### Superseded alternatives

- Independent-copy-only and local-only linking were superseded by synchronized local authoring plus published relationships.
- Immediate publication on save was rejected; local save and publish remain separate.
- Per-world adoption/republishing for shared published updates was rejected; published worlds use current published sources immediately.
- Keeping a missing required source indefinitely as a playable fallback was rejected after confirmed unavailability. Offline installed content remains usable when no missing source has been confirmed.
- Required content and third-party optional add-ons are separate relationships. A compatibility claim never changes a world's requirements.

## Comments

- Initial design checkpoint synthesized from the author discussion and exploratory prototype. Documentation was requested before design review was complete; no implementation tickets or production changes were authorized here.
- Follow-up decision: world-owned Placeholders resolve through a per-world connection to an existing or newly created Placeholder. Retain connections across updates and use the same flow to repair missing references; do not rely on raw braces or identical names alone.
- Follow-up UI decision: use Save to Library / Add split buttons with Export / Import dropdown actions. File import reviews the content name and defaults to linking through the library; already-linked content offers Open in Library with Export and Unlink in its dropdown.
- Follow-up UI decision: the library picker defaults Link to library on, explains behavior according to ownership, and opens Placeholder resolution after confirmation only when references are unresolved.
- Follow-up UI decision: Connect World Placeholders presents per-reference selectors with matching suggestions, value previews, and Create new. Connect & Add requires complete connections before world insertion; Back preserves choices, and repair uses Save Connections.
- Download-review correction: declined add-ons are excluded, rather than treated as unreviewed Community offerings. Players can still download and link them independently, clearly labeled as not recommended by the affected world's author. The remaining proposed download-dialog presentation details have not yet been confirmed.
- Follow-up UI decision: author add-on review uses a centered-Unreviewed three-way control ordered Approved / Unreviewed / Declined, with sorting/filtering and Unreviewed-only filtering by default. Specific sort modes and the earlier proposed review-entry/Undo/update-approval behavior remain unconfirmed.
- Follow-up UI decision: world publishing review includes Linked Content with per-component Include as required choices. Unchecked content is embedded without a published source dependency; unpublished owned sources show Will publish with this world and Public/Unlisted selection. Local authoring links are preserved independently.
- Follow-up UI decision: component publishing derives Compatible Worlds from actual linked worlds with published counterparts, with explicit Offer as add-on choices committed on publication. This replaces the proposed searchable world picker; association removal after local unlinking remains open.
- Follow-up UI decision: Review Updates uses per-item action dropdowns with defaults, followed by one confirmation that executes the selected actions. Unmodified content defaults to Update, edited content to Keep mine; selecting an action alone does not change content.
- Remaining-decisions round 1: required-source repairs use unselected action dropdowns and explicit confirmation; third-party published requirements are allowed; partial update successes remain while failures preserve old content and offer Retry. Add-on decisions survive source updates, which mark Updated since review and join Unreviewed in the default attention list, oldest waiting first. This supersedes the earlier Unreviewed-only default.
- Remaining-decisions round 2: explicit Mark reviewed acknowledges source changes; first-publication requirements default checked, with later choices preserved. World/component update actions supplement Community indicators, and editor list/header labels expose links and local replacements. Failed required initial downloads stay pending for retry. Automatic source checks and downloaded-content notifications are out of scope.
- Remaining-decisions round 3: add-on review decisions wait for Save Changes. Failed optional downloads do not hold up a complete world; successful component publications remain while required failures are retried before world publication. Library updates review all affected worlds together, protecting each local replacement. Removed local compatibility links become pending removals on the next Publish.
- Remaining-decisions round 4: keep staged review rows visible with Pending change and Discard Changes; stage Mark reviewed too. Comparisons show changed fields first, with unchanged content expandable and dictionary entries grouped by change. Missing optional sources preserve content and tracking without blocking play. Dependencies first published with a world default Unlisted. Manage Add-ons lives on published-world actions, while repairs are reachable contextually and through the editor issue list in both modes.
- The author confirmed the UI checkpoint covering these four rounds. Remaining edge cases and implementation contracts stay open; this confirmation does not authorize implementation or make the spec AFK-ready.
