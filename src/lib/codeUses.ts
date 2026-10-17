/**
 * The row Find All Uses lists, one per box and line, for a stat or any other item a card names.
 */

import {
  isWorldScriptBox, isWorldToolBox, type CodeOwners, type StatCodeBox, type TraitCodeBox, type WorldScriptBox, type WorldToolBox,
} from './statCodeTargets';
import { linkRowId } from './traitTree';
import type { ScriptTiming } from '@/types';

/** One box and line that uses the item. */
export interface CodeUse {
  /** The entity whose Stats or Traits tab holds the box. Null for a world or Blueprint stat or trait. */
  entityId: string | null;
  /** The row the list selects to show the box: a Link's row for a Link's box. */
  rowId: string;
  /** On a trait's script; absent on a stat's. */
  trait?: true;
  /** On a world script, which the Scripts tab shows; `rowId` is then the script's id. */
  world?: true;
  /** On a World Tool's script, which the Tools tab shows; `rowId` and `scriptId` are then the Tool's id. */
  tool?: true;
  timing: ScriptTiming;
  /** The script the box edits. */
  scriptId: string;
  /** The box's stat or trait, by code name; the world's name for a world script; the Tool's name for a World Tool. */
  name: string;
  /** The entity an own or Link box sits on, by code name. */
  entity?: string;
  /** From 1. */
  line: number;
  /** A Blueprint box no owner runs. */
  noOwners: boolean;
}

const lineAt = (code: string, at: number) => code.slice(0, at).split('\n').length;

/** What a world script's rows and offers call its owner. */
export const WORLD_SCRIPT_OWNER = 'World';

/** The row the World Editor selects for a box: a Link's root row carries the Link's id, and a row below it
 *  the Link's row id for the item. */
export function rowIdOf(box: StatCodeBox | TraitCodeBox): string {
  switch (box.home.kind) {
    case 'stat': case 'entity': return box.home.statId;
    case 'trait': case 'entityTrait': return box.home.traitId;
    case 'link': {
      const { linkId, statId } = box.home;
      const link = box.entity?.statLinks?.find((candidate) => candidate.id === linkId);
      return link?.originalId === statId ? linkId : statId;
    }
    case 'traitLink': {
      const { linkId, traitId } = box.home;
      const link = box.entity?.traitLinks?.find((candidate) => candidate.id === linkId);
      return link?.originalId === traitId ? linkId : linkRowId(linkId, traitId);
    }
  }
}

/** One row per line of `box` that holds one of `offsets`, in line order. */
export function boxUses(owners: CodeOwners, box: StatCodeBox | TraitCodeBox | WorldScriptBox | WorldToolBox, offsets: readonly number[]): CodeUse[] {
  const lines = [...new Set(offsets.map((at) => lineAt(box.code, at)))].sort((a, b) => a - b);
  if (isWorldToolBox(box)) {
    return lines.map((line) => ({
      entityId: null, rowId: box.id, tool: true as const, timing: box.timing, scriptId: box.id, name: box.tool.name, line, noOwners: false,
    }));
  }
  if (isWorldScriptBox(box)) {
    return lines.map((line) => ({
      entityId: null, rowId: box.id, world: true as const, timing: box.timing, scriptId: box.id, name: WORLD_SCRIPT_OWNER, line, noOwners: false,
    }));
  }
  const entity = box.entity ? owners.codeName(box.entity.name) : undefined;
  const isTrait = 'trait' in box;
  return lines.map((line) => ({
    entityId: box.entity?.id ?? null,
    rowId: rowIdOf(box),
    ...(isTrait ? { trait: true as const } : {}),
    timing: box.timing,
    scriptId: box.id,
    name: owners.codeName(isTrait ? box.trait.name : box.stat.name),
    ...(entity !== undefined ? { entity } : {}),
    line,
    noOwners: (box.home.kind === 'stat' || box.home.kind === 'trait') && box.owner !== null && !box.runs.length,
  }));
}
