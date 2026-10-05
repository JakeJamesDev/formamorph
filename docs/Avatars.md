# 🧍 Avatars
<!-- keywords: player body, vtuber model, mannequin, figure on the left, body morphs, what is vrm -->

An Avatar is a 3D model of you, the player. It is a VRM file. You keep your Avatars in the library's **Avatars** tab, and you wear one in any world that has a 3D model. In the game, it shows in the left panel and changes shape with the world's stats.

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

You customize an Avatar when you start a game in a world with a 3D model.

1. In the **Enter World** dialog, select **Continue to Avatar**. **Character Customization** opens.
2. In **Player Avatar**, select an Avatar.
3. Change the **Hair**, **Initial Body Features** and **Colors** controls. The viewer shows each change.
4. Select **Finalize Character** to start the game.

Your choices are kept in the game and its saves. The Avatar in your library does not change. **Quick Start** skips this step and uses the Avatar as it is. See [Character Customization](#character-customization).

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

## How to Change Your Profile Image
<!-- keywords: picture, photo, pfp, icon, account picture, upload, crop, display pic, user portrait, animated gif, account face, take off my pic, reposition, initial letter shown -->
<!-- route: profile -->

You need a Community Creations account.

1. On the main menu, select the round button at the bottom left. **User Profile** opens.
2. Select your profile image.
3. Select a `.png`, `.jpg`, `.webp` or `.gif` file, up to 10 MB.
4. In **Position Your Picture**, drag the image to move it. Scroll, or use the **Zoom** slider, to zoom. The circle shows what everyone sees.
5. Select **Save**.

To remove it, select **Remove your profile image**. With no picture, your initial shows in its place. See [The User Profile Dialog](Community-Creations#the-user-profile-dialog).

## Character Customization
<!-- keywords: creator screen, rotate the model, spin view, stop it moving, sliders missing, clothing recolor, body grows with stats, hide model in game, transformation -->
<!-- route: avatar -->

**Character Customization** opens between the **Enter World** dialog and the game, in a world with **3D Player Avatar** on. It fills the screen: the viewer on the left and the controls on the right. On mobile, the controls are in a sheet. Select **Customize** to open it.

Drag the viewer to turn the Avatar. Scroll to zoom.

| Control | What it does |
|---|---|
| **Back** | Returns to the **Enter World** dialog. When there is no step before this one, the button is **Abort**, and it cancels the start. |
| **Finalize Character** | Starts the game with this Avatar |
| **Player Avatar** | The Avatar you wear. **World Avatar** shows when the world's author added one. Each Avatar in your library is listed too. |
| **Add .vrm** | Adds a `.vrm` or `.glb` file to your library and selects it |
| **Delete** | Deletes the selected Avatar from your library. Shows for a library Avatar only. |
| **Animate character** | Plays the idle animations. Clear it to stop the Avatar. |
| **Hair** | A hair style, when the model has more than one, and **Hair Length** |
| **Initial Body Features** | One slider for each body shape the model has. The world's stats can change these during the game. |
| **Colors** | **Hair Color**, **Eye Color** and **Skin Color**. **Revert to original** restores the file's color. |
| **Other Colors** | Pick a part, such as clothing, and change its color |

A control shows only when the model supports it. A plain `.glb` file has no VRM data, so it may show few controls or none.

### In the Game

The left panel shows your Avatar. On desktop, an **Avatar** / **Entities** switch sits above it, and **Hide Avatar** hides it. On mobile, the left panel has an **Avatar** tab. See [The Game Screen](How-to-Play#the-game-screen).

A world author can tie body sliders to a stat. As the stat changes, the Avatar's shape changes. The sliders you set in **Initial Body Features** are the start point.

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

**Delete Player Avatar** asks you to confirm. If saves use the Avatar, the dialog names them. Those saves use the default Avatar after you delete it. You can't delete your last Avatar.

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

## The World Avatar
<!-- keywords: model bundled with world, author supplied body, enable 3d player, ship my own model, default body for world, not in my library -->

A world author turns on a 3D Avatar with **3D Player Avatar** in the World Editor's **Overview**. In Advanced mode, **Custom Player Avatar** adds a VRM file to the world. That file shows as **World Avatar** in **Player Avatar**. It is stored in the world, not in your library. See [World Editor Overview](World-Editor-Overview).

## Avatars, 3D Models and Profile Images
<!-- keywords: difference between, npc model, supported formats, versus, which is which, fbx obj gltf, can narrator see pictures, stored where -->

| | Avatar | Entity 3D model | Profile Image |
|---|---|---|---|
| **What it is** | A VRM model of you, the player | A model of one entity | The image on your account |
| **Where you add it** | The library's **Avatars** tab | The entity's **3D Model** field, in Advanced mode | **User Profile** |
| **Files** | `.vrm`, `.glb` | `.glb`, `.gltf`, `.fbx`, `.obj` | `.png`, `.jpg`, `.webp`, `.gif`, up to 10 MB |
| **Where it is stored** | Your library, on this device | Inside the world file | The Community Creations server |
| **Where it shows** | The game's left panel | The entity's image, with **View 3D model** | Beside your name in Community Creations |
| **Customizing** | Hair, body and colors | None | Position and zoom |

An entity's 3D model has no sliders or colors. The narrator never sees an entity's image or 3D model.
