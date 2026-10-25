# 🧍 Avatars
<!-- keywords: player body, vtuber model, mannequin, figure on the left, body morphs, what is vrm -->

An Avatar is a 3D model that an entity can show. It is a VRM file. You keep your Avatars in the library's **Avatars** tab. A world keeps its own Avatars, and each entity in the world picks one. In the game, an entity's Avatar shows in the entity view and changes shape with the entity's stats.

> An Avatar is not an entity's 3D model, and not your Profile Image. See [Avatars, 3D Models and Profile Images](#avatars-3d-models-and-profile-images).

## How to Import an Avatar
<!-- keywords: add, load, upload, vrm, glb, 3d model, character model, vroid, file, bring in my model, custom body, booth, vrchat model, blender export, use own mesh, duplicate warning -->
<!-- route: mainMenu.models#import-avatar -->

1. On the main menu, select the **Avatars** tab.
2. Select **Import Avatar**. On a narrow screen, the button is in the **Menu** button at the top center.
3. Select one or more `.vrm` or `.glb` files.

The Avatar gets the title in its file, or the file name. A message counts the Avatars it imported. If the file is the same as an Avatar you have, the app asks before it adds a second copy.

You can also add a file during **Character Customization**: select **Add .vrm**. The app adds it to your library and selects it.

## How to Customize Your Avatar
<!-- keywords: change, edit, hair, body, colors, appearance, look, character creator, 3d model, skin tone, eye shade, hairstyle, outfit recolor, body sliders, proportions, dress up, makeover -->
<!-- route: avatar#finalize-character -->

You customize an Avatar when you start a game as a persona that has an Avatar. See [The Avatar Step](Starting-a-Game#the-avatar-step).

1. In the **Enter World** dialog, select **Continue to Avatar**. **Character Customization** opens. The button reads **Start Game** when your persona has no Avatar.
2. If your persona uses **User's Default**, select an Avatar in **Player Avatar**. Otherwise the author's Avatar shows, and the list does not.
3. Change the **Hair**, **Initial Body Features** and **Colors** controls. The viewer shows each change.
4. Select **Finalize Character** to start the game.

Your choices are kept in the game and its saves. The Avatar in your library does not change. The choices apply to the Avatar of the entity you play. Other entities keep their own look. **Quick Start** skips this step and uses the Avatar as it is. See [Character Customization](#character-customization).

## How to Set Your Default Avatar
<!-- keywords: favorite avatar, preferred model, which avatar do i wear, default badge, clear default, bundled avatar, users default -->
<!-- route: mainMenu.models -->

**User's Default** is the Avatar you prefer. An entity set to **User's Default** shows it.

1. On the **Avatars** tab, right-click the Avatar's tile.
2. Select **Set as Default Avatar**.

The tile gets a **Default** badge. To go back, right-click the tile and select **Clear Default Avatar**. With no default, **User's Default** shows the bundled Avatar. The default stays on this device. Exports and saves do not carry it as a setting.

## How to Check an Avatar's License
<!-- keywords: allowed, permission, rights, terms of use, copyright, share, redistribute, commercial, credit, vroid hub, legal to upload, who made it, attribution needed, ownership, usage rules, says not shareable, am i allowed -->
<!-- route: modelDetails -->

1. On the **Avatars** tab, select the Avatar's tile. Its details open.
2. Open **Details**.
3. Read **License**, **Redistribution**, **Commercial use** and **Credit**.
4. Read **Community Creations**. **Shareable** means you can publish it.

If it shows **Not shareable**, a line under it names what the file does not allow. See [The Permissive License](#the-permissive-license).

## How to Export an Avatar
<!-- keywords: download, save to file, get the file, back up, vrm file, copy out, extract model, send to a friend, move to other device, transfer, take out of app, keep offline copy -->
<!-- route: mainMenu.models -->

1. On the **Avatars** tab, select the Avatar's tile.
2. Select **Export**.

You get the file as you imported it: a `.vrm` file, or `.glb` for a file with no VRM data.

## How to Add Body Sliders in Blender
<!-- keywords: shape keys, shapekeys, blend shapes, morph targets, custom avatar, slider not showing, key missing, body mesh, wings, horns, tail, transform during play, grow, ctrl+j, join mesh, weight paint, vertex group, ponytail, hair length key, vrm addon, basis, object data properties, part left behind, floating horns -->
<!-- route: modelDetails -->

Formamorph makes a body slider from each shape key on the object named `Body`. A world's stats can drive these sliders. Formamorph reads no other object for body sliders.

You need the VRM Add-on for Blender. **Shape Keys** and **Vertex Groups** are in the **Object Data Properties** tab, the green triangle.

1. Select the new part, such as wings, horns or a tail.
2. Hold Shift and select `Body` last.
3. Press **Ctrl+J**. The part joins into `Body`.
4. Press **Tab** for Edit Mode, and select only the part's vertices.
5. In **Vertex Groups**, select the bone the part follows, such as the head for horns. Select **Assign**.
6. In **Shape Keys**, select **Basis**. If the list is empty, select **+** once to make it.
7. Shrink the part inside the body. This is its hidden form.
8. Press **Tab** for Object Mode. In **Shape Keys**, select **+** and name the new key.
9. With the new key selected, press **Tab** and scale the part out to full size. Press **Tab** again.
10. Select **File › Export › VRM**. Don't apply modifiers by hand before you export.
11. Import the file and open its details. Each key shows as a slider in **Initial Body Features**.

Keep these rules or the sliders can fail:

- Name the object `Body`, with a capital B. Parent it to the armature, not to a bone.
- Don't parent other objects to `Body`.
- Give every vertex a bone. A vertex with no bone follows the hips, so the part stays behind when the Avatar moves.

To tie a slider to a stat, open a world stat in the World Editor and pick the key in **Body Sliders**. The stat's Min sets the key to 0, and its Max sets it to 1. Each key belongs to one stat only. An entity's own stats list the keys of its 3D model, not its Avatar. The **Initial Body Features** value adds to the stat's value. See [World Editor Stats](World-Editor-Stats).

> An object with *hair* in its name gives one key only: `LENGTH`, in capitals, for **Hair Length**. Stats can't drive it.

## Character Customization
<!-- keywords: creator screen, rotate the model, spin view, stop it moving, sliders missing, clothing recolor, body grows with stats, hide model in game, transformation -->
<!-- route: avatar -->

**Character Customization** opens between the **Enter World** dialog and the game, when the persona you play has an Avatar. It fills the screen: the viewer on the left and the controls on the right. On mobile, the controls are in a sheet. Select **Customize** to open it.

Drag the viewer to turn the Avatar. Scroll to zoom.

| Control | What it does |
|---|---|
| **Back** | Returns to the **Enter World** dialog. When there is no step before this one, the button is **Abort**, and it cancels the start. |
| **Finalize Character** | Starts the game with this Avatar |
| **Player Avatar** | The Avatar you wear. It shows only when your persona uses **User's Default**. It lists the Avatars in your library and starts on your default. When the author picked an Avatar, that one shows and you can't change it. |
| **Add .vrm** | Adds a `.vrm` or `.glb` file to your library and selects it |
| **Animate character** | Plays the idle animations. Clear it to stop the Avatar. |
| **Hair** | A hair style, when the model has more than one, and **Hair Length** |
| **Initial Body Features** | One slider for each body shape the model has. The world's stats can change these during the game. |
| **Colors** | **Hair Color**, **Eye Color** and **Skin Color**. **Revert to original** restores the file's color. |
| **Other Colors** | Pick a part, such as clothing, and change its color |

A control shows only when the model supports it. A plain `.glb` file has no VRM data, so it may show few controls or none.

### In the Game

The entity view shows the selected entity's Avatar. Select an entity in the list to see its Avatar, and select your own entity to come back to yours. In an older world with no persona, the list has a **You** row for this. An entity shows its Avatar if it has one. If not, it shows its 3D model, and if not that, its image. To see another one, use the corner buttons on the view. **Display by Default** makes the one you see the one that entity opens on. See [The Game Screen](How-to-Play#the-game-screen).

A world author can tie body sliders to a stat. As the stat changes, the Avatar's shape changes. Your Avatar follows your stats. Each other entity's Avatar follows that entity's stats. The sliders you set in **Initial Body Features** are the start point for your Avatar.

## The Avatar Details Dialog
<!-- keywords: model info, metadata, properties, inspect file, vrm version, remove a model, saves using it, right click options -->
<!-- route: modelDetails -->

Select an Avatar's tile on the **Avatars** tab to open its details. The dialog's title is the Avatar's name. The viewer is on the left. On mobile, select **Details & sliders** to open the controls.

**Details** shows what the file says about itself:

| Row | What it shows |
|---|---|
| **Author** | The authors the file names, or **Unknown** |
| **Format** | **VRM 1.0**, **VRM 0.0**, or **glTF (no VRM data)** |
| **Size** | The file size |
| **License** | The license name or its link |
| **Redistribution** | Whether others may share the file |
| **Commercial use** | Whether the model may be used for profit |
| **Credit** | Whether the author asks to be credited |
| **Community Creations** | **Shareable** or **Not shareable**. See [The Permissive License](#the-permissive-license). |

Under **Details** are the same controls as in **Character Customization**. Use them to test the model. They do not change the Avatar.

| Button | What it does |
|---|---|
| **Export** | Saves the file. See [How to Export an Avatar](#how-to-export-an-avatar). |
| **Publish** | Publishes the Avatar to Community Creations. Shows when you are logged in. |

Right-click a tile for **Publish**, **Thumbnail**, **Delete**, **Tile Size** and **Add To Group**. See [The Card Menu](Library#the-card-menu).

### Deleting an Avatar

**Delete Player Avatar** asks you to confirm. If saves use the Avatar, the dialog names them. Those saves use the Default Avatar after you delete it. If library entities use the Avatar, the dialog names them too. Those entities show no Avatar after you delete it. You can't delete your last Avatar.

## The Permissive License
<!-- keywords: cc0, creative commons, upload rejected, why is sharing blocked, open licence, convert to vrm 1, missing rights message, set in vroid -->

You can publish an Avatar only when its file grants a Permissive License. The file's VRM 1.0 metadata must allow all of these:

- Everyone may use it.
- It may be redistributed.
- Modified copies may be redistributed.
- Commercial use is allowed.

Formamorph reads this from the file. You can't set it in the app. A VRM 0.0 file or a plain `.glb` has no VRM 1.0 metadata, so it can't be published. The default Avatar can't be published either.

When the license fails, **Publish** shows a message that names each missing right. To fix it, set the license in the tool that exported the VRM, export it as VRM 1.0, and import the file again. Publish an Avatar only when you have the right to share it.

The steps to publish are in [Publishing an Avatar](Community-Creations#publishing-an-avatar). You can download an Avatar from Community Creations whatever its license. Its details show the license terms.

## World Avatars
<!-- keywords: model bundled with world, author supplied body, ship my own model, avatar store, give npc a model, entity avatar dropdown, share avatar between entities, not in my library, user's default -->
<!-- route: worldEditor.media -->

A world keeps its own Avatars. The author adds them in the World Editor's **Media** tab, in the **World › Avatars** section, in Simple and Advanced mode. Select the section's header, then **Upload Avatar…** adds a `.vrm` or `.glb` file. **Copy From Library** copies one of your Avatars into the world. The world stores the file, so a player who downloads the world gets it. Select an Avatar's card to rename it, replace its file, download it or delete it. **Replace** keeps the Avatar's name, so every entity that picks it keeps its pick. **Used By** lists the entities that pick it. A delete names those entities, and they go back to **None**. See [World Editor Media](World-Editor-Media).

A library entity whose Avatar isn't in your library on this device reads **Missing Avatar** in its **Avatar** dropdown. In play it shows the bundled Avatar. Pick another option to replace it.

Each entity picks its Avatar in its **Avatar** dropdown, in Advanced mode:

| Choice | What the entity shows |
|---|---|
| **None** | No Avatar. This is the start value. |
| **User's Default** | The player's default Avatar. See [How to Set Your Default Avatar](#how-to-set-your-default-avatar). |
| An Avatar of the world | That Avatar. Two entities can pick the same one. |

A library entity picks from your library instead, in the **Avatar** dropdown of the library's entity editor: **None**, **User's Default**, or one of your Avatars.

- When you add a library entity to a world, the world copies its Avatar once.
- An exported character card carries the entity's Avatar.
- When you import a card, the Avatar joins your **Avatars** tab. If you import the same Avatar twice, you keep one copy. See [World Editor Media](World-Editor-Media) and [World Editor Entities](World-Editor-Entities).

Old worlds still work. An older world that showed one Avatar for the player keeps showing it under any persona. This stops when the world's Custom Persona gets an Avatar of its own.

## Avatars, 3D Models and Profile Images
<!-- keywords: difference between, npc model, supported formats, versus, which is which, fbx obj gltf, can narrator see pictures, stored where -->

| | Avatar | Entity 3D model | Profile Image |
|---|---|---|---|
| **What it is** | A VRM model that an entity shows | A model of one entity | The image on your account |
| **Where you add it** | The library's **Avatars** tab, or the world's **Avatars** section in the **Media** tab | The entity's **3D Model** field, in Advanced mode | **User Profile** |
| **Files** | `.vrm`, `.glb` | `.glb`, `.gltf`, `.fbx`, `.obj` | `.png`, `.jpg`, `.webp`, `.gif`, up to 10 MB |
| **Where it is stored** | Your library, on this device, or inside the world file | Inside the world file | The Community Creations server |
| **Where it shows** | The entity view | The entity's image, with **View 3D model** | Beside your name in Community Creations |
| **Customizing** | Hair, body and colors | None | Position and zoom |

An entity's 3D model has no sliders or colors. The narrator never sees an entity's image or 3D model.
