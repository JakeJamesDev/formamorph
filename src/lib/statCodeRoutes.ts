/**
 * The load-time rewrite of stat code's retired routes to the ones that replaced them: the flat clock names
 * to `clock`, `currentStatId` to `self.id`, and every `placeholders` path that reached an owned or nested
 * placeholder by an owner name or a bare name to that placeholder's one path.
 *
 * Every retired route reads nothing under the current sandbox, so rewriting one never changes what working
 * code does, and a second run finds nothing left to rewrite.
 */

import { javascriptLanguage } from '@codemirror/lang-javascript';
import type { SyntaxNode } from '@lezer/common';
import type { PlaceholderOwnerRef } from './placeholderHomes';
import { holderOf } from './placeholderTree';
import { codeRenameChains, spliced, type CodeRenameKey, type CodeSplice } from './statCodeRename';
import { statCodeName } from './statCodeNames';
import {
  memberStep, OWNER_GLOBAL, placeholderPathMap, walkPlaceholderPath,
  type PlaceholderPathMap, type PlaceholderPathNode, type PlaceholderPathSource,
} from './statCodePaths';

/** Each retired global, and its new route. */
const RETIRED_GLOBALS: ReadonlyMap<string, string> = new Map([
  ['deltaHours', 'clock.deltaHours'],
  ['elapsedHours', 'clock.elapsedHours'],
  ['day', 'clock.day'],
  ['daypart', 'clock.daypart'],
  ['startDay', 'clock.previous.day'],
  ['startDaypart', 'clock.previous.daypart'],
  ['currentStatId', 'self.id'],
]);

/** The reads of each retired global. A name the code declares, or whose new root it declares, is its own. */
function globalSplices(code: string): CodeSplice[] {
  if (![...RETIRED_GLOBALS.keys()].some((name) => code.includes(name))) return [];
  const declared = new Set<string>();
  const reads: SyntaxNode[] = [];
  javascriptLanguage.parser.parse(code).iterate({
    enter: (ref) => {
      const name = code.slice(ref.from, ref.to);
      if (ref.name === 'VariableDefinition') declared.add(name);
      else if (RETIRED_GLOBALS.has(name)) {
        // A shorthand property is both the key and the read.
        const parent = ref.node.parent;
        const shorthand = ref.name === 'PropertyDefinition' && parent?.name === 'Property'
          && parent.from === ref.from && parent.to === ref.to;
        if (ref.name === 'VariableName' || shorthand) reads.push(ref.node);
      }
    },
  });
  return reads.flatMap((node) => {
    const name = code.slice(node.from, node.to);
    const route = RETIRED_GLOBALS.get(name);
    if (!route || declared.has(name) || declared.has(route.split('.')[0])) return [];
    const insert = node.name === 'PropertyDefinition' ? `${name}: ${route}` : route;
    return [{ from: node.from, to: node.to, insert }];
  });
}

/** One node of the tree, and the owner whose entry reaches it. */
interface Reached {
  node: PlaceholderPathNode;
  owner?: PlaceholderOwnerRef;
}

/**
 * The top-level keys the retired `placeholders` map answered: a row the world holds, an owner by its code
 * name, and else any row by its bare name. Of two claims of one rank, the later wins.
 */
function retiredTopKeys(source: PlaceholderPathSource, map: PlaceholderPathMap): Map<string, Reached> {
  const byId = new Map<string, Reached>();
  const visit = (node: PlaceholderPathNode, owner?: PlaceholderOwnerRef) => {
    if (node.placeholder) {
      if (byId.has(node.placeholder.id)) return;
      byId.set(node.placeholder.id, { node, owner });
    }
    for (const child of node.children) visit(child, owner);
  };
  // Owners first, so an owned node keeps its owner however else the map reaches it.
  for (const node of map.owners.values()) visit(node, node.owner);
  for (const node of map.top) visit(node);

  const rows = new Map<string, Reached>();
  const fallbacks = new Map<string, Reached>();
  const claimed = new Set<string>();
  for (const p of source.list) {
    const owner = source.owners?.get(p.id);
    const held = holderOf(source.list, p);
    const ownerNode = owner && map.owners.get(owner.id);
    if (owner && !held && ownerNode && !claimed.has(owner.id)) {
      claimed.add(owner.id);
      rows.set(statCodeName(owner.name, source.list), { node: ownerNode, owner });
    }
    const reached = byId.get(p.id);
    if (reached) (owner || held ? fallbacks : rows).set(p.name, reached);
  }
  for (const [key, reached] of fallbacks) if (!rows.has(key)) rows.set(key, reached);
  return rows;
}

/** The owner entry's prefix: `entities.Molly.placeholders`. */
const ownerPrefix = (owner: PlaceholderOwnerRef, key: string) => `${OWNER_GLOBAL[owner.kind]}${key}.placeholders`;

/** The rewrite of one `placeholders` chain's first key, or null where it already reads its one path. */
function placeholderSplice(
  chain: readonly CodeRenameKey[], code: string, keys: ReadonlyMap<string, Reached>, map: PlaceholderPathMap,
): CodeSplice | null {
  const first = chain[0];
  const reached = keys.get(first.name);
  if (!reached) return null;
  const { node, owner } = reached;
  const span = { from: first.objectTo - 'placeholders'.length, to: first.memberTo };
  const authored = code.slice(first.objectTo, first.memberTo);
  if (!node.placeholder) return owner ? { ...span, insert: ownerPrefix(owner, authored) } : null;
  if (node.path.length === 1 && !owner) return null;
  // The path the editor names it by: owner first where it has one, then every holder above it.
  const holders = node.path.slice(owner ? 1 : 0, -1);
  const start = owner ? map.owners.get(owner.id) ?? null : null;
  if (walkPlaceholderPath(map, [...holders, node.name], start).node !== node) return null;
  const head = owner ? ownerPrefix(owner, memberStep(node.path[0])) : 'placeholders';
  return { ...span, insert: `${head}${holders.map(memberStep).join('')}${authored}` };
}

/** `code` with every retired route rewritten. `source` is the world's placeholder tree as authored. */
export function migrateStatCodeRoutes(code: string, source: PlaceholderPathSource): string {
  if (!code) return code;
  const edits = globalSplices(code);
  const chains = source.list.length ? codeRenameChains(code, 'placeholders') : [];
  if (chains.length) {
    const map = placeholderPathMap(source);
    const keys = retiredTopKeys(source, map);
    for (const chain of chains) {
      const edit = placeholderSplice(chain, code, keys, map);
      if (edit) edits.push(edit);
    }
  }
  return edits.length ? spliced(code, edits) : code;
}
