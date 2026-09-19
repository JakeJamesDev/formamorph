# 🌍 World Editor: Overview

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The world's own tab: its name, description, thumbnail and the AI-facing text that frames every turn. It is two columns rather than a list and a panel. On a phone they stack, left column first.

## The left column — how your world is listed

| Field | What it does |
|---|---|
| **World Name** | The title on the library card and in every menu. |
| **Author** | Your name on the card. |
| **Tags** | The words the community browser filters on. |
| **Thumbnail** | The card's picture. **Generate with AI** sits under the frame and writes one from your description. |
| **3D Player Avatar** | Gives this world a 3D avatar. The player can customize it before they start. |
| **Custom Player Avatar** | **Advanced mode only.** Your own `.vrm` or `.glb` in place of the bundled model. **Preview** opens it; **Remove** returns to the default. |
| **Background Music** | The track the world plays. Drop a file on the box, or click it to pick one. |

## The right column — what you write

| Field | What it does |
|---|---|
| **World Description** | The blurb on the library card. Players read it before they play, so placeholders stay as plain text here. |
| **Readme** | Two tabs. **Introduction** shows before the player makes any setup choices; **Gameplay** shows when they enter the world. Both take markdown. |
| **System Prompt Addition** | Text added to the narrator's prompt on every turn of this world. |
| **Custom Prompts** | **Advanced mode only.** Replaces the player's own narration, choices or stats prompt. Its **Openings** item holds the world's [Openings](World-Editor-Openings). |
| **Persona Choice** | **Advanced mode only.** Decides who the player can be: **Open**, **Fixed** or **Cast**. See [Personas for Authors](Persona-Authoring#persona-choice). |

## Upload or link

Every image field takes either an uploaded file or a web address pasted into the **Or paste an image URL** box. The difference is where the picture lives:

| | Uploaded | Linked |
|---|---|---|
| Stored in your world | Yes — full size counts toward the file | No — just the address |
| Works offline | Always | After you've seen it once, or via **Make Available Offline** |
| Survives the host going away | Always | No |

**Link when your world has a lot of pictures** — a published world stays small no matter how many it carries. **Upload when it matters that the picture can't disappear.**

A linked slot shows a 🔗 marker. Two of them are warnings worth reading:

- **Expiring link** — Discord *attachment* links stop working after a while, so the picture will vanish for anyone playing later. Discord's permanent addresses (avatars, emojis, server icons) are fine.
- **Display only** — that site won't let Formamorph download the picture. It shows normally online, but can't be saved for offline use or put into a character card. Uploading the file instead is the fix.

> 💡 **Make Available Offline** in a world's details window downloads all its linked pictures at once, so the world is ready before you lose your connection.

Exporting a world with linked pictures asks whether to keep the links (small file) or download them into it (works anywhere). Exporting a **character card** always downloads the portrait, because the card *is* the picture.
