/**
 * Whether a world's After the AI scripts can change the turn's choices (Q8): any After the AI box that names `turn`
 * marks it, so the game holds the choices until that batch lands (Q7).
 */

import { filledScriptsAt } from './scripts';
import { namesTurn } from './statCodeWriteScan';
import { worldScriptList, type ScriptTreeWorld } from './worldScripts';

/** Whether any After the AI box of `world` names `turn`: world scripts, stats, traits and links, Blueprints included. */
export const scriptsChangeChoices = (world: ScriptTreeWorld): boolean =>
  worldScriptList(world, (home) => filledScriptsAt(home, 'after')).some(({ box }) => namesTurn(box.code));

/** Whether two choice lists hold the same items in the same order. */
export const sameChoices = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, i) => item === b[i]);
