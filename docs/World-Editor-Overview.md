# 🌍 World Editor: Overview

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The **Overview** tab holds the world's own details: its name, its library card, and the text the AI reads on every turn. It has two columns. On mobile, the left column shows first.

## The left column: how your world is listed

| Field | What it does |
|---|---|
| **World Name** | The title on the library card and in every menu. |
| **Author** | Your name on the card. |
| **Tags** | The words the community browser filters on. |
| **Thumbnail** | The card's picture. **Generate with AI** under the frame makes one from your description. |
| **3D Player Avatar** | Gives this world a 3D avatar. The player can customize it before they start. |
| **Custom Player Avatar** | **Advanced mode only**, and only with **3D Player Avatar** on. Your own `.vrm` or `.glb` replaces the bundled model. **Preview** opens it, and **Remove** goes back to the default. |
| **Persona Choice** | **Advanced mode only.** Decides who the player can be: **Open**, **Fixed** or **Cast**. See [Personas for Authors](Persona-Authoring#persona-choice). |
| **Background Music** | The track the world plays. Drop a file on the box, or click the box to pick one. |

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

- **Link when your world has many pictures.** A published world stays small.
- **Upload when the picture must never disappear.**

A linked image shows a 🔗 badge. Two badges are warnings:

| Badge | Means | What to do |
|---|---|---|
| **Expiring link** | Discord attachment links stop working after a while. Later players won't see the picture. Discord's permanent addresses (avatars, emojis, server icons) are fine. | Use a permanent host, or upload the file |
| **Linked image, display only** | The site won't let Formamorph download the picture. It shows online. It won't work offline, and it can't go into a character card. | Upload the file |

> 💡 **Make Available Offline** in a world's details window downloads all its linked pictures at once. Use it before you lose your connection.

When you export a world with linked pictures, you choose: keep the links for a small file, or download the pictures into the file so it works anywhere. A **character card** export always downloads the portrait, because the card is the picture.
