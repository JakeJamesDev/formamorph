/**
 * DEV-only stand-in for the release notes the changelog popouts fetch from GitHub. Dynamically imported by
 * `#dev?view=mainMenu&modal=changelog` so the surface can be checked without the network, and so it always
 * shows every shape the notes can take — a minor group header, tinted current/newest version captions, a
 * category label, a feature group with nested entries, and a loose entry.
 */
export const DEV_CHANGELOG_SAMPLE = `## v2.13

### v2.13.0

**Added**

- Entities can be given a diary the AI reads back

## v2.12

### v2.12.1

**Added**

- **Image Generation**
  - Images generated through Automatic1111 or Forge are now kept on disk
  - The live preview fills a full-size panel
- A trait the author marked as yours to switch can now be taken mid-game

**Fixed**

- Clicking a suggestion in the stat code editor now inserts it

### v2.12.0

**Fixed**

- Switching a trait off gives back exactly what it took
`;
