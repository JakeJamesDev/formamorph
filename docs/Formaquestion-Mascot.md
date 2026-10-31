# 🧸 Formaquestion Mascot
<!-- keywords: morphie, mascot name, who is the mascot, character, mascot, rig, layers, overlays, base image, expression, state, reset mascot, my own character, face, wave, thinking face, initial look, idle look, thinking look, voice, mask, head view, transition, jelly, dissolve, bounce, mascot card, export mascot, import mascot, share my mascot, turn off the mascot, minimal window, mascot preset, duplicate mascot, rename mascot, delete mascot, save mascot, unsaved changes, more than one mascot, mascot full screen, supporter mascot, exclusive mascot, locked mascot, patreon mascot -->
<!-- route: formaquestionSettings.mascot -->

The mascot stands beside the Formaquestion chat and reacts to your questions. The **Mascot** tab of **Formaquestion Settings** edits it: a base image with layers drawn on top.

- The mascot's name is its preset's name. Your AI answers as that name, and a screen reader reads it on the mascot.
- The **Mascot** switch is in the **Window** group of the **General** tab. See [General](Formaquestion-Settings#general).
- With the mascot off, the **Mascot** tab disables every control. It shows "The Mascot is off. Enable it in “General” to customize it." Select **General** in that line to open the **General** tab.

The **General** tab also places the mascot and sets its size:

- [How to Put the Mascot Under the Chat](Formaquestion#how-to-put-the-mascot-under-the-chat)
- [How to Change the Size of the Mascot](Formaquestion#how-to-change-the-size-of-the-mascot)

## How to Make Your Own Mascot
<!-- keywords: custom mascot, new mascot, change the mascot, my own art, upload mascot image, edit morphie, copy morphie, different look, own helper art -->
<!-- route: formaquestionSettings.mascot -->

1. Select **More Actions**, then **Settings**, then the **Mascot** tab.
2. Select **Duplicate**. The new copy is selected, and you can edit it.
3. Under **Base Image**, upload your own image.
4. Under **Layers**, select **Add Layer**, and upload the overlay images of that layer.
5. Set **Initial Look**, **Idle Look** and **Thinking Look**. See [The Looks](#the-looks).
6. Select **Save** at the bottom of the tab.

The preview shows each change at once. The window shows the mascot after you save. See [The Rig](#the-rig).

## How to Set the Head View With the Mask
<!-- keywords: crop, mask handles, head only, face crop, resize the box, move the box, trim, drag the edges, corners, arrow keys, head view box, face box, keyboard -->
<!-- route: formaquestionSettings.mascot#mask -->

1. Open the **Mascot** tab in **Formaquestion Settings**.
2. Move your pointer over the preview. The Mask box shows eight handles and a center grip.
3. Drag a handle to move one edge, or a corner to move two. Drag inside the box to move the whole box.
4. Watch **Head View**, next to the preview. It shows the result as you drag.

- To draw a new box, drag on the preview outside the current one.
- With the keyboard, press Tab to a handle, then press an arrow key to move it one pixel. Shift with an arrow key moves it ten pixels.
- The handles fade while your pointer is away, unless one has focus or you are dragging. On a touch screen, they stay drawn.

See [The Mask](#the-mask).

## Mascot Presets

You can keep more than one mascot. The **Preset** list at the top of the tab picks the one Formaquestion shows.

**Morphie** is the mascot that comes with the app. She is read-only, and she updates with each release. To change her, select **Duplicate** and edit the copy.

The actions beside the **Preset** list are icon buttons. Hover over one to read its tooltip.

| Icon button | Tooltip | What it does |
|---|---|---|
| **Duplicate** | Make an editable copy of this mascot | Copies the mascot you see into one you can edit, and selects it |
| **Rename** | Rename this mascot | Renames this mascot |
| **Delete** | Delete this mascot and its images | Deletes this mascot and the images no other mascot uses. It asks first. |
| **Reset** | Put this mascot back to Morphie | Puts Morphie's rig in place of this mascot's. **Cancel** takes it back. |
| **Import** | Add a mascot from a card | Adds a mascot from a card file, and selects it. See [The Mascot Card](#the-mascot-card). |
| **Export** | Save this mascot as a card | Saves this mascot as a card |
| **Publish** | Share this mascot in Community Creations | Shares this mascot in Community Creations. It shows when you're signed in, and never on Morphie. See [Publish a Mascot](#publish-a-mascot). |
| **View full screen** | View full screen | Opens the whole tab full screen. **Exit full screen** or Escape returns it. |

- While **Morphie** is selected, only **Duplicate**, **Import**, **Export** and **View full screen** show.
- While a Supporter Mascot is selected, only **Import** and **View full screen** show.
- On a narrow screen, the buttons are in the **Preset Actions** menu.

**Supporter Mascots** are for Patreon Supporters.

- A Supporter Mascot you don't have shows in the **Preset** list with its thumbnail and a lock. Select it to open its listing in Community Creations.
- If your account is a Supporter, selecting it installs it and selects it.
- A Supporter Mascot is read-only: you can't edit, duplicate, export or publish it.
- When your pledge ends, the app removes it, and Formaquestion shows Morphie again.

## The Rig

The tab has two columns on a wide dialog. The preview stays in view on the left, and the other rows scroll on the right. On a narrower dialog, the preview comes first and the whole tab scrolls.

| Row | What it does |
|---|---|
| **Voice** | Tells your AI how help answers sound while the mascot is on. The **Mascot Voice** chip sends this text. |
| **Preview** | Shows the Idle look, or what you select. Select a layer to see the base with all of that layer's overlays. Select one overlay to see the base with that overlay alone. Drag the Mask on it to set the head view. The **Transition** rows and **Play** are in the same box. |
| **Head View** | Shows the part of the mascot inside the box. A mobile-size screen shows only the head, at the pill. On a desktop, **Show Head Only** in the pill shows the head in place of the whole mascot. **Show Full Mascot** goes back. With a percent **Mascot Scale**, the head draws at that share of its size, and never taller than the chat. |
| **Base Image** | Draws under every layer. Upload your own image, or remove yours to go back to the default. |
| **Layers** | Lists every layer in draw order, with its name, its kind and its **Enabled** checkbox |
| **Initial Look**, **Idle Look**, **Thinking Look** | Set the face and the state that the mascot shows at each moment. See [The Looks](#the-looks). |
| **Transition** | Sets how the mascot moves when its look changes: **None**, **Dissolve** or **Jelly**. **Play** shows it on the preview. |

- Drag a layer by its grip to change the draw order. A layer lower in the list draws on top.
- Select a layer to expand it and show it on the preview. Collapse it, and the preview goes back to the Idle look.
- Expand a layer to change its name and its kind. An **Expression** is a face your AI can pick. A **State** stacks with the face, such as the arms.
- **Add Layer** adds a layer at the end of the list. **Remove layer** removes one.
- Each layer holds overlay images, drawn in order and stretched to the base size. Drag an overlay to move it, or upload more. **Remove overlay** removes one.
- The slots take image files only, not links. This device keeps your images, outside the settings.

Your changes show in the preview at once. The window, the face your AI picks and **AI Context** keep the saved mascot until you save.

- **Save**, at the bottom of the tab, keeps your changes. **Cancel** drops them.
- **Undo** and **Redo**, next to them, step through your changes. Ctrl+Z, and Ctrl+Shift+Z or Ctrl+Y, do the same anywhere on the tab.
- When you change the mascot or the tab, or close **Formaquestion Settings**, with changes not saved, the app asks first. You can save them, exit without saving, or stay.
- When you save, the app deletes each image you removed that no layer of any mascot uses. **Cancel** deletes the images you added since your last save.

## The Looks

A look is one expression and one state. Each look row has two lists, one for the expression and one for the state. The lists show only layers that are on, and each list has **None**.

| Look | When the mascot shows it |
|---|---|
| **Initial Look** | While the conversation is empty: when the app starts, and after **Clear Conversation**. It stays until you send your first question. Morphie waves. |
| **Thinking Look** | From the moment you send a question until the answer starts. It stays while your AI reasons. |
| **Idle Look** | When the answer starts. Its state shows with every answer. Its expression shows when your AI picked no face. |

- Your AI can pick a face for its answer when the **Answer Endpoint** takes function calls. It picks from the expressions that are on. The face shows when the answer starts, and it stays until your next question.
- On an endpoint with no function calls, the mascot still waves, thinks and rests. Your AI picks no face.
- A look that names a layer you turned off draws nothing for that layer. The tab shows a warning that names the look.
- Each face call shows in **AI Context** with the other tool rounds.

## The Mask

The Mask is the box that sets the head view. It has eight handles, one on each corner and one on each edge, and a grip in the center. **Head View** shows the result while you drag.

- Drag an edge handle to move that edge. Drag a corner handle to move two edges. Drag inside the box to move all of it.
- The box stays inside the base image and above a small minimum size.
- Drag outside the box to draw a new one. A drag under 16 pixels of the base image counts as a press and keeps the Mask.
- Press Tab to a handle, then an arrow key. A side handle moves along its own axis. A corner or the center grip moves both ways.
- One key press moves one pixel of the base image, and Shift moves ten. Each key press saves at once.
- The handles fade while your pointer is away from the box. On a touch screen, they stay drawn. With reduced motion, they show and hide with no fade.
- **Head View** sits in a fixed slot. A wide Mask shows a shorter head, so the slot does not move while you drag.

**Reset** restores Morphie's Mask. This device keeps your choice between **Show Head Only** and **Show Full Mascot**.

## The Transition

The mascot plays its transition each time its look changes:

- from the Initial Look to the Thinking Look
- from the Thinking Look to a face
- from a face to the Thinking Look, on your next question
- when your AI picks a face

A change during a transition restarts it from the frame on the screen.

| Mode | What it does |
|---|---|
| **None** | Swaps the look at once |
| **Dissolve** | Fades the new look in over **Duration** |
| **Jelly** | Squashes the mascot, stretches it past full height as the new look appears, then bounces it back to rest. **Duration**, **Squash**, **Overshoot** and **Settle Count** tune it. |

- **Jelly** is the default. **Reset** returns the transition to the Default's.
- Your system's reduced-motion setting turns the transition off. The tab says so while it applies.
- **Play** changes the preview between the look it shows and the Thinking Look. Each press plays the transition one way, and the next press plays it back.

## The Mascot Card

**Export** saves the mascot you see as a `.webp` card, with your changes not saved yet. The card shows the Initial Look. It holds the mascot's name and the whole rig: every layer and image, the three looks, the Mask, the transition and the Voice. Send the file to a friend.

**Import** reads a `.webp` card and adds it as a new mascot. Your other mascots stay as they are. It does not change the **Mascot** switch.

- The new mascot takes the name in the card, and your AI answers as that name. A card with no name takes the file's name. A name already in use gets a number, such as "Captain 2".
- A card with a bad field, or one from a different version, is refused. The error names the field, and your mascot stays as it was.
- The card is an image file with your art inside it. Share it only with people you want to see that art.

## Publish a Mascot
<!-- keywords: publish mascot, share mascot, upload mascot, mascot listing, mascot thumbnail, mascot too big, mascot size limit, 10 MB, update my mascot listing, delete my mascot listing, mascot changelog, community mascot -->

**Publish** puts your mascot in the **Mascots** section of Community Creations. Other players download it there as their own mascot. Sign in first.

1. Open the **Mascot** tab and select your mascot.
2. Select **Publish**. If you have unsaved changes, the app asks you to save or discard them first.
3. Choose **Publish as new mascot**, or pick one of your listings to update it.
4. Select **Publish**.

- The thumbnail shows the Initial Look. To show one of your expressions, pick it in **Expression**. To use your own image, upload it in **Thumbnail**. **Use Initial Look** puts the default back.
- To update a listing, pick it in step 3. You can add a **Changelog Entry** for players who hold a copy.
- To delete a listing, select the **Delete** icon button (trash) on your card in the **Mascots** section of Community Creations.
- A mascot can hold up to 10 MB of images. If yours is larger, the app shows its size and sends nothing. Compress the layers, then publish again.
- A mascot that uses art that comes with Formamorph can't be published. The message names the layers to replace. Morphie has no **Publish**.
- After you publish, your mascot follows its listing, as your other published items do.
