/**
 * The two keys the Bench's seen record holds per finding: its identity, and a hash of its wording. Kept per
 * finding object, so a list that is marked again costs a lookup per finding rather than a hash.
 */
import type { Finding } from './rules';

export interface FindingKeys {
  /** The rule plus the items it names, so the same problem about the same items stays the same finding. */
  identity: string;
  /** What the finding currently says — its message and the names it uses. This is what an edit changes. */
  wording: string;
}

/** Order-insensitive so reordering a world's lists can't make an old finding read as a new one. */
export const findingIdentity = (finding: Finding): string =>
  [finding.ruleId, ...finding.items.map((item) => item.id).sort()].join('|');

// FNV-1a, so the record stores a few characters per finding rather than every message in full.
const hash = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};

const wording = (finding: Finding): string =>
  hash(JSON.stringify([finding.message, ...finding.items.map((item) => item.name)]));

const known = new WeakMap<Finding, FindingKeys>();

export function findingKeys(finding: Finding): FindingKeys {
  let keys = known.get(finding);
  if (!keys) known.set(finding, keys = { identity: findingIdentity(finding), wording: wording(finding) });
  return keys;
}

/** Record keys the worker computed alongside the pass. */
export function rememberFindingKeys(finding: Finding, keys: FindingKeys): void {
  known.set(finding, keys);
}
