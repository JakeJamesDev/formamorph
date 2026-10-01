import { useMemo, type ReactNode } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { Copy, Link2, X } from 'lucide-react';
import type { ListEditorAdapter, ListEditorRow } from '@/components/listEditorHooks';
import { useGameData } from '@/contexts/GameDataContext';
import { newTrait, traitRootCount } from '@/lib/blankWorld';
import { bearsTraits, originalOf } from '@/lib/bearers';
import { useEditorMode } from '@/lib/editorMode';
import { addOwnedGroup, addOwnedTrait, findOwnedItem, removeOwnedItem, withOwnedTraits } from '@/lib/ownedTraits';
import { OWNER_NAME_SEPARATOR } from '@/lib/placementLetters';
import type { FindingSection } from '@/lib/testBench/rules';
import { removeLink } from '@/lib/traitLinks';
import { blueprintsGroup, duplicateTraitNode, isBlueprintItem, ownedTraitTree } from '@/lib/traitTree';
import { randomUUID } from '@/lib/uuid';
import type { FocusFieldHint } from '@/types';
import type { EntityPanelTab } from '@/views/entityPanelTabs';
import { focusFieldForItem } from '@/views/findFocus';
import type { TraitPanelTab } from '@/views/traitPanelTabs';
import { LinkToBearerButton } from './BearerPicker';
import { EntityTraitNodePanel } from './EntityTraitNodePanel';
import GroupManager from './GroupManager';
import { LinkedFromLine, LinkedTraitManager, LinkFooter, ThisLinkSection } from './TraitLinkPanel';
import TraitManager from './TraitManager';
import { TraitsAddMenu, type OwnedKind } from './TraitsAddMenu';
import TraitTree from './TraitTree';
import { useRemoveWorldTrait } from './useRemoveWorldTrait';

/**
 * The World Editor's Traits tab as a List Editor adapter: the world's one tree, a flat search over world traits,
 * owned traits and Links, and the trait, group, entity node or Link panel for a selection. `dialog` is the
 * remove confirmation the search rows open; the host renders it.
 */
export function useWorldTraitsAdapter({ selectedId, onSelect, navigate, tab, onTabChange, focusField }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Lands on an item the way a Bench finding does; `entityTab` names the entity panel's tab to open. */
  navigate: (section: FindingSection, id: string, entityTab?: EntityPanelTab) => void;
  tab: TraitPanelTab;
  onTabChange: (tab: TraitPanelTab) => void;
  focusField: FocusFieldHint | null;
}): { adapter: ListEditorAdapter; dialog: ReactNode } {
  const {
    traits, traitGroups, entities, entityGroups, placeholders, placementLetters, placeholderOwners,
    addTrait, addTraitGroup, setTraits, setTraitGroups, editEntity,
  } = useGameData();
  const { advanced } = useEditorMode();
  const { ask: askRemoveWorldTrait, dialog } = useRemoveWorldTrait();

  const tree = useMemo(
    () => ownedTraitTree({ traits, traitGroups }, entities, [], { links: true, emptySystemNodes: advanced }),
    [traits, traitGroups, entities, advanced],
  );

  // A trait or group may be the world's or an entity's own; an entity node or a Link row reads through.
  const owned = selectedId ? findOwnedItem(entities, selectedId) : null;
  const trait = traits.find((t) => t.id === selectedId) ?? owned?.trait;
  const group = traitGroups.find((g) => g.id === selectedId) ?? owned?.group;
  const nodeEntity = entities.find((e) => e.id === selectedId);
  const traitNode = nodeEntity && bearsTraits(nodeEntity) ? nodeEntity : undefined;
  // A link's row, or a row of its linked group's subtree, edits the original it reads.
  const linkRow = selectedId ? tree.linkRows.get(selectedId) : undefined;
  const linkBearer = linkRow && entities.find((e) => e.id === linkRow.entityId);
  const linkedTrait = linkRow && traits.find((t) => t.id === linkRow.originalId);
  const linkedGroup = linkRow && traitGroups.find((g) => g.id === linkRow.originalId);
  // The trait or group shown, or the original a link row reads. `originalOf` drops owned ones.
  const shownOriginalId = linkRow ? (linkBearer ? linkRow.originalId : undefined) : (group ?? trait)?.id;

  const handleAddTrait = (typed: string) => {
    const id = randomUUID();
    addTrait(newTrait(id, traitRootCount({ traits, traitGroups }), typed || undefined));
    onSelect(id);
  };
  const handleAddGroup = (typed: string) => {
    const id = randomUUID();
    addTraitGroup({
      id, name: typed || 'New Group', playerDescription: '', aiDescription: '', parentId: null,
      order: traitRootCount({ traits, traitGroups }),
    });
    onSelect(id);
  };
  // The world holds at most one Blueprints group, so its add hides once it exists.
  const handleAddBlueprints = () => {
    const id = randomUUID();
    addTraitGroup({
      id, name: 'Blueprints', playerDescription: '', aiDescription: '', parentId: null,
      order: traitRootCount({ traits, traitGroups }), system: 'blueprints',
    });
    onSelect(id);
  };
  // The first add to an entity gives it a node in the tree, which reveals the selected row.
  const handleAddToEntity = (kind: OwnedKind, entityId: string, typed: string) => {
    const id = randomUUID();
    const name = typed || undefined;
    editEntity(entityId, (e) => (kind === 'trait' ? addOwnedTrait(e, id, name) : addOwnedGroup(e, id, name)));
    onSelect(id);
  };

  const duplicateWorldTrait = (id: string) => {
    const res = duplicateTraitNode(traitGroups, traits, id);
    setTraitGroups(res.groups);
    setTraits(res.traits);
    onSelect(res.newId);
  };
  const duplicateOwnedTrait = (ownerId: string, id: string) => {
    const owner = entities.find((e) => e.id === ownerId);
    if (!owner) return;
    const res = duplicateTraitNode(owner.traitGroups ?? [], owner.traits ?? [], id);
    editEntity(owner.id, (e) => withOwnedTraits(e, res.traits, res.groups));
    onSelect(res.newId);
  };

  // World traits read bare; an entity's traits and Links read `Owner › Name`, so two owners' rows differ.
  const rows = (): ListEditorRow[] => {
    const under = (ownerName: string, name: string) => `${ownerName}${OWNER_NAME_SEPARATOR}${name}`;
    const linkRows = [...tree.linkRows.values()].filter((row) => row.root);
    return [
      ...traits.map((t): ListEditorRow => ({
        id: t.id,
        name: t.name,
        sortable: true,
        actions: [
          { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => duplicateWorldTrait(t.id) },
          { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => { askRemoveWorldTrait(t.id, false); onSelect(null); } },
        ],
      })),
      ...entities.flatMap((entity) => [
        ...(entity.traits ?? []).map((t): ListEditorRow => ({
          id: t.id,
          name: under(entity.name, t.name),
          actions: [
            { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => duplicateOwnedTrait(entity.id, t.id) },
            { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => editEntity(entity.id, (e) => removeOwnedItem(e, t.id)) },
          ],
        })),
        ...linkRows.filter((row) => row.entityId === entity.id).map((row): ListEditorRow => ({
          id: row.link.id,
          name: under(entity.name, originalOf({ traits, traitGroups }, row.originalId)?.item.name ?? row.link.originalName),
          icon: <Link2 className="h-4 w-4 shrink-0" aria-label="Link" />,
          actions: [{
            icon: <X className="h-4 w-4" />, title: 'Remove Link',
            onClick: () => editEntity(entity.id, (e) => removeLink(e, row.link.id)),
          }],
        })),
      ]),
    ];
  };

  // Moves a world trait by its place in the world's array, not its place in the tree (drift log #3).
  const onReorder = (activeId: string, overId: string) => {
    const oldIndex = traits.findIndex((t) => t.id === activeId);
    const newIndex = traits.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    setTraits(arrayMove(traits, oldIndex, newIndex));
  };

  const detail = (id: string | null) => id && (
    <>
      {group && <GroupManager key={group.id} group={group} ownerId={owned?.entity.id} />}
      {traitNode && (
        <EntityTraitNodePanel
          key={traitNode.id}
          entity={traitNode}
          onOpenEntity={() => navigate('entities', traitNode.id, 'traits')}
        />
      )}
      {!group && trait && (
        <TraitManager
          surfaceTabs="worldEditorTrait"
          key={trait.id}
          trait={trait}
          owner={owned?.entity}
          // A conflict note names a rival trait; clicking the name lands on it like a Bench finding does.
          onOpenTrait={(traitId) => navigate('traits', traitId)}
          onOpenEntity={(entityId) => navigate('entities', entityId)}
          tab={tab}
          onTabChange={onTabChange}
          focusField={focusFieldForItem(focusField, trait.id)}
        />
      )}
      {linkRow && linkBearer && linkedTrait && (
        <LinkedTraitManager
          key={id}
          bearer={linkBearer}
          link={linkRow.link}
          original={linkedTrait}
          onOpenTrait={(traitId) => navigate('traits', traitId)}
          onOpenEntity={(entityId) => navigate('entities', entityId)}
          tab={tab}
          onTabChange={onTabChange}
          focusField={focusFieldForItem(focusField, linkedTrait.id)}
        />
      )}
      {linkRow && linkBearer && linkedGroup && (
        <GroupManager
          key={id}
          group={linkedGroup}
          readOnly
          detailsHeader={<LinkedFromLine originalId={linkedGroup.id} />}
          detailsFooter={<ThisLinkSection entity={linkBearer} link={linkRow.link} originalId={linkedGroup.id} />}
        />
      )}
    </>
  );

  // In Advanced, the link button sits in the frozen footer, below every panel tab. A link row's footer always
  // shows, with Reset to Blueprint and Edit Blueprint.
  const footer = () => {
    const linkTo = advanced && shownOriginalId && isBlueprintItem({ traits, traitGroups }, shownOriginalId)
      ? <LinkToBearerButton originalId={shownOriginalId} /> : null;
    if (linkRow && linkBearer && shownOriginalId) {
      return <LinkFooter bearer={linkBearer} row={linkRow} onEditBlueprint={() => onSelect(shownOriginalId)}>{linkTo}</LinkFooter>;
    }
    return linkTo && <div className="p-3 border-t flex justify-end">{linkTo}</div>;
  };

  const adapter: ListEditorAdapter = {
    tree: <TraitTree selectedId={selectedId} onSelect={onSelect} />,
    rows,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    noun: 'traits',
    detail,
    footer,
    // Tabbed panels keep their strip above a body that scrolls itself.
    fills: () => (!group && !!trait) || (!!linkRow && !!linkBearer && !!linkedTrait),
    onReorder,
    add: advanced ? {
      label: 'Add to Traits',
      menuClassName: 'w-56',
      menu: (
        <TraitsAddMenu
          advanced={advanced}
          entities={entities}
          entityGroups={entityGroups}
          hasBlueprints={!!blueprintsGroup(traitGroups)}
          onAddGroup={handleAddGroup}
          onAddTrait={handleAddTrait}
          onAddToEntity={handleAddToEntity}
          onAddBlueprints={handleAddBlueprints}
        />
      ),
    } : { label: 'Add to Traits', onAdd: handleAddTrait },
    placeholder: 'Search or add new traits',
    holds: (id) => traits.some((t) => t.id === id) || traitGroups.some((g) => g.id === id) || !!findOwnedItem(entities, id)
      || tree.entityNodes.has(id) || tree.linkRows.has(id),
    // The tree draws its own empty hint.
    isEmpty: false,
    emptyHint: null,
  };
  return { adapter, dialog };
}
