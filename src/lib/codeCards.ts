/**
 * What a hover card says about the name at a position. A pure reading of the code through the one resolver,
 * so the card and the completion list never describe a name two ways. The editor only draws the model.
 */

import { isMethodEntry, type CodeAccess, type SurfaceEntry } from '@/lib/codeSurface';
import { isUnknownEntry, memberEntries, type SurfaceAnalysisOptions } from '@/lib/statCodeAnalysis';
import { isIdentifier } from '@/lib/statCodePaths';
import { resolveCodeName, type CodeMapOwner, type CodeValue } from '@/lib/statCodeResolver';

/** What a card names: a sandbox global, a member of one, or an entry of one of the world's maps. */
export type CodeCardKind = 'global' | 'property' | 'method' | 'stat' | 'trait' | 'placeholder' | 'entity' | 'dictionary';

/** The card's first line: what the name is, the path it reads as, and its type. */
export interface CodeCardSignature {
  kind: CodeCardKind;
  path: string;
  type: string;
}

export interface CodeCard {
  /** The span of code the card describes. */
  from: number;
  to: number;
  signature: CodeCardSignature;
  /** Absent where the name is no field a write could reach. */
  access?: CodeAccess;
  description?: string;
}

/** `base` and one key, by dot where the key allows it. */
const keyPath = (base: string, key: string) => (isIdentifier(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`);

/** The path to an owner's own maps, with its trailing dot. Empty for the world's maps. */
function ownerPrefix(owner: CodeMapOwner): string {
  switch (owner.route) {
    case 'world': return '';
    case 'owner': return 'owner.';
    case 'persona': return 'persona.';
    case 'entity': return `${keyPath('entities', owner.entity)}.`;
    case 'dictionary': return `${keyPath('dictionaries', owner.dictionary)}.`;
  }
}

/** What a member's path starts with: the type an entry of a map has, or the exact path of a one-off object. */
function holderName(value: CodeValue): string {
  switch (value.is) {
    case 'stat': return 'Stat';
    case 'statPrevious': return 'Stat.previous';
    case 'statDelta': return 'Stat.delta';
    case 'deltaSource': return `Stat.delta.${value.source}`;
    case 'trait': return 'Trait';
    case 'placeholders': return 'Placeholder';
    case 'entity': case 'owner': return 'Entity';
    case 'dictionary': return 'Dictionary';
    case 'persona': return 'persona';
    case 'clock': case 'listed': return value.path;
    default: return value.is;
  }
}

const fromEntry = (
  entry: SurfaceEntry, kind: CodeCardKind, path: string, span: { from: number; to: number },
): CodeCard => ({
  ...span,
  signature: { kind, path, type: entry.detail },
  ...(entry.access ? { access: entry.access } : {}),
  description: entry.info,
});

/** The card for the name at `pos`, or null where the code names nothing a card can describe. */
export function codeCard(code: string, pos: number, options: SurfaceAnalysisOptions): CodeCard | null {
  const name = resolveCodeName(code, pos, options);
  // A misspelled name is the diagnostic's to explain, not a card's.
  if (!name || isUnknownEntry(name, options)) return null;
  const span = { from: name.from, to: name.to };
  const world = (kind: CodeCardKind, path: string, type: string): CodeCard => ({ ...span, signature: { kind, path, type } });
  switch (name.kind) {
    case 'global': {
      const entry = [...options.surface.globals, ...options.surface.builtins].find((candidate) => candidate.name === name.key);
      return entry ? fromEntry(entry, 'global', entry.name, span) : null;
    }
    case 'member': {
      // A member the value doesn't carry gets no card, though the resolver read the value as a stat.
      const entry = memberEntries(name.of, options)?.find((candidate) => candidate.name === name.key);
      return entry ? fromEntry(entry, isMethodEntry(entry) ? 'method' : 'property', `${holderName(name.of)}.${entry.name}`, span) : null;
    }
    case 'stat': return world('stat', keyPath(`${ownerPrefix(name.owner)}stats`, name.key), 'Stat');
    case 'trait': return world('trait', keyPath(`${ownerPrefix(name.owner)}traits`, name.key), 'Trait');
    case 'placeholder':
      return world('placeholder', name.path.reduce(keyPath, `${ownerPrefix(name.owner)}placeholders`), 'Placeholder');
    case 'entity': return world('entity', keyPath('entities', name.key), 'Entity');
    case 'dictionary': return world('dictionary', keyPath('dictionaries', name.key), 'Dictionary');
    default: return null;
  }
}
