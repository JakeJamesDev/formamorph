import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { toast } from 'react-toastify';
import { toastError } from '@/lib/linkToast';
import { ScrollArea } from '@/components/ui/scroll-area';
import EditorModalShell from './EditorModalShell';
import { FieldColumn } from './FieldColumn';
import { DETAIL_PALETTE_CLASS, LIBRARY_EDITOR_CONTENT_CLASS } from './libraryEditorLayout';
import { EntityDescriptionFields, EntityProfileFields } from '@/managers/EntityFields';
import { EntityOpenings } from '@/managers/OpeningsPanel';
import {
  ENTITY_EDITOR_SUBTABS, ENTITY_EDITOR_TABS, entityEditorTabForField, type EntityEditorSubTab, type EntityEditorTab,
} from '@/views/entityPanelTabs';
import { PanelTabContent, PanelTabs } from '@/components/ui/panel-tabs';
import { useIsMobile } from '@/lib/useIsMobile';
import { TagsField } from '@/components/TagsField';
import { LibraryAuthorField } from '@/components/LibraryAuthorField';
import LibraryPlaceholdersEditor from '@/managers/LibraryPlaceholdersEditor';
import LibraryTraitsEditor, { type LibraryEditorWorld } from '@/managers/LibraryTraitsEditor';
import PlaceholderPaletteBar from '@/components/prompt/PlaceholderPaletteBar';
import { EMPTY_LETTERS, entityPlacementLetters, labelPlaceholders } from '@/lib/placementLetters';
import { PlacementLettersProvider } from '@/contexts/PlacementLettersContext';
import { ChipInsertTargetProvider } from '@/components/prompt/ChipInsertTarget';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { placeholderStore, PlaceholderStoreProvider } from '@/contexts/PlaceholderStoreContext';
import { NoWorld } from '@/contexts/GameDataContext';
import { directChipTargets } from '@/lib/placeholders';
import { carriedPlaceholders, splitCarriedPlaceholders } from '@/lib/placeholderHomes';
import { exportedLibraryLinks } from '@/lib/componentExportLinks';
import { exportEntityCard } from '@/lib/entityFile';
import { downloadBlob } from '@/lib/downloadBlob';
import { canonicalStringify } from '@/lib/canonicalStringify';
import EntityStorageService from '@/services/EntityStorageService';
import { EditorModeContext, type EditorModeValue } from '@/lib/editorMode';
import type { Entity, LibraryDetails, FocusFieldHint, Placeholder } from '@/types';

/** The baseline in the same canonical form the live value is compared in — a fresh cache each time, since
 *  a baseline is taken once and the graph it describes is about to be edited. */
const canon = (v: unknown) => canonicalStringify(v, new WeakMap()) ?? '';

const NO_BLUEPRINTS: readonly Placeholder[] = [];

/** The library editor sits outside the World Editor's mode, even when a world opens it. */
const ALWAYS_ADVANCED: EditorModeValue = { mode: 'advanced', advanced: true, setMode: () => {} };

/**
 * Edit a single library character in place, bound to ISOLATED state (never the world store). Opens on an
 * existing `entityId` (loaded from storage) or a `draft` (a brand-new character not yet stored). Export
 * exports a `.webp` card; Save writes to `EntityStorageService` — a draft isn't persisted until then.
 * `onPublish` (when the user is signed in) hands the character up to the publish dialog. The Entity tab's
 * sub-tabs are the World Editor entity panel's, over the same field bodies. `focusField` opens the tab and
 * sub-tab that hold a field. `traitWorld` is the world the editor was opened from, which the links read.
 */
const EntityEditorModal = ({
  entityId, draft, onClose, onPublish, initialTab = 'entity', initialSubTab = 'profile', focusField, traitWorld,
}: {
  entityId: string | null;
  draft?: Entity | null;
  onClose: () => void;
  onPublish?: (entity: Entity, libraryDetails?: LibraryDetails) => void;
  initialTab?: EntityEditorTab;
  initialSubTab?: EntityEditorSubTab;
  focusField?: FocusFieldHint | null;
  traitWorld?: LibraryEditorWorld;
}) => {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [libraryDetails, setLibraryDetails] = useState<LibraryDetails | undefined>();
  const [tab, setTab] = useState<EntityEditorTab>(initialTab);
  const [subTab, setSubTab] = useState<EntityEditorSubTab>(initialSubTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { setSubTab(initialSubTab); }, [initialSubTab]);
  // A key no tab claims leaves the editor where the author put it.
  useEffect(() => {
    const owning = focusField ? entityEditorTabForField(focusField.fieldKey) : null;
    if (owning) { setTab(owning.tab); setSubTab(owning.subTab); }
  }, [focusField]);
  // Below `sm` the Tags column folds into the top of Profile.
  const narrow = useIsMobile(640);
  const baselineRef = useRef('');
  const detailsBaselineRef = useRef('');
  // Reuses cached serialization for the entity's unchanged base64 image/model on each keystroke; matches
  // the JSON.stringify baseline byte-for-byte.
  const stringifyCache = useRef(new WeakMap<object, string>());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isOpen = entityId !== null || !!draft;

  // Seed from the draft, or load the character from storage; clear when closed.
  useEffect(() => {
    setLibraryDetails(undefined);
    detailsBaselineRef.current = canon(undefined);
    if (draft) { setEntity(draft); baselineRef.current = canon(draft); return; }
    if (entityId === null) { setEntity(null); return; }
    let cancelled = false;
    Promise.all([EntityStorageService.getEntityData(entityId), EntityStorageService.getEntityMetadata()])
      .then(([e, records]) => {
        if (cancelled) return;
        const details = records.find((record) => record.id === entityId)?.libraryDetails;
        setLibraryDetails(details);
        detailsBaselineRef.current = canon(details);
        setEntity(e);
        baselineRef.current = canon(e);
      })
      .catch((error: unknown) => {
        if (!cancelled) { toastError(error, { headline: 'Could not load character.' }); onCloseRef.current(); }
      });
    return () => { cancelled = true; };
  }, [entityId, draft]);

  const hasUnsavedChanges = entity != null && (canonicalStringify(entity, stringifyCache.current) !== baselineRef.current
    || canon(libraryDetails) !== detailsBaselineRef.current);

  const handleChange = (field: string, value: unknown) => {
    setEntity((prev) => (prev ? ({ ...prev, [field]: value } as Entity) : prev));
  };

  const handleTags = (tags: string[]) => {
    if (libraryDetails?.tags !== undefined) setLibraryDetails({ ...libraryDetails, tags });
    else handleChange('tags', tags);
  };

  // Isolated placeholder store backed by the character's own `placeholders` field (empty ⇒ undefined).
  // `placedIds` is the character's own chip-bearing fields, so a drag never takes a placeholder its
  // description still names. It reads the entity through a ref rather than closing over it, so a keystroke
  // in a description does not rebuild the store and, with it, every chip field's vocabulary.
  const entityRef = useRef(entity);
  entityRef.current = entity;
  // The pool is the entity's own placeholders plus the shared ones it carries from the world it was exported
  // from; a write splits the list back the same way, so a carried shared def stays shared on export.
  const pool = carriedPlaceholders(entity ?? {});
  const ownId = entity?.id;
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
    ...(ownId && { owner: { kind: 'entity' as const, id: ownId } }),
  }), [pool, ownId]);

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
        id, name: normalized.name, data: normalized, libraryDetails, dirty: true, editedAt: new Date().toISOString(),
      });
      setEntity(normalized);
      baselineRef.current = canon(normalized);
      detailsBaselineRef.current = canon(libraryDetails);
      toast.success('Character saved!');
      return true;
    } catch (error) {
      toastError(error, { headline: 'Could not save character.' });
      return false;
    }
  };

  const handleExport = async () => {
    if (!entity) return;
    try {
      // A library item is its own source, so the card names it and the worlds that hold a linked copy.
      const blob = await exportEntityCard(entity, undefined, await exportedLibraryLinks('entity', entity.id), libraryDetails);
      // A chip in the name would otherwise put a raw placement id in the filename.
      downloadBlob(blob, `${labelPlaceholders(entity.name, pool, { letters }) || 'Character'}.webp`);
    } catch (error) {
      toastError(error, 'Could not export the entity.');
    }
  };

  return (
    <NoWorld>
    <EditorModeContext.Provider value={ALWAYS_ADVANCED}>
    <EditorPreviewRollsProvider>
    <PlacementLettersProvider letters={letters}>
    {/* Around the whole body, so no field reads the world's placeholder store. */}
    <PlaceholderStoreProvider value={phStore}>
      <EditorModalShell
        surface="entityEditor"
        surfaceTabs="entityEditor"
        open={isOpen}
        // A library character has no world behind it, so its own carried defs render the chips — the same
        // treatment its card and its listing get.
        title={labelPlaceholders(entity?.name ?? '', pool, { letters }) || 'Character'}
        contentClassName={LIBRARY_EDITOR_CONTENT_CLASS}
        loading={!entity}
        tabs={ENTITY_EDITOR_TABS}
        tab={tab}
        onTabChange={(v) => setTab(v as EntityEditorTab)}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={handleSave}
        onClose={onClose}
        onExport={handleExport}
        onPublish={onPublish && entity ? () => onPublish(entity, libraryDetails) : undefined}
      >
        {entity && tab === 'entity' ? (
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {!narrow && (
              <ScrollArea className="w-80 shrink-0">
                <div className="space-y-6 p-4 pr-0">
                  <LibraryAuthorField value={libraryDetails?.author} onChange={(author) => setLibraryDetails((prev) => ({ ...prev, author }))} />
                  <TagsField values={libraryDetails?.tags ?? entity.tags} onChange={handleTags} />
                </div>
              </ScrollArea>
            )}
            <FieldColumn fill>
              {/* The right column is narrow until `lg`, so labels wait for it. */}
              <PanelTabs
                surfaceTabs="entityEditorEntity"
                tabs={ENTITY_EDITOR_SUBTABS}
                value={subTab}
                onValueChange={setSubTab}
                stripLabel="Entity Fields"
                labelClassName="hidden lg:inline"
              >
                <ChipInsertTargetProvider>
                  <PlaceholderPaletteBar placeholders={pool} />
                  <PanelTabContent value="profile">
                    {narrow && (
                      <>
                        <LibraryAuthorField value={libraryDetails?.author} onChange={(author) => setLibraryDetails((prev) => ({ ...prev, author }))} />
                        <TagsField values={libraryDetails?.tags ?? entity.tags} onChange={handleTags} />
                      </>
                    )}
                    <EntityProfileFields
                      value={entity}
                      onChange={handleChange}
                      placeholders={pool}
                      home="library"
                      // Two columns need ~570px, which the field column has from `lg`.
                      columnsClassName="lg:grid-cols-[18rem_minmax(0,1fr)]"
                    />
                  </PanelTabContent>
                  <PanelTabContent value="descriptions">
                    <EntityDescriptionFields value={entity} onChange={handleChange} placeholders={pool} />
                  </PanelTabContent>
                  <PanelTabContent value="openings">
                    <EntityOpenings
                      entity={entity}
                      library
                      placeholders={pool}
                      names={{ placeholders: pool, letters }}
                      onChange={(patch) => setEntity((prev) => (prev ? { ...prev, ...patch } : prev))}
                    />
                  </PanelTabContent>
                </ChipInsertTargetProvider>
              </PanelTabs>
            </FieldColumn>
          </div>
        ) : entity && tab === 'traits' ? (
          // The palette tops the detail pane, over the fields it fills, as in the World Editor.
          <ChipInsertTargetProvider>
            <LibraryTraitsEditor
              entity={entity} setEntity={setEntity} placeholders={pool} onOpenEntity={() => setTab('entity')} world={traitWorld}
              detailHeader={<PlaceholderPaletteBar placeholders={pool} className={DETAIL_PALETTE_CLASS} />}
            />
          </ChipInsertTargetProvider>
        ) : (
          // A value is a chip field too, so the palette tops the detail pane here as well.
          <ChipInsertTargetProvider>
            {/* A copy reads the blueprints the card carries and never writes them. */}
            <LibraryPlaceholdersEditor
              ownerName={labelPlaceholders(entity?.name ?? '', pool, { letters })}
              carriedBlueprints={entity?.blueprints ?? NO_BLUEPRINTS}
              detailHeader={<PlaceholderPaletteBar placeholders={pool} className={DETAIL_PALETTE_CLASS} />}
            />
          </ChipInsertTargetProvider>
        )}
      </EditorModalShell>
    </PlaceholderStoreProvider>
    </PlacementLettersProvider>
    </EditorPreviewRollsProvider>
    </EditorModeContext.Provider>
    </NoWorld>
  );
};

export default EntityEditorModal;
