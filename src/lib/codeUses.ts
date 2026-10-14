/**
 * The row Find All Uses lists, one per box and line, for a stat or any other item a card names.
 */

import type { CodeOwners, StatCodeBox } from './statCodeTargets';
import type { StatCodeTiming } from './statCodeTiming';

/** One box and line that uses the item. */
export interface CodeUse {
  /** The entity whose Stats tab holds the box. Null for a world or Blueprint stat. */
  entityId: string | null;
  /** The row the stat list selects to show the box: a Link's row for a Link's box. */
  rowId: string;
  timing: StatCodeTiming;
  /** The box's stat, by code name. */
  stat: string;
  /** The entity an own or Link box sits on, by code name. */
  entity?: string;
  /** From 1. */
  line: number;
  /** A Blueprint box no owner runs. */
  noOwners: boolean;
}

const lineAt = (code: string, at: number) => code.slice(0, at).split('\n').length;

/** The row the World Editor selects for a box: a stat Link's root row carries the Link's id. */
function rowIdOf(box: StatCodeBox): string {
  if (box.home.kind !== 'link') return box.home.statId;
  const { linkId, statId } = box.home;
  const link = box.entity?.statLinks?.find((candidate) => candidate.id === linkId);
  return link?.originalId === statId ? linkId : statId;
}

/** One row per line of `box` that holds one of `offsets`, in line order. */
export function boxUses(owners: CodeOwners, box: StatCodeBox, offsets: readonly number[]): CodeUse[] {
  const lines = [...new Set(offsets.map((at) => lineAt(box.code, at)))].sort((a, b) => a - b);
  const entity = box.entity ? owners.codeName(box.entity.name) : undefined;
  return lines.map((line) => ({
    entityId: box.entity?.id ?? null,
    rowId: rowIdOf(box),
    timing: box.timing,
    stat: owners.codeName(box.stat.name),
    ...(entity !== undefined ? { entity } : {}),
    line,
    noOwners: box.home.kind === 'stat' && box.owner !== null && !box.runs.length,
  }));
}
