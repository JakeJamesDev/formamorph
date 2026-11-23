# 🌍 World Editor: Overview
<!-- keywords: general info, metadata, main tab, world properties, basic details, two columns -->
<!-- route: worldEditor.overview -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The **Overview** tab holds the world's own details: its name, its library card, and the text the AI reads on every turn. It has two columns. On mobile, the left column shows first.

## How to Set the World's Images
<!-- keywords: thumbnail, cover, picture, banner, art, upload, icon, photo, logo, card artwork, drag and drop, illustration, paste a url, ai made artwork, preview graphic -->
<!-- route: worldEditor.overview#thumbnail -->

1. Open the **Overview** tab.
2. Under **Thumbnail**, select the frame (**Click to upload image**) and pick a file. You can also drop a file on the frame.
3. To link an image, paste its address into **Or paste an image URL** and select **Use this image URL**. See [Upload or link](#upload-or-link).
4. To make one, select **Generate with AI**. It shows when [image generation](Image-Generation#how-to-turn-on-image-generation) is on in Settings.
5. Select **Save**.

Each location's background is on its **Media** tab. See [World Editor: Locations](World-Editor-Locations#media). Each entity's image is on its **Profile** tab.

## How to Add Background Music
<!-- keywords: sound, audio, song, mp3, soundtrack, ambient, bgm, tune, playlist, ost, wav ogg, melody, jukebox -->
<!-- route: worldEditor.overview#background-music -->

1. Open the **Overview** tab.
2. Under **Background Music**, select **Import** and pick an audio file. **Choose** picks a sound the world already has, and **Or paste a sound URL** links one.
3. Select **Save**.

## Weather
<!-- keywords: rain, snow, storm, sun, bright sun, clear, sheltered, indoors, default weather, allowed weather, permanent rain, start weather -->
<!-- route: worldEditor.overview#weather -->

Every world has one weather at a time: **Clear**, **Rain**, **Snow**, **Storm** or **Bright Sun**. A new world allows Clear alone, so its sky stays clear. A save keeps the current weather.

| You pick | What happens |
| --- | --- |
| One kind | That is the weather all story long. Pick only Rain for a world where it always rains. |
| Two or more | The story changes the weather. After each turn, the AI reads what happened and picks the new weather from your kinds. |
| Nothing | The same as Clear alone. |

A storm in a figure of speech or a memory changes nothing. Bright Sun turns Clear when night falls. The AI narrator is told the current weather every turn, unless the world allows Clear alone.

1. Open the **Overview** tab.
2. Under **Weather**, pick the kinds the world can have.
3. With two or more kinds, you can pick a **Default Weather** to start games in. Leave it blank to let the AI read the weather from page one.
4. Select **Save**.

To mark a place indoors, check **Sheltered** on the location's **Details** tab. It shows once the world allows a kind other than Clear. A child location is not Sheltered unless you check it too.

To show the weather through a window, or keep it off the ground under an overhang, give the background image a [Weather Mask](World-Editor-Locations#weather-mask).

An [opening](World-Editor-Openings#start-weather) can set its own weather.

## The left column: how your world is listed
<!-- keywords: rename my world, title, creator credit, byline, genre labels, categories, restrict who player is, default hero -->

The world's Avatars are on the **Media** tab. See [World Editor: Media](World-Editor-Media#avatars).

| Field | What it does |
|---|---|
| **World Name** | The title on the library card and in every menu. |
| **Author** | Your name on the card. |
| **Tags** | The words the community browser filters on. |
| **Thumbnail** | The card's image. **Generate with AI** under the frame makes one from your Player-Facing Description, or from the AI-Facing Description when that is empty. |
| **Allowed Personas** | **Advanced mode only.** Decides which personas the player can pick: **Any** or **World Only**. See [Personas for Authors](Persona-Authoring#persona-rules). |
| **Starts On** | **Advanced mode only.** Decides which persona a new player starts on. See [Personas for Authors](Persona-Authoring#persona-rules). |
| **Background Music** | The track the world plays. A [sound slot](World-Editor-Entities#sound-slots): **Import**, **Choose** or paste a sound URL. **Remove From Slot** clears it. |

## The right column: Details
<!-- keywords: blurb, synopsis, system prompt, setting lore, welcome text, instructions page, markdown intro, what you write -->
<!-- route: worldEditorOverview.details -->

In Advanced mode, the right column has two tabs: **Details** and **Custom Prompts**. Simple mode shows only the **Details** fields, with no tabs. A world's openings have their own [Openings](World-Editor-Openings) tab, after **Overview**.

| Field | What it does |
|---|---|
| **Player-Facing Description** | The text on the library card and the community listing. Players read it before they play, so placeholders stay as plain text here. The AI never reads it. |
| **Readme** | Two tabs. **Introduction** shows before the player makes any setup choices. **Gameplay** shows when they enter the world. Both take markdown. |
| **AI-Facing Description** | The world's description for the AI. The AI reads it on every turn. Players never see it. |

## The right column: Custom Prompts
<!-- keywords: rules for narrator, override narration prompt, replace choices prompt, world prompt -->
<!-- route: worldEditorOverview.prompts -->

**Advanced mode only.** Replaces the player's own narration, choices or stats prompt. A list at the top shows **Narration**, **Choices** and **Stats**, each marked **Custom** or **Default**. Select one to edit it below the list.

- Check a prompt in the list to use your text. Unchecking it keeps your text.
- The player can decline it from the world's details window.
- **Reset** clears your text, so the prompt follows the player's prompt again.

## Upload or link
<!-- keywords: hotlink, external hosting, imgur, discord image broken, image not loading, dead url, shrink file size, embed vs host, works without internet -->

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

When you export a world with linked images, you pick one of two choices:

- Keep the links, for a small file.
- Download the images into the file, so it works anywhere.

An **entity card** export always downloads the portrait, because the card is the image.
