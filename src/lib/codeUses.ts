/**
 * The row Find All Uses lists, one per box and line, for a stat or any other item a card names.
 */

import type { CodeOwners, StatCodeBox, TraitCodeBox } from './statCodeTargets';
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
  timing: ScriptTiming;
  /** The script the box edits. */
  scriptId: string;
  /** The box's stat or trait, by code name. */
  name: string;
  /** The entity an own or Link box sits on, by code name. */
  entity?: string;
  /** From 1. */
  line: number;
  /** A Blueprint box no owner runs. */
  noOwners: boolean;
}

const lineAt = (code: string, at: number) => code.slice(0, at).split('\n').length;

/** The row the World Editor selects for a box: a Link's root row carries the Link's id, and a row below it
 *  the Link's row id for the item. */
function rowIdOf(box: StatCodeBox | TraitCodeBox): string {
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
export function boxUses(owners: CodeOwners, box: StatCodeBox | TraitCodeBox, offsets: readonly number[]): CodeUse[] {
  const lines = [...new Set(offsets.map((at) => lineAt(box.code, at)))].sort((a, b) => a - b);
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
