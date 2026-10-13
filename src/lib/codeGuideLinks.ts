/**
 * Where each global's hover card sends a reader in the Guide: one table per code surface, global to page and
 * heading. `console` has no row: it only logs, so no section explains it.
 */

import type { DocTarget } from '@/lib/docs/docsLinks';

/** A heading of the Stat Code Guide. */
const statCode = (anchor: string): DocTarget => ({ page: 'StatCodeGuide', anchor });

/** A heading of the Tools doc. */
const tools = (anchor: string): DocTarget => ({ page: 'Tools', anchor });

/** The Stat Code Guide heading of each stat code global. */
export const STAT_CODE_GUIDE_LINKS: Readonly<Record<string, DocTarget>> = {
  self: statCode('self'),
  stats: statCode('stats'),
  owner: statCode('owner'),
  clock: statCode('the-story-clock'),
  traits: statCode('traits'),
  placeholders: statCode('placeholders'),
  entities: statCode('entities'),
  persona: statCode('persona'),
  dictionaries: statCode('dictionaries'),
};

/** The Tools doc heading of each Tool script global. */
export const TOOL_GUIDE_LINKS: Readonly<Record<string, DocTarget>> = {
  args: tools('args'),
  world: tools('world'),
  scene: tools('scene'),
  placeholders: tools('placeholders'),
};
