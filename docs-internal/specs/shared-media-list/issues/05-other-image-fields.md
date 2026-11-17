# 05: Other Image Fields

Status: ready-for-human
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The rest of the world's images move onto the Media List (Q1): item images, map images, body backdrop images and the world cover. Each follows ticket 03's pattern and uses ticket 04's picker slot.

- The `migrateWorld` step from ticket 03 extends to these fields, merging identical files.
- Every reader of these fields resolves through the resolver: item rows and the doll, the map background, body backdrops, the world cover in the library, menu and publish.
- Their editor fields use the picker slot.
- Dictionary covers stay embedded.

## Acceptance criteria

- [x] A world with item images, map images, a backdrop image and a cover migrates on load, idempotently, and shows the same in the editor and in play. `mediaImages.test.ts` › "is idempotent", "reads the same pictures through the resolver as before", "play shows an item picture and the map through the list"; `bundledWorlds.test.ts` on all seven worlds; mutating the item and backdrop readers goes red.
- [x] An item and an entity using the same picture link one entry. "links an item and an entity that use the same picture to one entry".
- [x] Each of these fields can Import, Choose and Unlink through the picker slot, checked by slot-write tests (`writeMediaSlot` for cover, backdrop, item and map) and by typecheck. Not rendered in a browser.
- [x] The world cover still shows on the library card and in the publish dialog: each boundary (store, publish payload, download, review install) reads it through `coverData`. Not rendered in a browser.
- [x] A dictionary cover is unchanged. "keeps a body backdrop opacity and a dictionary cover embedded".

> ⚠️ Export shape: these fields now hold ids in world JSON. Remind the user.

## Landed

**Not verified:**
- No frames: the cover, backdrop, item and map slots were not rendered in the browser pane.
- The library card, publish dialog and review install were not opened.
- Choose is not offered on a cover or backdrop that is still embedded (a world with no list, Q26).

**For you:**
- Open a world with a cover, a Custom Image backdrop, items with pictures and a Map Background. Check each shows as before in the editor and in play.
- Try Import, Choose and Remove From Slot on the world cover (Overview) and on a Body's Custom Image.

**For later tickets:**
- Item pictures have no card in the Media tab, so the picker slot lives in the Item editor only.
- The Authoring Tour's cover example still writes embedded data; the next load moves it into the list.
- An unnamed Body's entry is named `Body 1` by migration but `Unnamed Body 1` by a slot write.
