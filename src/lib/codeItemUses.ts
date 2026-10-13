/**
 * Find All Uses for a trait, placeholder, entity or dictionary: every box and line whose name reaches that
 * item. Each name is read through its card, and a route over several holders through each holder too.
 */

import { codeCard, type CodeCardItem } from './codeCards';
import { boxUses, type CodeStatUse } from './codeStatUses';
import type { CodeBox, CodeCardWorld, CodeWorldLookup } from './codeWorldLookup';
import { placeholderAt, type SurfaceAnalysisOptions } from './statCodeAnalysis';
import { codeDictionaries } from './statCodePlaceholders';
import { parseCode, resolveCodeName, type PlaceholderOwner } from './statCodeResolver';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { statCodeBoxes, type CodeOwners, type StatCodeBox } from './statCodeTargets';
import { entityTraitNames, worldTraitPlaces } from './statCodeTraits';
import type { Placeholder } from '@/types';

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

/** The placeholder a route over several holders reaches in each one, read as if that holder were the only one. */
function holderPlaceholders(owner: PlaceholderOwner, path: readonly string[], options: SurfaceAnalysisOptions): Placeholder[] {
  const { lookup } = options;
  const narrowed: SurfaceAnalysisOptions[] = owner.route === 'owner' && lookup
    ? lookup.ownerEntityIds().map((id) => ({ ...options, lookup: { ...lookup, ownerEntityIds: () => [id] } }))
    : owner.route === 'persona'
      ? (options.entities ?? []).filter((entity) => entity.persona).map((entity) => ({ ...options, entities: [entity] }))
      : [];
  return narrowed.flatMap((each) => placeholderAt(owner, path, each) ?? []);
}

/** What the name at `pos` reaches: its card's item, and each holder's where its route reaches several (T12-4). */
function itemsAt(code: string, pos: number, options: SurfaceAnalysisOptions): CodeCardItem[] {
  const item = codeCard(code, pos, options)?.item;
  const items = item ? [item] : [];
  const name = resolveCodeName(code, pos, options);
  if (!name || !('owner' in name) || (name.owner.route !== 'owner' && name.owner.route !== 'persona')) return items;
  if (name.kind === 'trait') {
    items.push(...(options.lookup?.traits(name.owner, name.key) ?? []).map(({ trait }): CodeCardItem => ({ kind: 'trait', traitId: trait.id })));
  }
  if (name.kind === 'placeholder') {
    items.push(...holderPlaceholders(name.owner, name.path, options).map((p): CodeCardItem => ({ kind: 'placeholder', placeholderId: p.id })));
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

const boxOwnerOf = (box: StatCodeBox): CodeBox['owner'] => {
  if (box.entity) return { kind: 'entity', entityId: box.entity.id };
  return box.owner ? { kind: 'blueprint' } : null;
};

/** Every box and line whose code names the item, with each box read under the options its editor gives it. */
export function itemUses(
  owners: CodeOwners, world: CodeCardWorld, item: OtherUseItem, lookupOf: (box: CodeBox) => CodeWorldLookup,
): CodeStatUse[] {
  const { placeholders } = world;
  const shared = {
    surface: STAT_CODE_SURFACE,
    statNames: owners.world.stats.map((stat) => owners.codeName(stat.name)),
    placeholders: { list: placeholders, owners: world.placeholderOwners, dictionaries: codeDictionaries(world.dictionaries, placeholders) },
    traits: worldTraitPlaces(world, placeholders).map((trait) => trait.name),
    entities: entityTraitNames(world, placeholders),
  };
  const matches = matcherOf(item, world);
  return statCodeBoxes(owners).flatMap((box) => {
    const owner = boxOwnerOf(box);
    const selfName = owners.codeName(box.stat.name);
    const options: SurfaceAnalysisOptions = {
      ...shared,
      ...(owner && { owner: owner.kind }),
      ownerStatNames: box.owner?.stats.map((stat) => owners.codeName(stat.name)) ?? [],
      selfName,
      lookup: lookupOf({ owner, timing: box.timing, self: { ...box.stat, name: selfName } }),
    };
    return boxUses(owners, box, matchingOffsets(box.code, options, matches));
  });
}
