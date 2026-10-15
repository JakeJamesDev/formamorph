import { Link2, Unlink } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { BlueprintIcon, GroupIcon } from '@/lib/elementIcons';
import { labelPlaceholders } from '@/lib/placementLetters';
import { isStatOn } from '@/lib/statCodeTargets';
import type { FlatStatNode } from '@/lib/statGroupTree';
import type { LinkedStatRow } from '@/lib/statLinks';
import type { Placeholder } from '@/types';
import type { TreeRowSpec } from './SortableTree';

/** What a stat row's buttons do. Ids are the row's own; a link's row removes by the link's id. */
export interface StatRowActions {
  /** Turns a link into the entity's own stats. */
  onDetach?: (linkId: string) => void;
  onRemoveStat: (id: string) => void;
  onRemoveGroup: (id: string) => void;
  onDuplicate: (id: string) => void;
}

/** One stat tree row: a stat, a group, the Blueprints group, or a row a link brings (`linked`).
 *  A disabled stat's row is dimmed and reads "Off", as its rows on the Scripts tab do. */
export function statRowSpec(
  node: FlatStatNode, select: (id: string) => void, linked: LinkedStatRow | undefined, placeholders: Placeholder[],
  actions: StatRowActions,
): TreeRowSpec {
  const spec = baseStatRowSpec(node, select, linked, placeholders, actions);
  if (node.kind === 'group' || !node.leaf || isStatOn(node.leaf)) return spec;
  return { ...spec, faded: true, meta: 'Off' };
}

function baseStatRowSpec(
  node: FlatStatNode, select: (id: string) => void, linked: LinkedStatRow | undefined, placeholders: Placeholder[],
  { onDetach, onRemoveStat, onRemoveGroup, onDuplicate }: StatRowActions,
): TreeRowSpec {
  const isGroup = node.kind === 'group';
  if (node.group?.system === 'blueprints') {
    return {
      lead: 'chevron',
      collapseLabels: ['Expand group', 'Collapse group'],
      icon: <BlueprintIcon className="h-4 w-4 shrink-0" aria-hidden />,
      label: <PlaceholderText text={node.group.name} placeholders={placeholders} />,
      labelClass: 'font-medium',
      removeTitle: 'Remove Blueprints',
      remove: () => onRemoveGroup(node.id),
    };
  }
  if (linked) {
    const row = linked;
    // A group link's row marks any override on the stats it brings.
    const overrides = row.kind === 'group' ? row.link.overrides : row.link.overrides?.[row.originalId];
    const name = (isGroup ? node.group?.name : node.leaf?.name) ?? '';
    const shared = {
      lead: isGroup ? 'chevron' : 'none',
      collapseLabels: ['Expand group', 'Collapse group'],
      label: <PlaceholderText text={name} placeholders={placeholders} />,
      labelClass: isGroup ? 'font-medium' : row.unbound ? 'text-muted-foreground' : undefined,
      overridden: overrides && Object.keys(overrides).length ? 'Modified for this link' : undefined,
    } satisfies Partial<TreeRowSpec>;
    // A linked group's subtree is the original's, so its rows are read here and edited there.
    if (!row.root) {
      const linkName = labelPlaceholders(row.link.originalName, placeholders);
      return {
        ...shared,
        icon: (
          <Tip tip={`Part of the linked ${linkName}`} labelsChild={false}>
            <span className="shrink-0 px-0.5" aria-label="Linked"><Link2 className="h-4 w-4 opacity-50" /></span>
          </Tip>
        ),
        fixed: true,
        removeTitle: 'Remove',
        removeBlocked: `Detach ${linkName} to remove this ${isGroup ? 'group' : 'stat'}`,
      };
    }
    const label = labelPlaceholders(name, placeholders);
    return {
      ...shared,
      icon: (
        <Tip tip={`Linked, opens ${label}`} labelsChild={false}>
          <button
            type="button"
            aria-label={`Open ${label}`}
            onClick={(e) => { e.stopPropagation(); select(node.id); }}
            className="shrink-0 px-0.5"
          >
            <Link2 className="h-4 w-4" />
          </button>
        </Tip>
      ),
      actions: onDetach && !row.unbound
        ? [{ icon: <Unlink className="h-4 w-4" />, title: 'Detach', onClick: () => onDetach(row.link.id) }] : undefined,
      removeTitle: 'Remove Link',
      remove: () => onRemoveStat(row.link.id),
    };
  }
  return {
    // Only groups collapse; stats get no leading slot (matching the flat list layout).
    lead: isGroup ? 'chevron' : 'none',
    collapseLabels: ['Expand group', 'Collapse group'],
    icon: isGroup ? <GroupIcon className="h-4 w-4 shrink-0" /> : undefined,
    label: <PlaceholderText text={isGroup ? node.group?.name ?? '' : node.leaf?.name ?? ''} placeholders={placeholders} />,
    labelClass: isGroup ? 'font-medium' : undefined,
    remove: () => (isGroup ? onRemoveGroup(node.id) : onRemoveStat(node.id)),
    duplicate: () => onDuplicate(node.id),
  };
}
