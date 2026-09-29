// The shape the in-game Traits panel renders: the authored trait tree folded into one collapsible section
// per top-level group, with nested subgroups flattened to subheaders rather than nested accordions — a
// quarter-width panel has no room for depth, but the author's structure still has to reach the player.
//
// Pure and display-only: nothing here decides what a trait does, only where its row lands.

import { buildTraitTree, type TraitTreeNode } from './traitTree';
import { isAlwaysOn, isHidden } from './traitEffects';
import type { Trait, TraitGroup } from '@/types';

/** A run of traits under one (sub)group heading. A max-one block's traits are alternatives, not a set. */
export interface TraitBlock {
  key: string;
  /** Path of nested subgroup names ("Mutations › Major"), or null for the section group's own traits. */
  subheader: string | null;
  /** The group the traits sit in directly, whose pick count governs them; null outside any group. */
  group: TraitGroup | null;
  traits: Trait[];
  /** Set when the block sits in an entity node's subtree: the bearer whose traits these are. */
  entityId?: string;
  /** Set on the entity node's own block, which wears the node's heading. */
  entityNode?: true;
}

/** One collapsible section: a top-level group, "General", or the whole list when the world has no groups. */
export interface TraitSection {
  key: string;
  /** null = the flat, chrome-less case: no header, no collapsing. */
  name: string | null;
  blocks: TraitBlock[];
  /** Set when the section's group is an entity node. */
  entityId?: string;
}

const leaves = (nodes: TraitTreeNode[]): Trait[] =>
  nodes.flatMap((n) => (n.kind === 'leaf' ? [n.leaf] : []));
const subgroups = (nodes: TraitTreeNode[]): Extract<TraitTreeNode, { kind: 'group' }>[] =>
  nodes.flatMap((n) => (n.kind === 'group' ? [n] : []));
const holdsTraits = (node: TraitTreeNode): boolean =>
  node.kind === 'leaf' || node.children.some(holdsTraits);

/**
 * Fold the listed traits and the world's groups into panel sections, in authored order.
 *
 * Traits sitting outside any group become a "General" section, unless there is no populated group at all —
 * then the whole list is one unnamed section and the panel draws no section chrome. Groups whose subtree
 * holds no listed trait are dropped, so a group full of traits the player can't act on leaves no empty shell.
 * A group in `entityNodeIds` is an entity node, and its section and every block below it carry that
 * entity's id.
 */
export function buildTraitSections(
  traits: Trait[], groups: TraitGroup[], entityNodeIds: ReadonlySet<string> = new Set(),
): TraitSection[] {
  const entity = (id: string, within?: string) => {
    const owner = entityNodeIds.has(id) ? id : within;
    return owner ? { entityId: owner } : {};
  };
  const tree = buildTraitTree(groups, traits);
  const ungrouped = leaves(tree);
  const tops = subgroups(tree).filter(holdsTraits);

  if (tops.length === 0) {
    return ungrouped.length > 0
      ? [{ key: 'flat', name: null, blocks: [{ key: 'flat', subheader: null, group: null, traits: ungrouped }] }]
      : [];
  }

  const sections: TraitSection[] = [];
  if (ungrouped.length > 0) {
    sections.push({
      key: 'general',
      name: 'General',
      blocks: [{ key: 'general', subheader: null, group: null, traits: ungrouped }],
    });
  }
  for (const top of tops) {
    const blocks: TraitBlock[] = [];
    const walk = (node: Extract<TraitTreeNode, { kind: 'group' }>, path: string[], within?: string) => {
      const own = leaves(node.children);
      const bearer = entity(node.id, within);
      if (own.length > 0) {
        blocks.push({
          key: `g:${node.id}`,
          subheader: path.length > 0 ? path.join(' › ') : null,
          group: node.group,
          traits: own,
          ...bearer,
          ...(entityNodeIds.has(node.id) ? { entityNode: true as const } : {}),
        });
      }
      for (const child of subgroups(node.children).filter(holdsTraits)) walk(child, [...path, child.group.name], bearer.entityId);
    };
    walk(top, []);
    sections.push({ key: `g:${top.id}`, name: top.group.name, blocks, ...entity(top.id) });
  }
  return sections;
}

/** One section narrowed to the filter and split enabled-first. */
export interface TraitSectionView {
  /** Blocks holding the section's matching enabled traits, empty blocks dropped. */
  enabled: TraitBlock[];
  /** The same blocks holding the matching switched-off traits — the panel's collapsed "Disabled" half. */
  disabled: TraitBlock[];
  enabledCount: number;
  disabledCount: number;
}

export interface TraitSectionViewOptions {
  query: string;
  /** Whether the trait is off in the block's bearer's tree; the world's when the block names none. */
  isOff: (traitId: string, bearerId?: string) => boolean;
  /** The description as the player reads it; defaults to the raw authored text. */
  describe?: (trait: Trait, bearerId?: string) => string;
}

/**
 * A section as the panel draws it: only the traits matching `query`, enabled ones first and the rest held
 * back for the Disabled block. Null when the filter leaves the section with nothing, which is what hides
 * the whole header.
 */
export function viewTraitSection(
  section: TraitSection,
  { query, isOff, describe = (t) => t.playerDescription ?? '' }: TraitSectionViewOptions,
): TraitSectionView | null {
  const q = query.trim().toLowerCase();
  const matches = (t: Trait, bearerId?: string) =>
    q === '' || t.name.toLowerCase().includes(q) || describe(t, bearerId).toLowerCase().includes(q);

  const split = (keep: (t: Trait, bearerId?: string) => boolean): TraitBlock[] =>
    section.blocks
      .map((b) => ({ ...b, traits: b.traits.filter((t) => matches(t, b.entityId) && keep(t, b.entityId)) }))
      .filter((b) => b.traits.length > 0);

  // A Hidden trait never shows (Q13), and a dormant Always On trait isn't shown at all (Q15).
  const enabled = split((t, bearerId) => !isOff(t.id, bearerId) && !isHidden(t));
  const disabled = split((t, bearerId) => isOff(t.id, bearerId) && !isAlwaysOn(t));
  const count = (blocks: TraitBlock[]) => blocks.reduce((n, b) => n + b.traits.length, 0);
  if (enabled.length === 0 && disabled.length === 0) return null;
  return { enabled, disabled, enabledCount: count(enabled), disabledCount: count(disabled) };
}
