# 08: Location Galleries

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

An export-shape change to a shipped field with a migration, a new rule owner for rows with no bearer, and four hosts (location panel, Media image panel, media index, play backdrop). Migration and play both carry risk, so Opus.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

A location gets a gallery like an entity's, with Visibility rules on each image (Q47–Q49).

- **Shape:** a location's `backgroundImage` becomes `images`, the same gallery shape entities use, each image with optional rule rows. `migrateWorld` moves an existing background into slot 0, idempotently, at every import boundary. A read-through helper covers records written before the gallery, as the entity gallery's does. This is an export-shape change to a shipped field; the user approved the migration (Q47).
- **Rule owner:** a row with no bearer reads the played persona (Q48), since a location has no stats or traits of its own. Rows that name a bearer or read Global work as they do for entities. The time Condition from ticket 07 works here once it lands.
- **Play:** the backdrop shows the location's first visible image in author order. When none passes its rules, it shows the default background (Q49). Rules settle on the same per-turn snapshot as entity images.
- **Location panel:** the location panel's Media tab hosts the gallery widget with unbounded slots and the rule cog, like the entity Profile tab.
- **Media tab:** the media index lists a location's images as gallery items with their rules; a location with two or more images stacks; the image panel (ticket 05) shows the Visibility rule editor for a location's framed image too. Filters, sizes and Optimize Images cover every location image.
- Other readers of the old field (embedding remote images, image optimize, the authoring tour, editor history labels) move to the gallery.

Ship the docs it stales: the Locations and Visibility rule wiki pages, and the Media tab page. Changelog fragment of its own, plus the export-shape reminder in the landing message.

## Acceptance criteria

- [ ] An old world with a `backgroundImage` loads with that image in slot 0 of `images`; loading it twice changes nothing
- [ ] A location can hold several images and reorder them; slot 0 is the primary
- [ ] A location image with a rule shows in play only while a row holds
- [ ] A bearer-less stat Condition on a location image reads the played persona's stat
- [ ] With no visible image, play shows the default background
- [ ] The location panel's Media tab shows the gallery with the rule cog
- [ ] The Media tab stacks a multi-image location and its image panel edits the framed image's rule
- [ ] Optimize Images and the Over Size Budget filter cover every location image
- [ ] Export, publish and import keep a location's gallery and rules
- [ ] Frames: `.scratch/frames/location-gallery-panel-dark.png` and `.scratch/frames/location-gallery-media-light.png` at 1600×900

For you: play a location with a wounded and a healthy backdrop and watch the swap as Health crosses the line.
