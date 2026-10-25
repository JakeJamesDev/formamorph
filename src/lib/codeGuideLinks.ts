/**
 * Where each global's hover card sends a reader in the Guide: one table per code surface, global to page and
 * heading. `console` has no row: it only logs, so no section explains it.
 */

import type { DocTarget } from '@/lib/docs/docsLinks';

/** A heading of the Scripts Guide. */
const scripts = (anchor: string): DocTarget => ({ page: 'ScriptsGuide', anchor });

/** A heading of the Tools doc. */
const tools = (anchor: string): DocTarget => ({ page: 'Tools', anchor });

/** The Scripts Guide heading of each script global. A script's timing decides which of them it reads. */
export const STAT_CODE_GUIDE_LINKS: Readonly<Record<string, DocTarget>> = {
  self: scripts('self'),
  stats: scripts('stats'),
  owner: scripts('owner'),
  clock: scripts('the-story-clock'),
  turn: scripts('turn'),
  // The Location section covers both until the Guide gains its own Locations heading.
  locations: scripts('location'),
  location: scripts('location'),
  discover: scripts('discover'),
  // The Memory section covers the list and its verbs.
  memories: scripts('memory'),
  notes: scripts('notes'),
  traits: scripts('traits'),
  placeholders: scripts('placeholders'),
  entities: scripts('entities'),
  persona: scripts('persona'),
  dictionaries: scripts('dictionaries'),
  narration: scripts('narration'),
  player: scripts('player'),
  trait: scripts('trait'),
};

/** The Tools doc heading of `args`, which only a Tool's script reads. */
export const ARGS_GUIDE_LINK: DocTarget = tools('args');

/** The Guide heading of each user Tool script global: `args` in the Tools doc, the script surface's in the Scripts
 *  Guide, as a Script's card links them (Q24). */
export const TOOL_GUIDE_LINKS: Readonly<Record<string, DocTarget>> = {
  args: ARGS_GUIDE_LINK,
  ...Object.fromEntries((['stats', 'clock', 'turn', 'locations', 'location', 'memories', 'notes', 'placeholders', 'traits', 'entities', 'persona', 'dictionaries'] as const)
    .map((name) => [name, STAT_CODE_GUIDE_LINKS[name]])),
};

/** The Guide heading of each World Tool script global: every script global's, and `args`. */
export const WORLD_TOOL_GUIDE_LINKS: Readonly<Record<string, DocTarget>> = { ...STAT_CODE_GUIDE_LINKS, args: ARGS_GUIDE_LINK };
