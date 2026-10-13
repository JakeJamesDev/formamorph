/**
 * Find All Uses for a stat: every box and line whose code reaches that exact stat, on any route, `self`
 * included. Read through the shared route resolution, so it lists what the rename planner rewrites.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import {
  boxReferences, routeTargets, statCodeBoxes, type CodeOwners, type CodeRun, type StatCodeBox, type StatTarget,
} from './statCodeTargets';
import type { StatCodeTiming } from './statCodeTiming';

/** The stat a search names. No entity is a world or Blueprint stat; a Blueprint stat stands for every copy. */
export interface StatUseItem {
  statId: string;
  entityId?: string;
}

/** One box and line that uses the stat. */
export interface CodeStatUse {
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
  /** A Blueprint box no bearer runs. */
  noBearers: boolean;
}

/** Each place `self` is read, unless the code declares its own. */
function selfOffsets(code: string): number[] {
  if (!code.includes('self')) return [];
  const found: number[] = [];
  const cursor = javascriptLanguage.parser.parse(code).cursor();
  do {
    if (code.slice(cursor.from, cursor.to) !== 'self') continue;
    if (cursor.type.name === 'VariableDefinition') return [];
    if (cursor.type.name === 'VariableName') found.push(cursor.from);
  } while (cursor.next());
  return found;
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
export function boxUses(owners: CodeOwners, box: StatCodeBox, offsets: readonly number[]): CodeStatUse[] {
  const lines = [...new Set(offsets.map((at) => lineAt(box.code, at)))].sort((a, b) => a - b);
  const entity = box.entity ? owners.codeName(box.entity.name) : undefined;
  return lines.map((line) => ({
    entityId: box.entity?.id ?? null,
    rowId: rowIdOf(box),
    timing: box.timing,
    stat: owners.codeName(box.stat.name),
    ...(entity !== undefined ? { entity } : {}),
    line,
    noBearers: box.home.kind === 'stat' && box.owner !== null && !box.runs.length,
  }));
}

export function statUses(owners: CodeOwners, item: StatUseItem): CodeStatUse[] {
  const reaches = ({ owner, stat }: StatTarget) =>
    stat.id === item.statId && (item.entityId === undefined || owner.entity?.id === item.entityId);
  return statCodeBoxes(owners).flatMap((box) => {
    const runs: CodeRun[] = [{ self: box.stat, owner: box.owner }, ...box.runs];
    return boxUses(owners, box, [
      ...(runs.some((run) => routeTargets(owners, run, { root: 'self', stat: null }).some(reaches)) ? selfOffsets(box.code) : []),
      ...boxReferences(owners, box).filter((reference) => reference.targets.some(reaches)).map((reference) => reference.from),
    ]);
  });
}
