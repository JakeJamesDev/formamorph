# 🌍 World Editor: Overview

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The **Overview** tab holds the world's own details: its name, its library card, and the text the AI reads on every turn. It has two columns. On mobile, the left column shows first. The **?** button at the top of the tab has a short version of this page.

## How to Set the World's Images

1. Open the **Overview** tab.
2. Under **Thumbnail**, select the frame (**Click to upload image**) and pick a file. You can also drop a file on the frame.
3. To link an image, paste its address into **Or paste an image URL** and select **Use this image URL**. See [Upload or link](#upload-or-link).
4. To make one, select **Generate with AI**. It shows when [image generation](Image-Generation#how-to-turn-on-image-generation) is on in Settings.
5. Select **Save** at the bottom of the editor.

Each location's background is on its **Media** tab. See [World Editor: Locations](World-Editor-Locations#media). Each entity's image is on its **Profile** tab.

## How to Add Background Music

1. Open the **Overview** tab.
2. Under **Background Music**, select **Add Sound** and pick an audio file.
3. Select **Save** at the bottom of the editor.

## The left column: how your world is listed

| Field | What it does |
|---|---|
| **World Name** | The title on the library card and in every menu. |
| **Author** | Your name on the card. |
| **Tags** | The words the community browser filters on. |
| **Thumbnail** | The card's image. **Generate with AI** under the frame makes one from your Player-Facing Description, or from the AI-Facing Description when that is empty. |
| **3D Player Avatar** | Gives this world a 3D avatar. The player can [customize it](Avatars#character-customization) before they start. |
| **Custom Player Avatar** | **Advanced mode only**, and only with **3D Player Avatar** on. Your own `.vrm` or `.glb` replaces the bundled model. See [The World Avatar](Avatars#the-world-avatar). **Preview** opens it, and **Remove** goes back to the default. |
| **Allowed Personas** | **Advanced mode only.** Decides which personas the player can pick: **Any** or **World Only**. See [Personas for Authors](Persona-Authoring#persona-rules). |
| **Starts On** | **Advanced mode only.** Decides which persona a new player starts on. See [Personas for Authors](Persona-Authoring#persona-rules). |
| **Background Music** | The track the world plays. Select **Add Sound** to pick a file. **Remove sound** clears it. |

## The right column: what you write

| Field | What it does |
|---|---|
| **Player-Facing Description** | The text on the library card and the community listing. Players read it before they play, so placeholders stay as plain text here. The AI never reads it. |
| **Readme** | Two tabs. **Introduction** shows before the player makes any setup choices. **Gameplay** shows when they enter the world. Both take markdown. |
| **AI-Facing Description** | The world's description for the AI. The AI reads it on every turn. Players never see it. |
| **Custom Prompts** | **Advanced mode only.** Replaces the player's own narration, choices or stats prompt. Its **Openings** item holds the world's [Openings](World-Editor-Openings). |

## Upload or link

Every image field in the World Editor takes an uploaded file or a web address. Paste the address into the **Or paste an image URL** box.

| | Uploaded | Linked |
|---|---|---|
| Stored in your world | Yes. The full size counts toward the file. | No. Only the address is stored. |
| Works offline | Always | After you've seen it once, or after **Make Available Offline** |
| Works after the host removes it | Always | No |

- **Link when your world has many images.** A published world stays small.
- **Upload when the image must never disappear.**

A linked image shows a 🔗 badge. Two badges are warnings:

| Badge | Means | What to do |
|---|---|---|
| **Expiring link** | Discord attachment links stop working after a while. Later players won't see the image. Discord's permanent addresses (avatars, emojis, server icons) are fine. | Use a permanent host, or upload the file |
| **Linked image, display only** | The site won't let Formamorph download the image. It shows online. It won't work offline, and it can't go into an entity card. | Upload the file |

> 💡 **Make Available Offline** in the [world dialog](Starting-a-Game#the-world-dialog) downloads all its linked images at once. Use it before you lose your connection.

When you export a world with linked images, you choose: keep the links for a small file, or download the images into the file so it works anywhere. An **entity card** export always downloads the portrait, because the card is the image.
