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
  location: scripts('location'),
  discover: scripts('discover'),
  memory: scripts('memory'),
  diary: scripts('diary'),
  traits: scripts('traits'),
  placeholders: scripts('placeholders'),
  entities: scripts('entities'),
  persona: scripts('persona'),
  dictionaries: scripts('dictionaries'),
  narration: scripts('narration'),
  player: scripts('player'),
  trait: scripts('trait'),
};

/** The Tools doc heading of each Tool script global. */
export const TOOL_GUIDE_LINKS: Readonly<Record<string, DocTarget>> = {
  args: tools('args'),
  world: tools('world'),
  scene: tools('scene'),
  placeholders: tools('placeholders'),
};
