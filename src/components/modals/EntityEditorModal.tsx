import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { toast } from 'react-toastify';
import { ScrollArea } from '@/components/ui/scroll-area';
import EditorModalShell from './EditorModalShell';
import { EntityDescriptionFields, EntityProfileFields } from '@/managers/EntityFields';
import { EntityOpenings } from '@/managers/OpeningsPanel';
import { ENTITY_EDITOR_TABS, type EntityEditorTab } from '@/views/entityPanelTabs';
import { TagsField } from '@/components/TagsField';
import PlaceholderEditor from '@/managers/PlaceholderEditor';
import PlaceholderPaletteBar from '@/components/prompt/PlaceholderPaletteBar';
import { EMPTY_LETTERS, entityPlacementLetters, labelPlaceholders } from '@/lib/placementLetters';
import { PlacementLettersProvider } from '@/contexts/PlacementLettersContext';
import { ChipInsertTargetProvider } from '@/components/prompt/ChipInsertTarget';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { placeholderStore, PlaceholderStoreProvider } from '@/contexts/PlaceholderStoreContext';
import { directChipTargets } from '@/lib/placeholders';
import { carriedPlaceholders, splitCarriedPlaceholders } from '@/lib/placeholderHomes';
import { exportedLibraryLinks } from '@/lib/componentExportLinks';
import { exportEntityCard } from '@/lib/entityFile';
import { downloadBlob } from '@/lib/downloadBlob';
import { canonicalStringify } from '@/lib/canonicalStringify';
import EntityStorageService from '@/services/EntityStorageService';
import { EditorModeContext, type EditorModeValue } from '@/lib/editorMode';
import type { Entity, Placeholder } from '@/types';

/** The baseline in the same canonical form the live value is compared in — a fresh cache each time, since
 *  a baseline is taken once and the graph it describes is about to be edited. */
const canon = (v: unknown) => canonicalStringify(v, new WeakMap()) ?? '';

/** The library editor sits outside the World Editor's mode, even when a world opens it. */
const ALWAYS_ADVANCED: EditorModeValue = { mode: 'advanced', advanced: true, setMode: () => {} };

/**
 * Edit a single library character in place, bound to ISOLATED state (never the world store). Opens on an
 * existing `entityId` (loaded from storage) or a `draft` (a brand-new character not yet stored). Export
 * exports a `.webp` card; Save writes to `EntityStorageService` — a draft isn't persisted until then.
 * `onPublish` (when the user is signed in) hands the character up to the publish dialog. The tabs past
 * Overview are the World Editor entity panel's, over the same field bodies.
 */
const EntityEditorModal = ({ entityId, draft, onClose, onPublish, initialTab = 'profile' }: {
  entityId: string | null;
  draft?: Entity | null;
  onClose: () => void;
  onPublish?: (entity: Entity) => void;
  initialTab?: EntityEditorTab;
}) => {
  const [entity, setEntity] = useState<Entity | null>(null);
  // Opens on Profile rather than Overview: tags are the thing you set once, the entity itself is what you
  // come back to edit.
  const [tab, setTab] = useState<EntityEditorTab>(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const baselineRef = useRef('');
  // Reuses cached serialization for the entity's unchanged base64 image/model on each keystroke; matches
  // the JSON.stringify baseline byte-for-byte.
  const stringifyCache = useRef(new WeakMap<object, string>());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isOpen = entityId !== null || !!draft;

  // Seed from the draft, or load the character from storage; clear when closed.
  useEffect(() => {
    if (draft) { setEntity(draft); baselineRef.current = canon(draft); return; }
    if (entityId === null) { setEntity(null); return; }
    let cancelled = false;
    EntityStorageService.getEntityData(entityId)
      .then((e) => {
        if (cancelled) return;
        setEntity(e);
        baselineRef.current = canon(e);
      })
      .catch(() => { if (!cancelled) { toast.error('Could not load character.'); onCloseRef.current(); } });
    return () => { cancelled = true; };
  }, [entityId, draft]);

  const hasUnsavedChanges = entity != null && canonicalStringify(entity, stringifyCache.current) !== baselineRef.current;

  const handleChange = (field: string, value: unknown) => {
    setEntity((prev) => (prev ? ({ ...prev, [field]: value } as Entity) : prev));
  };

  // Isolated placeholder store backed by the character's own `placeholders` field (empty ⇒ undefined).
  // `placedIds` is the character's own chip-bearing fields, so a drag never takes a placeholder its
  // description still names. It reads the entity through a ref rather than closing over it, so a keystroke
  // in a description does not rebuild the store and, with it, every chip field's vocabulary.
  const entityRef = useRef(entity);
  entityRef.current = entity;
  // The pool is the entity's own placeholders plus the shared ones it carries from the world it was exported
  // from; a write splits the list back the same way, so a carried shared def stays shared on export.
  const pool = useMemo(() => (entity ? carriedPlaceholders(entity) : []), [entity]);
  const phStore = useMemo(() => ({
    ...placeholderStore(pool, (action: SetStateAction<Placeholder[]>) =>
      setEntity((prev) => {
        if (!prev) return prev;
        const cur = carriedPlaceholders(prev);
        return splitCarriedPlaceholders(prev, typeof action === 'function' ? action(cur) : action);
      })),
    placedIds: () => {
      const e = entityRef.current;
      return directChipTargets([
        e?.name, ...(e?.aliases ?? []), e?.playerDescription, e?.aiDescription, e?.aiSummary, e?.imageTags,
      ].filter((t): t is string => !!t));
    },
  }), [pool]);

  // A library character is its own document: its Unique chips letter from a walk of its fields alone.
  const letters = useMemo(() => (entity ? entityPlacementLetters(entity) : EMPTY_LETTERS), [entity]);

  // Returns whether the save succeeded, so a save-and-exit caller only closes on success.
  const handleSave = async (): Promise<boolean> => {
    if (!entity) return true;
    const id = entityId ?? entity.id;
    const normalized: Entity = { ...entity, id };
    try {
      // A save means this copy diverged from whatever it was downloaded from; the store read-merges the rest.
      await EntityStorageService.storeEntity({
        id, name: normalized.name, data: normalized, dirty: true, editedAt: new Date().toISOString(),
      });
      setEntity(normalized);
      baselineRef.current = canon(normalized);
      toast.success('Character saved!');
      return true;
    } catch {
      toast.error('Could not save character.');
      return false;
    }
  };

  const handleExport = async () => {
    if (!entity) return;
    try {
      // A library item is its own source, so the card names it and the worlds that hold a linked copy.
      const blob = await exportEntityCard(entity, undefined, await exportedLibraryLinks('entity', entity.id));
      // A chip in the name would otherwise put a raw placement id in the filename.
      downloadBlob(blob, `${labelPlaceholders(entity.name, pool, { letters }) || 'Character'}.webp`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <EditorModeContext.Provider value={ALWAYS_ADVANCED}>
    <EditorPreviewRollsProvider>
    <PlacementLettersProvider letters={letters}>
      <EditorModalShell
        open={isOpen}
        // A library character has no world behind it, so its own carried defs render the chips — the same
        // treatment its card and its listing get.
        title={labelPlaceholders(entity?.name ?? '', pool, { letters }) || 'Character'}
        contentClassName="max-w-[800px] w-[95vw] h-[85dvh] flex flex-col p-0 gap-0 overflow-hidden"
        loading={!entity}
        tabs={ENTITY_EDITOR_TABS}
        tab={tab}
        onTabChange={(v) => setTab(v as EntityEditorTab)}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={handleSave}
        onClose={onClose}
        onExport={handleExport}
        onPublish={onPublish && entity ? () => onPublish(entity) : undefined}
      >
        {entity && tab === 'overview' ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              <TagsField values={entity.tags} onChange={(tags) => handleChange('tags', tags)} />
            </div>
          </ScrollArea>
        ) : entity && (tab === 'profile' || tab === 'descriptions' || tab === 'openings') ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              <ChipInsertTargetProvider>
                <PlaceholderPaletteBar placeholders={pool} />
                <div className="space-y-4">
                  {tab === 'profile' ? (
                    <EntityProfileFields
                      value={entity}
                      onChange={handleChange}
                      placeholders={pool}
                      home="library"
                      columnsClassName="sm:grid-cols-[18rem_minmax(0,1fr)]"
                    />
                  ) : tab === 'openings' ? (
                    <EntityOpenings
                      entity={entity}
                      placeholders={pool}
                      onChange={(patch) => setEntity((prev) => (prev ? { ...prev, ...patch } : prev))}
                    />
                  ) : (
                    <EntityDescriptionFields value={entity} onChange={handleChange} placeholders={pool} />
                  )}
                </div>
              </ChipInsertTargetProvider>
            </div>
          </ScrollArea>
        ) : (
          <PlaceholderStoreProvider value={phStore}>
            {/* The same palette the field tabs get, over the value fields: a value is a chip field too. */}
            <ChipInsertTargetProvider>
              <div className="flex min-h-0 flex-1 flex-col">
                <PlaceholderPaletteBar placeholders={pool} className="mx-0 mb-0 px-4" />
                <PlaceholderEditor />
              </div>
            </ChipInsertTargetProvider>
          </PlaceholderStoreProvider>
        )}
      </EditorModalShell>
    </PlacementLettersProvider>
    </EditorPreviewRollsProvider>
    </EditorModeContext.Provider>
  );
};

export default EntityEditorModal;
