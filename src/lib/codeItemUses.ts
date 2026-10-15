/**
 * Find All Uses for a trait, placeholder, entity or dictionary: every box and line whose name reaches that
 * item. Each name is read through its card, and a route over several owners through each owner too.
 */

import { codeCard, reachedPlaceholderOwners, type CodeCardItem } from './codeCards';
import { boxUses, type CodeUse } from './codeUses';
import { traitBoxSelf, type CodeBox, type CodeCardWorld, type CodeWorldLookup } from './codeWorldLookup';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import { cardWorldNames, statBoxAnalysisOptions } from './statCodeBoxOptions';
import { parseCode, resolveCodeName } from './statCodeResolver';
import { scriptSurface, STAT_CODE_SURFACE, TRAIT_SCRIPT_SURFACE, WORLD_SCRIPT_SURFACE } from './statCodeSurface';
import {
  statCodeBoxes, traitCodeBoxes, worldScriptBoxes, type CodeOwners, type StatCodeBox, type TraitCodeBox,
} from './statCodeTargets';

/** An item other than a stat. */
export type OtherUseItem = Exclude<CodeCardItem, { kind: 'stat' }>;

/** The nodes a card can name: identifiers, members and bracket keys. */
const NAME_NODES = new Set(['VariableName', 'PropertyName', 'String']);

/** Whether a card's item is the searched one. A Blueprint placeholder stands for every Copy of it too. */
function matcherOf(item: OtherUseItem, world: CodeCardWorld): (found: CodeCardItem) => boolean {
  switch (item.kind) {
    case 'trait': return (found) => found.kind === 'trait' && found.traitId === item.traitId;
    case 'entity': return (found) => found.kind === 'entity' && found.entityId === item.entityId;
    case 'dictionary': return (found) => found.kind === 'dictionary' && found.dictionaryId === item.dictionaryId;
    case 'placeholder': {
      const copies = new Set(world.placeholders.filter((p) => p.blueprintId === item.placeholderId).map((p) => p.id));
      return (found) => found.kind === 'placeholder' && (found.placeholderId === item.placeholderId || copies.has(found.placeholderId));
    }
  }
}

/** What the name at `pos` reaches: its card's item, and each owner's where its route reaches several (T12-4). */
function itemsAt(code: string, pos: number, options: SurfaceAnalysisOptions): CodeCardItem[] {
  const item = codeCard(code, pos, options)?.item;
  const items = item ? [item] : [];
  const name = resolveCodeName(code, pos, options);
  if (!name || !('owner' in name) || (name.owner.route !== 'owner' && name.owner.route !== 'persona')) return items;
  if (name.kind === 'trait') {
    items.push(...(options.lookup?.traits(name.owner, name.key) ?? []).map(({ trait }): CodeCardItem => ({ kind: 'trait', traitId: trait.id })));
  }
  if (name.kind === 'placeholder') {
    items.push(...reachedPlaceholderOwners(name.owner, name.path, options).map(({ placeholder }): CodeCardItem => ({ kind: 'placeholder', placeholderId: placeholder.id })));
  }
  return items;
}

/** Each place in `code` whose name reaches a matching item. */
function matchingOffsets(code: string, options: SurfaceAnalysisOptions, matches: (found: CodeCardItem) => boolean): number[] {
  const found: number[] = [];
  const cursor = parseCode(code).cursor();
  do {
    if (!NAME_NODES.has(cursor.type.name)) continue;
    if (itemsAt(code, Math.floor((cursor.from + cursor.to) / 2), options).some(matches)) found.push(cursor.from);
  } while (cursor.next());
  return found;
}

const boxOwnerOf = (box: StatCodeBox | TraitCodeBox): CodeBox['owner'] => {
  if (box.entity) return { kind: 'entity', entityId: box.entity.id };
  return box.owner ? { kind: 'blueprint' } : null;
};

/** Every box and line whose code names the item, with each box read under the options its editor gives it. */
export function itemUses(
  owners: CodeOwners, world: CodeCardWorld, item: OtherUseItem, lookupOf: (box: CodeBox) => CodeWorldLookup,
): CodeUse[] {
  const names = cardWorldNames(world);
  const matches = matcherOf(item, world);
  // A world script's box reads with no `self` and no owner, as the Scripts tab reads it.
  const worldBoxUses = worldScriptBoxes(world).flatMap((box) => {
    const options = statBoxAnalysisOptions(names, {
      selfName: '', surface: scriptSurface(WORLD_SCRIPT_SURFACE, box.timing),
      // A lookup takes a stat as `self`; a blank one stands in for the empty `self`.
      lookup: lookupOf({ owner: null, timing: box.timing, self: traitBoxSelf('', '') }),
    });
    return boxUses(owners, box, matchingOffsets(box.code, options, matches));
  });
  const statBoxUses = statCodeBoxes(owners).flatMap((box) => {
    const owner = boxOwnerOf(box);
    const selfName = owners.codeName(box.stat.name);
    const options = statBoxAnalysisOptions(names, {
      selfName, surface: scriptSurface(STAT_CODE_SURFACE, box.timing),
      ...(owner && { owner: { kind: owner.kind, statNames: box.owner?.stats.map((stat) => owners.codeName(stat.name)) ?? [] } }),
      lookup: lookupOf({ owner, timing: box.timing, self: { ...box.stat, name: selfName } }),
    });
    return boxUses(owners, box, matchingOffsets(box.code, options, matches));
  });
  // A trait's box reads as its editor reads it: `self` is the trait, and a Blueprint trait's owner names go unchecked.
  const traitBoxUses = traitCodeBoxes(owners, world).flatMap((box) => {
    const owner = boxOwnerOf(box);
    const selfName = owners.codeName(box.trait.name);
    const self = traitBoxSelf(box.trait.id, selfName);
    const options = statBoxAnalysisOptions(names, {
      selfName, surface: scriptSurface(TRAIT_SCRIPT_SURFACE, box.timing),
      ...(owner && { owner: { kind: owner.kind, ...(box.entity && { statNames: box.owner?.stats.map((stat) => owners.codeName(stat.name)) ?? [] }) } }),
      lookup: lookupOf({ owner, timing: box.timing, self }),
    });
    return boxUses(owners, box, matchingOffsets(box.code, options, matches));
  });
  return [...worldBoxUses, ...statBoxUses, ...traitBoxUses];
}
