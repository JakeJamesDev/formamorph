# itch.io page

Sources for the [Formamorph itch.io page](https://fierylion.itch.io/formamorph): the background, the description art and the description text.

## Rebuild

1. Start the dev server: `npm run dev -- --port 5180`
2. Run `npm run itch-page`. It writes everything to `thumbnails/itch-page/`.
   - `--only bg`, `--only art` or `--only paste` rebuilds one part.

| File | What it is |
|---|---|
| `background.html` | Background: blurred library shot, the column strip, and Aurelia and Praline in front of it |
| `poses.json` | Each avatar's bone rotations, expression weights and body turn |
| `backdrop.webp` | The library shot behind the avatars, pinned so the background does not drift |
| `art.html` | The wordmark, the section headers and the formamorph.ai button |
| `description.html` | The description text |
| `paste.template.html` | The copy page that wraps the description |

## Apply to itch

**Theme** (Edit theme on the game page):

| Setting | Value |
|---|---|
| BG | `#0d0f12` |
| BG 2 | `#111318`, BG2 Alpha at 0 |
| Text | `#e8eaed` |
| Link | `#c4b5fd` |
| Headers | `#c4b5fd` |
| Buttons | `#a78bfa` |
| Font | Lato, Large |
| Background image | `itch-bg.jpg`, no repeat, top center, fixed |

**Description:**

1. Open `thumbnails/itch-page/paste.html` in a browser and press **Copy**.
2. Paste it into the description editor.
3. Replace each `[upload …]` marker with that image from `thumbnails/itch-page/`, using the editor's image button. Link the globe button to `https://formamorph.ai`.

> 💡 itch keeps inline centering and images hosted on itch, but drops local images on paste. That is why the markers exist.
