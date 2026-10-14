/**
 * Find All Uses for a stat: every box and line whose code reaches that exact stat, on any route, `self`
 * included. Read through the shared route resolution, so it lists what the rename planner rewrites.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import { boxUses, type CodeUse } from './codeUses';
import {
  boxReferences, routeTargets, statCodeBoxes, type CodeOwners, type CodeRun, type StatTarget,
} from './statCodeTargets';

/** The stat a search names. No entity is a world or Blueprint stat; a Blueprint stat stands for every copy. */
export interface StatUseItem {
  statId: string;
  entityId?: string;
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

export function statUses(owners: CodeOwners, item: StatUseItem): CodeUse[] {
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
