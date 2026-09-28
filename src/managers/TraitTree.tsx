import { useMemo, useState } from 'react';
import { originalsOf, useTraitStore } from '@/contexts/TraitStoreContext';
import { CircleUserRound, Folder, Info, LayoutTemplate, Link2, Lock, Unlink, User } from 'lucide-react';
import {
  CUSTOM_PERSONA_ID, CUSTOM_PERSONA_NAME, getOwnedTraitDropProjection, applyOwnedTraitDrop, duplicateTraitNode, entityRootTraitTree, linkRowRemovable,
  ownedTraitRows, ownedTraitTree, type FlatTraitNode, type LinkRow, type TraitDropRefusal,
} from '@/lib/traitTree';
import { useEditBearer } from './useEditBearer';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { removeOwnedItem, withOwnedTraits } from '@/lib/ownedTraits';
import { detachDropsStats, detachLink, removeLink } from '@/lib/traitLinks';
import { SortableTree, type SortableTreeAdapter, type TreeRowSpec } from './SortableTree';
import { alsoDeletesLinks, useRemoveWorldTrait } from './useRemoveWorldTrait';
import { TREE_INDENT } from '@/components/EditorRow';
import { useEditorMode } from '@/lib/editorMode';
import { EmptyListHint } from '@/components/EmptyListHint';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { labelPlaceholders } from '@/lib/placementLetters';
import { PLAYER_BEARER } from '@/lib/bearers';
import { gateOf, gateStates, type GateState } from '@/lib/traitGates';
import { gateLine } from '@/lib/traitGateLine';
import { cn } from '@/lib/utils';
import type { Placeholder } from '@/types';

// Red on the primary fill is unreadable, so a selected row drops the tint for the row's own color.
const UNRESOLVED = 'text-destructive [[data-editor-row-selected]_&]:text-current';

/** A gated row's lock and count, with the full rule as its tip. Red when a requirement points at nothing. */
const gateMeta = (gate: GateState | undefined, placeholders: Parameters<typeof labelPlaceholders>[1]) => {
  if (!gate?.requirements.length) return {};
  const unresolved = gate.requirements.some((r) => r.unresolved);
  return {
    unresolved,
    meta: (
      <span className={cn('inline-flex items-center gap-1', unresolved && UNRESOLVED)}>
        <Lock className="h-3.5 w-3.5" aria-hidden />{gate.requirements.length}
      </span>
    ),
    // The editor's gate input holds nothing active, so every gated row reads locked: "Requires A or B".
    metaTitle: labelPlaceholders(gateLine(gate) ?? '', placeholders),
  };
};

/** The line after a refused drop: an entity's trait would gain stat effects, or the entity already has the
 *  trait. The dragged item stays put. */
export function TraitDropRefusalNotice({ refusal, placeholders, onDismiss }: {
  refusal: TraitDropRefusal;
  placeholders: Placeholder[];
  onDismiss: () => void;
}) {
  const name = <strong><PlaceholderText text={refusal.name} placeholders={placeholders} /></strong>;
  return (
    <div role="status" className="mb-2 flex items-start gap-2 rounded-lg border p-3 text-helper">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      {refusal.reason === 'duplicate' ? (
        <span className="flex-1">
          <PlaceholderText text={refusal.bearer} placeholders={placeholders} /> already has {name}.
        </span>
      ) : refusal.reason === 'offered' ? (
        <span className="flex-1">The player already has {name} at the top level.</span>
      ) : (
        <span className="flex-1">
          {name} stays {refusal.owner
            ? <><PlaceholderText text={refusal.owner} placeholders={placeholders} />&apos;s</>
            : 'a world'} {refusal.kind}, because an entity&apos;s traits can&apos;t change stats.{' '}
          {refusal.kind === 'trait'
            ? 'Remove its stat changes and stat toggles first.'
            : <>Remove the stat changes and stat toggles from <strong><PlaceholderText text={refusal.offender} placeholders={placeholders} /></strong> first.</>}
        </span>
      )}
      <Button type="button" variant="ghost" size="sm" className="-my-1 h-7" onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}

/**
 * The Traits tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. Each entity
 * that owns a trait or a group has a node holding them, which drags like a group among the world's items.
 * Custom Persona draws as one more node, holding links only. In Basic, an empty system node hides. Over a
 * one entity's root, its links draw among its own items and stay where they are.
 */
const TraitTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const {
    traits, traitGroups, entities, setTraits, setTraitGroups, editEntity, placeholders, gateInput,
    customPersona, setCustomPersona, entityRoot,
  } = useTraitStore();
  const originals = useMemo(() => originalsOf({ traits, traitGroups, entityRoot }), [traits, traitGroups, entityRoot]);
  const { advanced } = useEditorMode();
  const gates = useMemo(() => gateStates(gateInput), [gateInput]);
  const lists = useMemo(() => ({ traits, traitGroups, customPersona }), [traits, traitGroups, customPersona]);
  const tree = useMemo(
    () => (entityRoot
      ? entityRootTraitTree(entityRoot.bearer, entityRoot.world)
      : ownedTraitTree(lists, entities, [], { links: true, emptySystemNodes: advanced })),
    [lists, entities, advanced, entityRoot],
  );
  const [refusal, setRefusal] = useState<TraitDropRefusal | null>(null);
  const { ask: askRemoveOriginal, dialog: removeDialog } = useRemoveWorldTrait();
  const [pendingDetach, setPendingDetach] = useState<{ entityId: string; linkId: string; name: string } | null>(null);
  const [pendingPersonaLinks, setPendingPersonaLinks] = useState<number | null>(null);

  const editBearer = useEditBearer();
  const removeCustomPersona = () => {
    const links = customPersona?.traitLinks.length ?? 0;
    if (links) setPendingPersonaLinks(links);
    else setCustomPersona?.(undefined);
  };

  const detach = (entityId: string, linkId: string) => {
    const bearer = entityRoot?.bearer.id === entityId ? entityRoot.bearer : entities.find((e) => e.id === entityId);
    const res = bearer && detachLink(originals, bearer, linkId);
    if (!res) return;
    editEntity(entityId, () => res.entity);
    onSelect(res.newId);
  };
  // An owned copy can't carry stat effects, so a Detach that drops them asks first.
  const askDetach = ({ entityId, link }: LinkRow, name: string) => {
    if (detachDropsStats(originals, link)) setPendingDetach({ entityId, linkId: link.id, name });
    else detach(entityId, link.id);
  };

  const linkRowSpec = (node: FlatTraitNode, linkRow: LinkRow): TreeRowSpec => {
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
          remove: () => editBearer(linkRow.entityId, (e) => removeLink(e, linkRow.link.id)),
        } : {}),
      };
    }
    // A link row reads its bearer's gate on the original; Custom Persona's rows are the player's.
    const bearerId = linkRow.entityId === CUSTOM_PERSONA_ID ? PLAYER_BEARER : linkRow.entityId;
    const { unresolved, meta, metaTitle } = isGroup ? {} : gateMeta(gateOf(gates, bearerId, linkRow.originalId), placeholders);
    const shared = {
      lead: isGroup ? 'chevron' : 'none',
      collapseLabels: ['Expand group', 'Collapse group'],
      label: <PlaceholderText text={name} placeholders={placeholders} />,
      labelClass: isGroup ? 'font-medium' : unresolved ? UNRESOLVED : undefined,
      meta,
      metaTitle,
    } satisfies Partial<TreeRowSpec>;
    // A linked group's subtree is the original's, so its rows are read here and edited there.
    if (!linkRow.root) return { ...shared, icon: isGroup ? <Folder className="h-4 w-4 shrink-0" /> : undefined, fixed: true };
    // A root entity's tree holds no original to open, and its drops don't place links.
    const opens = entityRoot ? node.id : linkRow.originalId;
    return {
      ...shared,
      fixed: !!entityRoot,
      icon: (
        <Tip tip={`Linked, opens ${labelPlaceholders(name, placeholders)}`} labelsChild={false}>
          <button
            type="button"
            aria-label={`Open ${labelPlaceholders(name, placeholders)}`}
            onClick={(e) => { e.stopPropagation(); onSelect(opens); }}
            className="shrink-0 px-0.5"
          >
            <Link2 className="h-4 w-4" />
          </button>
        </Tip>
      ),
      // Custom Persona holds links only, so its links have no owned copy to detach into.
      actions: linkRow.entityId === CUSTOM_PERSONA_ID
        ? undefined
        : [{ icon: <Unlink className="h-4 w-4" />, title: 'Detach', onClick: () => askDetach(linkRow, name) }],
      removeTitle: 'Remove Link',
      remove: () => editBearer(linkRow.entityId, (e) => removeLink(e, linkRow.link.id)),
    };
  };

  const adapter: SortableTreeAdapter<FlatTraitNode> = {
    getVisible: (collapsed) => ownedTraitRows(tree, collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getOwnedTraitDropProjection(tree, visible, activeId, overId, offsetLeft, TREE_INDENT, { createLinks: advanced })?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      // Creating a link is Advanced only; existing links still drag in Simple.
      const next = applyOwnedTraitDrop(
        lists, entities, collapsed, activeId, overId, offsetLeft, TREE_INDENT, { createLinks: advanced, emptySystemNodes: advanced },
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
      if (next.customPersona) setCustomPersona?.(next.customPersona);
    },
    rowSpec: (node) => {
      const linkRow = tree.linkRows.get(node.id);
      if (linkRow) return linkRowSpec(node, linkRow);
      if (node.id === CUSTOM_PERSONA_ID) {
        return {
          lead: 'chevron',
          collapseLabels: ['Expand Custom Persona', 'Collapse Custom Persona'],
          icon: <CircleUserRound className="h-4 w-4 shrink-0" aria-hidden />,
          label: CUSTOM_PERSONA_NAME,
          labelClass: 'font-medium',
          meta: 'Player',
          removeTitle: 'Remove Custom Persona',
          remove: removeCustomPersona,
        };
      }
      const entity = tree.entityNodes.get(node.id);
      if (entity) {
        return {
          lead: 'chevron',
          collapseLabels: ['Expand entity', 'Collapse entity'],
          icon: <User className="h-4 w-4 shrink-0" aria-hidden />,
          label: <PlaceholderText text={entity.name} placeholders={placeholders} />,
          labelClass: 'font-medium',
          meta: entity.persona ? 'Playable' : 'Entity',
        };
      }
      const isGroup = node.kind === 'group';
      const ownerId = tree.ownerOf.get(node.id);
      const { unresolved, meta, metaTitle } = isGroup ? {} : gateMeta(gateOf(gates, ownerId ?? PLAYER_BEARER, node.id), placeholders);
      if (node.group?.system === 'templates') {
        return {
          lead: 'chevron',
          collapseLabels: ['Expand group', 'Collapse group'],
          icon: <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />,
          label: <PlaceholderText text={node.group.name} placeholders={placeholders} />,
          labelClass: 'font-medium',
          meta: 'Not offered',
          removeTitle: 'Remove Templates',
          remove: () => askRemoveOriginal(node.id, true),
        };
      }
      return {
        // Only groups collapse; traits get no leading slot (matching the original layout).
        lead: isGroup ? 'chevron' : 'none',
        collapseLabels: ['Expand group', 'Collapse group'],
        icon: isGroup ? <Folder className="h-4 w-4 shrink-0" /> : undefined,
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
      <ConfirmDialog
        open={!!pendingDetach}
        onOpenChange={(open) => { if (!open) setPendingDetach(null); }}
        title={`Detach ${labelPlaceholders(pendingDetach?.name ?? '', placeholders)}?`}
        description="The copy won't keep its stat changes and stat toggles, because an entity's traits can't change stats."
        onConfirm={() => {
          if (pendingDetach) detach(pendingDetach.entityId, pendingDetach.linkId);
          setPendingDetach(null);
        }}
      />
      <ConfirmDialog
        open={pendingPersonaLinks !== null}
        onOpenChange={(open) => { if (!open) setPendingPersonaLinks(null); }}
        title="Remove Custom Persona?"
        description={alsoDeletesLinks(pendingPersonaLinks ?? 0)}
        onConfirm={() => {
          setCustomPersona?.(undefined);
          setPendingPersonaLinks(null);
        }}
      />
    </>
  );
};

export default TraitTree;
