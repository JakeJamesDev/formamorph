# 🔗 Linked Content

How a world's entities and dictionaries follow a library item, and what that link does at each step: editing, updating, publishing, downloading, and repair.

> The same story, in short, is the `?` beside the **Linked** badge in the [World Editor](WorldEditor) and in the title bar of **Update Available** and **Update This World**.

---

## Words This Page Uses

| Term | Meaning |
|---|---|
| **Library item** | One entity or dictionary in your library. |
| **Linked copy** | An entity or dictionary in a world that follows a library item. |
| **Independent copy** | A copy that follows nothing. |
| **Local replacement** | A linked copy of another author's item that you edited. No update overwrites it. |
| **Source** | The published listing a copy follows. |
| **Add-on** | A published entity or dictionary offered for a world, which a player installs by choice. |
| **Bundled content** | The entities and dictionaries an imported world file carries whose library items are not on this machine. |

## Linked Copies

A **linked copy** follows a **library item**. When you save the library item, every linked copy of it receives the change the next time you open its world. An independent copy follows nothing.

### How a Copy Becomes Linked

| Action | Result |
|---|---|
| **Save to Library** | Saves the copy as a library item and links the copy to it. |
| **Add Entity**, **Add Dictionary** | Adds a copy of a library item. **Link to Library** is on by default. |
| **Import Entity…**, **Import Dictionary…** | Adds a copy from a file, with the same **Link to Library** choice. |
| **Link to Library Item…** | In an independent copy's menu. Links the copy to a library item you pick. |

All four make the same link.

### The Three Link States

A linked row carries a 🔗 marker in the list, and its footer button reads **Open in Library**. Point at either one to read the state and the name of what the copy follows, such as *Linked · Sedge*.

| State | Meaning | Default in a review |
|---|---|---|
| **Linked** | The copy follows its library item. Updates replace its content. If the item is yours, saving the world writes your edits to it. | **Update** |
| **Local replacement** | You edited a copy of another author's item. No update overwrites it. | **Keep Mine** |
| **Link pending save** | You linked the copy in this editing session. The link is written when you save the world. | |

### Editing a Linked Copy

Who owns the library item decides what an edit does.

| The item is | An edit to the copy | On **Save** |
|---|---|---|
| **Yours** | Stays **Linked**. | Writes the edit to the library item. Every other world holding a copy receives it the next time you open that world. The last save wins. |
| **Another author's** | Makes the copy a **Local replacement**. | Writes nothing to the library. Their updates still reach you for review, where **Keep Mine** is the default. |

**Discard Changes** writes nothing to the library. A copy you already made a local replacement stays one; **Use Author's** in a review makes it share edits again.

### The Copy's Menu

| Control | What it does |
|---|---|
| **Open in Library** | Opens the library item the copy follows. |
| **Unlink** | Turns the copy into an independent copy. The content stays as it is. |
| **Save Connections…** | Reopens **Connect World References** for this copy. |
| **Check for Updates** | Compares the library item against every world that holds a copy. |

### Connect World References

A library item names the Placeholder or location it needs by an id from its own world. That id means nothing in the world receiving it. When you add content that expects something this world does not already answer, a **Connect World References** step opens before the content goes in.

The step lists one row per open reference under **Placeholders** and **Locations**. Each row shows what the content expects and a selector of this world's own, plus **Create New…**. **Connect & Add** stays off until every row is answered. **Back** returns to the picker with your picks and your answers as you left them.

Each copy remembers what its references resolve to here. A later update from the source reaches the same Placeholders even when the source has renamed them. If you delete a Placeholder a copy is connected to, the World Doctor raises a warning that names the copy. **Save Connections…** in the copy's menu reopens the step, so you can point the reference somewhere else.

## Updates

### Update Available

**Check for Updates** sits on an entity or dictionary tile in your library, and in a linked copy's menu in the World Editor. It compares the library item against every world that holds a copy. If no world is behind it, Formamorph says the item is up to date and opens nothing.

If a world is behind it, **Update Available** lists one row per world, with the copy's state and an action.

| Action | What it does | Default for |
|---|---|---|
| **Update** | Replaces the copy with the library item. | **Linked** |
| **Use Author's** | Replaces a local replacement with the library item. Your edits go. | |
| **Keep Mine** | Keeps the copy as it is. | **Local replacement** |
| **Unlink** | Keeps the copy as it is and stops following the library item. | |

**View Changes** shows the changed fields with your value and the author's. A dictionary's changed, added, and removed entries are grouped, and unchanged content sits behind a disclosure.

Choosing an action changes nothing until **Apply Updates**. **Cancel** applies none of it. If one world fails, it keeps the content it had and offers **Retry**. Every other world's result stands.

> [!NOTE]
> **Keep Mine remembers the revision you answered for.** That revision does not come back. The next revision of the library item asks again.

### Update This World

Choosing **Update an existing copy** on a community world opens **Update This World** before anything is written. It lists the linked copies the update would change, each with the same four actions. A local replacement starts on **Keep Mine**, so your edits survive the update.

| Section | What is in it | What Apply Updates does |
|---|---|---|
| **Changed Content** | Linked copies the update would change. | Runs the action you chose on each. |
| **New Required Content** | Sources the author now requires. | Downloads each one and links a copy to this world. |
| **No Longer Required** | Copies the author stopped requiring. | Keeps each copy as an independent copy. |

**Apply Updates** runs the whole world in one write. **Cancel** applies none of it. A source that does not download leaves its copy on the content you already had, with **Retry** for that row, while the world and everything else updates. **Download a copy** never opens the review.

## Publishing

### Publishing a World

The publish dialog lists every library item the world's copies follow under **Linked Content**, each with **Include as required**.

| Choice | What players download |
|---|---|
| **Include as required** checked | The source downloads and links with the world. |
| Unchecked | The content is published inside the world with no source to follow. |

A source you own that has no listing yet reads **Will publish with this world** and carries a **Public** or **Unlisted** choice, set to Unlisted. Those sources publish first, and the world publishes only once every one of them exists. If one is refused, the world stays unpublished, the dialog names what failed, and **Retry** picks up where it stopped. Your own links are untouched.

A first publication checks every row. A later one checks what the listing already requires.

### Publishing an Entity or a Dictionary

The publish dialog gains a **Listing** choice, **Public** or **Unlisted**, and a **Compatible Worlds** section that lists every published world of yours with a linked copy of it.

Check **Offer as add-on** for a world and publishing creates that offer. The world's author then reviews it, and the review state shows beside each world you have already offered it for.

An unlisted listing stays out of Community Creations and reaches players only inside a world that requires it. It cannot be an add-on, so choosing Unlisted turns the section off. If you unlink the copy a world held, that offer shows as a pending removal and publishing removes it.

### Manage Add-ons

Your own published world card in Community Creations gains **Manage Add-ons**. It opens the offers other authors have made for your world. Each offer is in one of three states.

| State | Where the add-on appears on your world's download |
|---|---|
| **Approved** | Under **Approved Add-ons**. |
| **Unreviewed** | Under **Community Add-ons**. |
| **Declined** | In neither tab. It stays downloadable from its own listing. |

**Show** starts on **Needs Attention**: the unreviewed offers, and the ones whose source changed since you answered. A source that changed after your answer keeps that answer, gains **Updated since review**, and comes back to Needs Attention. **Mark Reviewed** accepts the change without changing your answer.

Every change waits as **Pending change** until **Save Changes**. **Discard Changes** puts it back.

## Downloading

### Downloading a World

A community world's details window lists what it brings under **Linked Content**, in three tabs.

| Tab | Who chose it | You choose |
|---|---|---|
| **Required** | The world's author requires it. | No. It comes with the world. |
| **Approved Add-ons** | The world's author approved it. | Yes, one checkbox each. |
| **Community Add-ons** | Its own author offered it. The world's author has not reviewed it. | Yes, one checkbox each. |

The download button counts what the press installs, so it reads **Download World + 3 Items**. Downloading places every item in your library and links the world's own copies to them. Each copy opens in the World Editor as **Linked** with its source named.

A required item that does not download leaves the world out of your library and names what failed. **Retry** finishes it, and what already downloaded is kept. An add-on that does not download leaves the world ready and gets its own **Retry**.

### A Listing's Compatible Worlds

An entity's or a dictionary's details window lists the worlds it is offered for under **Compatible Worlds**, in three groups: **Approved**, **Unreviewed**, and **Declined by the world author**. Only the entity's or dictionary's own author sees the declined group. Pressing a world opens that world's listing. Downloading the entity or dictionary installs it alone. Each world stays a download of its own.

### Importing a World File

A world file bundles its entities and dictionaries, and records what each linked copy follows and which copies are local replacements.

| Where you import it | What happens to the links |
|---|---|
| The machine that wrote it | Every link is restored. |
| Elsewhere, **Link bundled content to my library** checked | Each bundled item becomes a library item of yours, and the world's copies follow it. |
| Elsewhere, unchecked | The copies are embedded and follow nothing. |

> [!NOTE]
> **The file's content always wins.** A copy whose source you already have follows your own item and arrives as a local replacement.

An entity or dictionary file carries the entity or dictionary and the worlds it is offered for. If the file's source is already in your library, Import opens that item's update review with the file as the incoming revision. Every import works with no connection.

## Repairs

### Check Sources

The Test Bench's **Issues** list gains **Check Sources**. It asks the server about every library item this world's copies follow. Formamorph asks only when you press it, so an installed world stays playable with no connection.

| Result | Meaning |
|---|---|
| A source its author removed | The server reports the source as deleted. |
| Could not check | Any other failure. Carries **Retry Check**. |

### The Three Repairs

Each copy with a missing source gets its own repair, with one **Apply** per copy and nothing chosen to begin with.

| Repair | Result |
|---|---|
| **Replace from Library** | The copy follows a different library item. |
| **Unlink and Keep Content** | The copy becomes an independent copy with its content untouched. |
| **Remove from World** | The copy is deleted from this world. |

> [!WARNING]
> **A republished source is a new listing.** It never reconnects on its own. **Replace from Library** is the way back to it.

### While a Source Is Missing

While a required source reads as removed, **Enter World**, **Quick Start**, and **Publish World** are off for that world. The reason names the source and carries **Repair Sources** to the editor. **Edit World** and **Load Game** stay open, because a game already under way keeps what it started with. Repairing the copy turns the other three back on.

### Removing a Library Item

Deleting an item from your library leaves every world copy that followed it as an independent copy with its content untouched. Each world lets go of the item the next time you open it. No world breaks.
