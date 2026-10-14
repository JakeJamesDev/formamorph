import { useMemo, useState } from 'react';
import { joinedList } from '@/components/editor/joinedList';
import { originalsOf, useTraitStore } from '@/contexts/TraitStoreContext';
import { Link2, Lock, Unlink } from 'lucide-react';
import { BlueprintIcon, EntityIcon, GroupIcon } from '@/lib/elementIcons';
import {
  getOwnedTraitDropProjection, applyOwnedTraitDrop, duplicateTraitNode, entityRootTraitTree, linkRowRemovable,
  getEntityRootDropProjection, applyEntityRootDrop,
  ownedTraitRows, ownedTraitTree, type FlatTraitNode, type LinkRow, type TraitDropRefusal,
} from '@/lib/traitTree';
import { Tip } from '@/components/ui/tooltip';
import { DropRefusalNotice } from '@/components/editor/DropRefusalNotice';
import { removeOwnedItem, withOwnedTraits } from '@/lib/ownedTraits';
import { detachLink, removeLink } from '@/lib/traitLinks';
import { SortableTree, type SortableTreeAdapter, type TreeRowSpec } from './SortableTree';
import { chipInput } from './chipInput';
import { useRemoveWorldTrait } from './useRemoveWorldTrait';
import { TREE_INDENT } from '@/components/EditorRow';
import { useEditorMode } from '@/lib/editorMode';
import { EmptyListHint } from '@/components/EmptyListHint';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { labelPlaceholders } from '@/lib/placementLetters';
import { gateConditions, gateOf, gateStates, type GateState } from '@/lib/traitGates';
import { gateLine } from '@/lib/traitGateLine';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';

// Red on the primary fill is unreadable, so a selected row drops the tint for the row's own color.
const UNRESOLVED = 'text-destructive [[data-editor-row-selected]_&]:text-current';

/** A gated tree row's lock and Condition count, with the full rule as its tip. Red when a Condition points at
 *  nothing. */
const gateMeta = (gate: GateState | undefined, placeholders: Parameters<typeof labelPlaceholders>[1]) => {
  if (!gate?.rows.length) return {};
  const conditions = gateConditions(gate);
  const unresolved = conditions.some((c) => c.unresolved);
  return {
    unresolved,
    meta: (
      <span className={cn('inline-flex items-center gap-1', unresolved && UNRESOLVED)}>
        <Lock className="h-3.5 w-3.5" aria-hidden />{conditions.length}
      </span>
    ),
    // The editor's gate input holds nothing active, so every gated row reads locked: "Requires A and B, or C".
    metaTitle: labelPlaceholders(gateLine(gate, { revealHidden: true }) ?? '', placeholders),
  };
};

/** `A`, `A and B`, `A, B and C`, each name in bold. */
const ownerList = (names: readonly string[], placeholders: Placeholder[]) => {
  const bold = (n: string) => <strong><PlaceholderText text={n} placeholders={placeholders} /></strong>;
  return joinedList(names.map(bold));
};

/** The line after a refused drop: the entity already has the trait, the Custom Persona entity left the top
 *  level, something reads an item joining Blueprints, or a linked Blueprint would leave Blueprints or become
 *  owned. The dragged item stays put. */
export function TraitDropRefusalNotice({ refusal, placeholders, onDismiss }: {
  refusal: TraitDropRefusal;
  placeholders: Placeholder[];
  onDismiss: () => void;
}) {
  const bold = (text: string) => <strong><PlaceholderText text={text} placeholders={placeholders} /></strong>;
  const name = bold(refusal.name);
  return (
    <DropRefusalNotice onDismiss={onDismiss}>
      {refusal.reason === 'duplicate' ? (
        <><PlaceholderText text={refusal.owner} placeholders={placeholders} /> already has {name}.</>
      ) : refusal.reason === 'blueprint-linked' ? (
        <>
          {name} stays in Blueprints, because {ownerList(refusal.owners, placeholders)}{' '}
          {refusal.owners.length === 1 ? 'links' : 'link'} to it or to something in it. Remove those links first.
        </>
      ) : refusal.reason === 'into-blueprints' ? (
        refusal.reader.kind === 'requires' ? (
          <>{name} stays out of Blueprints, because {bold(refusal.reader.trait)} requires it. Remove that requirement first.</>
        ) : (
          <>{name} stays out of Blueprints, because the code of {bold(refusal.reader.stat)} reads it.</>
        )
      ) : (
        <>{name} stays at the top level, because the Custom Persona can&apos;t go in a group.</>
      )}
    </DropRefusalNotice>
  );
}

/**
 * The Traits tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. Each entity
 * that owns a trait or a group has a node holding them, which drags like a group among the world's items.
 * In Basic, an empty system node hides. Over a one entity's root, its links draw among its own items and
 * stay where they are.
 */
const TraitTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const {
    traits, traitGroups, entities, setTraits, setTraitGroups, editEntity, placeholders, gateInput, entityRoot, stats, statGroups,
  } = useTraitStore();
  const originals = useMemo(() => originalsOf({ traits, traitGroups, entityRoot }), [traits, traitGroups, entityRoot]);
  const { advanced } = useEditorMode();
  const gates = useMemo(() => gateStates(gateInput), [gateInput]);
  const lists = useMemo(() => ({ traits, traitGroups }), [traits, traitGroups]);
  const tree = useMemo(
    () => (entityRoot
      ? entityRootTraitTree(entityRoot.owner, entityRoot.world)
      : ownedTraitTree(lists, entities, [], { links: true, emptySystemNodes: advanced })),
    [lists, entities, advanced, entityRoot],
  );
  const [refusal, setRefusal] = useState<TraitDropRefusal | null>(null);
  const { ask: askRemoveOriginal, dialog: removeDialog } = useRemoveWorldTrait();

  const detach = (entityId: string, linkId: string) => {
    const owner = entityRoot?.owner.id === entityId ? entityRoot.owner : entities.find((e) => e.id === entityId);
    const res = owner && detachLink(originals, owner, linkId);
    if (!res) return;
    editEntity(entityId, () => res.entity);
    onSelect(res.newId);
  };

  // The gate a row shows. A link row reads its owner's gate on the original. A one-entity tree's own rows
  // have no owner entry, since the editor edits them as the root; their gates are still the entity's.
  const gateOfRow = (node: FlatTraitNode, linkRow: LinkRow | undefined): GateState | undefined => (
    linkRow
      ? gateOf(gates, linkRow.entityId, linkRow.originalId)
      : gateOf(gates, tree.ownerOf.get(node.id) ?? entityRoot?.owner.id ?? null, node.id)
  );

  const linkRowSpec = (node: FlatTraitNode, linkRow: LinkRow, select: (id: string) => void): TreeRowSpec => {
    const isGroup = node.kind === 'group';
    const name = (isGroup ? node.group?.name : node.leaf?.name) ?? '';
    // No original to read: the stored name, read-only, but removable inside a world.
    if (linkRow.unbound) {
      return {
        lead: 'none',
        icon: (
          <Tip tip={`Linked to ${labelPlaceholders(name, placeholders)} in a world`} labelsChild={false}>
            <span className="shrink-0 px-0.5"><Link2 className="h-4 w-4" aria-label="Link" /></span>
          </Tip>
        ),
        label: <PlaceholderText text={name} placeholders={placeholders} />,
        labelClass: 'text-muted-foreground',
        fixed: true,
        ...(linkRowRemovable(linkRow, entityRoot?.world ?? null) ? {
          removeTitle: 'Remove Link',
          remove: () => editEntity(linkRow.entityId, (e) => removeLink(e, linkRow.link.id)),
        } : {}),
      };
    }
    // A link row reads its owner's gate on the original.
    const { unresolved, meta, metaTitle } = isGroup ? {} : gateMeta(gateOfRow(node, linkRow), placeholders);
    const overrides = linkRow.link.overrides?.[linkRow.originalId];
    const modified = overrides && Object.keys(overrides).length ? 'Modified for this link' : undefined;
    // The glyph's tip names the modification its badge marks.
    const withModified = (tip: string) => (modified ? `${tip}. ${modified}` : tip);
    const shared = {
      lead: isGroup ? 'chevron' : 'none',
      collapseLabels: ['Expand group', 'Collapse group'],
      label: <PlaceholderText text={name} placeholders={placeholders} />,
      labelClass: isGroup ? 'font-medium' : unresolved ? UNRESOLVED : undefined,
      meta,
      metaTitle,
      overridden: modified,
    } satisfies Partial<TreeRowSpec>;
    // A linked group's subtree is the original's, so its rows are read here and edited there.
    if (!linkRow.root) {
      const linkName = labelPlaceholders(linkRow.link.originalName, placeholders);
      const tip = withModified(`Part of the linked ${linkName}, opens ${labelPlaceholders(name, placeholders)}`);
      const glyph = <Link2 className="h-4 w-4 opacity-50" />;
      return {
        ...shared,
        icon: entityRoot ? (
          <Tip tip={withModified(`Part of the linked ${linkName}`)} labelsChild={false}>
            <span className="shrink-0 px-0.5" aria-label="Linked">{glyph}</span>
          </Tip>
        ) : (
          <Tip tip={tip} labelsChild={false}>
            <button
              type="button"
              aria-label={`Open ${labelPlaceholders(name, placeholders)}`}
              onClick={(e) => { e.stopPropagation(); select(linkRow.originalId); }}
              className="shrink-0 px-0.5"
            >
              {glyph}
            </button>
          </Tip>
        ),
        fixed: true,
        removeTitle: 'Remove',
        removeBlocked: `Detach ${linkName} to remove this ${isGroup ? 'group' : 'trait'}`,
      };
    }
    // A root entity's tree holds no original to open, so the icon opens the link's own row.
    const opens = entityRoot ? node.id : linkRow.originalId;
    return {
      ...shared,
      icon: (
        <Tip tip={withModified(`Linked, opens ${labelPlaceholders(name, placeholders)}`)} labelsChild={false}>
          <button
            type="button"
            aria-label={`Open ${labelPlaceholders(name, placeholders)}`}
            onClick={(e) => { e.stopPropagation(); select(opens); }}
            className="shrink-0 px-0.5"
          >
            <Link2 className="h-4 w-4" />
          </button>
        </Tip>
      ),
      actions: [{ icon: <Unlink className="h-4 w-4" />, title: 'Detach', onClick: () => detach(linkRow.entityId, linkRow.link.id) }],
      removeTitle: 'Remove Link',
      remove: () => editEntity(linkRow.entityId, (e) => removeLink(e, linkRow.link.id)),
    };
  };

  const adapter: SortableTreeAdapter<FlatTraitNode> = {
    visibleDeps: [tree],
    rowDeps: [entityRoot],
    rowInputs: (node) => {
      const linkRow = tree.linkRows.get(node.id);
      const entity = tree.entityNodes.get(node.id);
      const gate = gateOfRow(node, linkRow);
      const gateKey = gate?.rows.length
        ? `${gateConditions(gate).some((c) => c.unresolved)}|${gateLine(gate, { revealHidden: true })}`
        : '';
      return [
        linkRow, entity, tree.ownerOf.get(node.id), gateKey,
        chipInput(placeholders, node.group?.name, node.leaf?.name, entity?.name, linkRow?.link.originalName, gateKey),
      ];
    },
    placeholders,
    getVisible: (collapsed) => ownedTraitRows(tree, collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) => (entityRoot
      ? getEntityRootDropProjection(tree, visible, activeId, overId, offsetLeft, TREE_INDENT)
      : getOwnedTraitDropProjection(tree, visible, activeId, overId, offsetLeft, TREE_INDENT))?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      // A one-entity tree reorders the entity's own items among its links, and nothing else moves.
      if (entityRoot) {
        const moved = applyEntityRootDrop(entityRoot.owner, entityRoot.world, collapsed, activeId, overId, offsetLeft, TREE_INDENT);
        if (moved) editEntity(entityRoot.owner.id, () => moved);
        return;
      }
      // Creating a link is Advanced only; existing links still drag in Simple.
      const next = applyOwnedTraitDrop(
        lists, entities, collapsed, activeId, overId, offsetLeft, TREE_INDENT,
        { createLinks: advanced, emptySystemNodes: advanced, codeWorld: { stats, statGroups, placeholders } },
      );
      if (!next) return;
      if (next.kind === 'refused') {
        setRefusal(next.refusal);
        return;
      }
      setRefusal(null);
      if (next.world) {
        setTraitGroups(next.world.groups);
        setTraits(next.world.traits);
      }
      for (const entity of next.entities) editEntity(entity.id, () => entity);
    },
    rowSpec: (node, select) => {
      const linkRow = tree.linkRows.get(node.id);
      if (linkRow) return linkRowSpec(node, linkRow, select);
      const entity = tree.entityNodes.get(node.id);
      if (entity) {
        return {
          lead: 'chevron',
          collapseLabels: ['Expand entity', 'Collapse entity'],
          icon: <EntityIcon className="h-4 w-4 shrink-0" aria-hidden />,
          label: <PlaceholderText text={entity.name} placeholders={placeholders} />,
          labelClass: 'font-medium',
          meta: entity.customPersona ? 'Custom Persona' : entity.persona ? 'Playable' : 'Entity',
        };
      }
      const isGroup = node.kind === 'group';
      const ownerId = tree.ownerOf.get(node.id);
      const { unresolved, meta, metaTitle } = isGroup ? {} : gateMeta(gateOfRow(node, undefined), placeholders);
      if (node.group?.system === 'blueprints') {
        return {
          lead: 'chevron',
          collapseLabels: ['Expand group', 'Collapse group'],
          icon: <BlueprintIcon className="h-4 w-4 shrink-0" aria-hidden />,
          label: <PlaceholderText text={node.group.name} placeholders={placeholders} />,
          labelClass: 'font-medium',
          removeTitle: 'Remove Blueprints',
          remove: () => askRemoveOriginal(node.id, true),
        };
      }
      return {
        // Only groups collapse; traits get no leading slot (matching the original layout).
        lead: isGroup ? 'chevron' : 'none',
        collapseLabels: ['Expand group', 'Collapse group'],
        icon: isGroup ? <GroupIcon className="h-4 w-4 shrink-0" /> : undefined,
        label: <PlaceholderText text={isGroup ? node.group?.name ?? '' : node.leaf?.name ?? ''} placeholders={placeholders} />,
        labelClass: isGroup ? 'font-medium' : unresolved ? UNRESOLVED : undefined,
        meta,
        metaTitle,
        remove: () => {
          if (ownerId) editEntity(ownerId, (e) => removeOwnedItem(e, node.id));
          else askRemoveOriginal(node.id, isGroup);
        },
        duplicate: () => {
          const owner = ownerId && tree.entityNodes.get(ownerId);
          if (owner) {
            const res = duplicateTraitNode(owner.traitGroups ?? [], owner.traits ?? [], node.id);
            editEntity(owner.id, (e) => withOwnedTraits(e, res.traits, res.groups));
            onSelect(res.newId);
            return;
          }
          const res = duplicateTraitNode(traitGroups, traits, node.id);
          setTraitGroups(res.groups);
          setTraits(res.traits);
          onSelect(res.newId);
        },
      };
    },
  };

  if (!tree.traits.length && !tree.groups.length) {
    // Simple mode has no groups, so its + adds the item directly.
    return <EmptyListHint noun="traits" action={advanced ? "add a group or trait" : "add one"} />;
  }

  return (
    <>
      {refusal && <TraitDropRefusalNotice refusal={refusal} placeholders={placeholders} onDismiss={() => setRefusal(null)} />}
      <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} revealSelected />
      {removeDialog}
    </>
  );
};

export default TraitTree;
