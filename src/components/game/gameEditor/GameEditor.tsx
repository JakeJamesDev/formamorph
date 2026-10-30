import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Undo2 } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ListDetail } from '@/components/ui/list-detail';
import { Hint, SectionTitle } from '@/components/ui/typography';
import { NavRail } from '@/components/NavRail';
import { SurfaceAppBar } from '@/components/SurfaceAppBar';
import { TruncatedText } from '@/components/TruncatedText';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { SearchField } from '@/components/ui/search-field';
import { useListSearch } from '@/components/listToolbarHooks';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { EditorSectionsBar } from '@/components/editor/EditorSectionsBar';
import { SaveSplitButton } from '@/components/editor/SaveSplitButton';
import EditorFindBar from '@/components/editor/EditorFindBar';
import { HistoryControls, type HistoryView } from '@/components/editor/HistoryControls';
import { Pager } from '@/components/ui/pagination';
import { useSaveStatus } from '@/components/editor/useSaveStatus';
import { YouMark } from '@/components/game/YouMark';
import { StatRow } from '@/components/game/StatRow';
import { useRemoveDiscovered } from '@/components/game/useRemoveDiscovered';
import { useReaderHistoryInput } from '@/components/formaquestion/useReaderHistoryInput';
import { useGameplay } from '@/contexts/GameplayContext';
import { useElementSize } from '@/lib/useElementSize';
import { useIsMobile } from '@/lib/useIsMobile';
import {
  EMPTY_DRAFT_HISTORY, GAME_EDITOR_PLAYER, changedField, draftAt, draftHasChanges, draftedEntities, draftedStats, savedEntities,
  withDraftEntity, withDraftExtra, withDraftRemoved, withDraftStat, withStep, type DraftHistory, type GameEditorDraft,
} from '@/lib/gameEditorDraft';
import { NO_PLACES, stepPlace, withPlace, type GameEditorPlaces } from '@/lib/gameEditorPlaces';
import { gameEntityTabFor, gameSearchTargets } from '@/lib/gameEditorSearch';
import { EMPTY_LETTERS } from '@/lib/placementLetters';
import type { SearchMatch } from '@/lib/worldSearch';
import type { StepLabelParts } from '@/lib/editorHistoryLabels';
import { cn } from '@/lib/utils';
import { RAIL_ROOM_PX } from '@/views/worldEditorTabs';
import { GAME_EDITOR_TABS, gameEditorTabGroups, type GameEditorTabValue } from '@/views/gameEditorTabs';
import type { GameEditorContext, GameEditorParts, GameEditorSection, UseGameEditorExtension } from './gameEditorExtension';
import { useGameEntityEditor } from './useGameEntityEditor';
import type { DiscoveredEntity, GameLocation, Placeholder, PlayerStat } from '@/types';

const RAIL_STORAGE_KEY = 'formamorph.gameEditor.navRail';
const NO_EXTENSIONS: readonly UseGameEditorExtension[] = [];
const NO_PLACEHOLDERS: Placeholder[] = [];
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Where the Game Editor opens: a tab, and on Entities an entity to select. `key` reopens on the same request. */
export interface GameEditorRequest {
  /** An editor tab, or one an extension adds. */
  tab: GameEditorTabValue | (string & {});
  entityId?: string;
  key: number;
}

/** The scene the Overview shows. */
export interface GameEditorScene {
  locationName?: string;
  timeLabel?: string;
  /** Who is in the scene, the player left out. */
  here: readonly { id: string; name: string }[];
  /** Who the AI is told is nearby, as `<ENTITIES|reachable>` lists them. */
  nearby?: readonly { id: string; name: string }[];
}

export interface GameEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: GameEditorRequest;
  worldName: string;
  /** The player, listed first, with their stats. */
  player?: { name: string };
  locations: readonly GameLocation[];
  scene: GameEditorScene;
  /** Pages the game to a turn, as the game's own pager does. */
  onPageChange: (page: number) => void;
  /** The features laid over the editor. The list must not change between renders. */
  extensions?: readonly UseGameEditorExtension[];
}

/**
 * The Game Editor: the World Editor's shell over the running game. It edits what the story has made of the
 * world in this save, never the world. Edits wait in a draft over the live game until Save. On a past turn it
 * shows the game as that turn left it and reads only.
 */
export function GameEditor(props: GameEditorProps) {
  const { open, onOpenChange, request, worldName, player, locations, scene, onPageChange, extensions = NO_EXTENSIONS } = props;
  const {
    discoveredEntities: liveDiscovered, setDiscoveredEntities,
    currentPage, totalPages, isViewingPast, viewDiscoveredEntities,
    globalStats, viewStats, entityStats, viewEntityStats, commitManualStatEdit, commitManualEntityStatEdit,
  } = useGameplay();
  const past = isViewingPast;
  const isMobile = useIsMobile();
  const removeCharacter = useRemoveDiscovered();

  // The draft and its undo history. Save and Discard Changes start both over.
  const [history, setHistory] = useState<DraftHistory>(EMPTY_DRAFT_HISTORY);
  const draft = draftAt(history);
  const dirty = draftHasChanges(draft);
  const edit = (label: StepLabelParts, key: string, update: (d: GameEditorDraft) => GameEditorDraft) =>
    setHistory((h) => withStep(h, { draft: update(draftAt(h)), label, key }));
  const saveStatus = useSaveStatus(dirty);

  const [tab, setTab] = useState<string>(request.tab);
  const [selectedId, setSelectedId] = useState<string | null>(request.entityId ?? null);
  const [entityTab, setEntityTab] = useState<string>('profile');
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [closePrompt, setClosePrompt] = useState(false);
  const search = useListSearch();
  // The places visited, for the mouse's back and forward buttons. Declared ahead of the request's landing, so
  // a landing starts the list over the place the editor was left on.
  const [places, setPlaces] = useState<GameEditorPlaces>(NO_PLACES);
  useEffect(() => {
    if (open) setPlaces((p) => withPlace(p, { tab, selectedId, entityTab }));
  }, [open, tab, selectedId, entityTab]);
  // A request lands on its tab and entity; reopening starts from a clean draft.
  useEffect(() => {
    if (!open) return;
    setTab(request.tab);
    setSelectedId(request.entityId ?? null);
    setPlaces(withPlace(NO_PLACES, { tab: request.tab, selectedId: request.entityId ?? null, entityTab }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the panel tab stays as the player left it
  }, [open, request.key, request.tab, request.entityId]);
  useEffect(() => { if (!open) setHistory(EMPTY_DRAFT_HISTORY); }, [open]);

  // Paged back, the editor shows the game as that turn left it; the draft lies over the latest turn only.
  const baseDiscovered = past ? viewDiscoveredEntities : liveDiscovered;
  const shownDiscovered = useMemo(
    () => (past ? baseDiscovered : draftedEntities(baseDiscovered, draft)),
    [past, baseDiscovered, draft],
  );

  const placeName = (id?: string) => locations.find((l) => l.id === id)?.name ?? 'Nowhere';
  const term = search.typed.toLowerCase();
  const matches = (name: string, aliases?: readonly string[]) =>
    !term || [name, ...(aliases ?? [])].some((n) => n.toLowerCase().includes(term));
  const listedEntities = shownDiscovered.filter((d) => matches(d.entity.name, d.entity.aliases));
  const playerName = player?.name || 'You';
  const playerListed = !!player && matches(playerName);

  // The detail falls back to the player, or the first entity, so the panel is never empty beside a list.
  const fallbackId = player ? GAME_EDITOR_PLAYER : shownDiscovered[0]?.entity.id ?? null;
  const detailId = selectedId ?? (isMobile ? null : fallbackId);
  const selectedRecord = shownDiscovered.find((d) => d.entity.id === detailId);
  const subject = detailId === GAME_EDITOR_PLAYER && player
    ? { kind: 'player' as const }
    : selectedRecord
      ? { kind: 'entity' as const, record: selectedRecord, live: liveDiscovered.find((d) => d.entity.id === selectedRecord.entity.id) }
      : null;

  // The extensions, called in the list's fixed order. Their parts lay over the editor's own.
  const stepHistory = (delta: -1 | 1) => {
    const next = stepPlace(places, delta);
    if (!next) return;
    const place = next.list[next.at];
    setPlaces(next);
    setTab(place.tab);
    setSelectedId(place.selectedId);
    setEntityTab(place.entityTab);
  };
  const windowRef = useRef<HTMLElement | null>(null);
  // The dialog is modal, so all input is in it; a prompt over it keeps the buttons to itself.
  useReaderHistoryInput({ enabled: open && !closePrompt && removing === null, windowRef, guideOpen: true, onStep: stepHistory });
  const openEntity = (id: string) => { setTab('entities'); setSelectedId(id); };
  const context: GameEditorContext = {
    readOnly: past,
    entities: shownDiscovered,
    selectedId: detailId,
    openTab: setTab,
    openEntity,
    extra: <T,>(key: string) => draft.extras?.[key] as T | undefined,
    setExtra: (label, stepKey, key, value) => edit(label, stepKey, (d) => withDraftExtra(d, key, value)),
  };
  // eslint-disable-next-line react-hooks/rules-of-hooks -- the list is fixed for the editor's life
  const added: GameEditorParts[] = extensions.map((useExtension) => useExtension(context));
  const parts: GameEditorParts = Object.assign({}, ...added);
  const extraTabs = added.flatMap((p) => p.tabs ?? []);
  const entityTabs = added.flatMap((p) => p.entityTabs ?? []);
  const tabGroups = gameEditorTabGroups(extraTabs.map((t) => t.tab));
  const allTabs = [...GAME_EDITOR_TABS, ...extraTabs.map((t) => t.tab)];

  // Each edit is a history step, labeled with the entity and the field it changed.
  const editEntity = (record: DiscoveredEntity) => {
    const id = record.entity.id;
    const before = shownDiscovered.find((d) => d.entity.id === id);
    const field = changedField(before, record) ?? 'Entity';
    edit({ verb: 'Edit', type: 'Entity', name: before?.entity.name ?? record.entity.name, field }, `${id}:${field}`,
      (d) => withDraftEntity(d, liveDiscovered.find((x) => x.entity.id === id), record));
  };
  // The player's stats are the game's own; an entity's are its entity stats. Both as of the turn on show.
  const liveStatsOf = (id: string): readonly PlayerStat[] => (id === GAME_EDITOR_PLAYER
    ? (past ? viewStats : globalStats)
    : (past ? viewEntityStats : entityStats)[id] ?? []);
  const editStat = (id: string, statId: string, value: number) => {
    const stat = liveStatsOf(id).find((s) => s.id === statId);
    const name = id === GAME_EDITOR_PLAYER ? playerName : shownDiscovered.find((d) => d.entity.id === id)?.entity.name;
    edit({ verb: 'Edit', type: 'Entity', name, field: stat?.name ?? 'Stat' }, `${id}:stat:${statId}`,
      (d) => withDraftStat(d, stat?.value, id, statId, value));
  };
  const { detail: entityDetail, footer: entityFooter } = useGameEntityEditor({
    subject,
    readOnly: past,
    locations,
    tab: entityTab,
    onTabChange: setEntityTab,
    onEntityChange: editEntity,
    stats: detailId ? (past ? liveStatsOf(detailId) : draftedStats(liveStatsOf(detailId), draft, detailId)) : [],
    onStatChange: (statId, value) => { if (detailId) editStat(detailId, statId, value); },
    page: currentPage,
    onRemove: () => setRemoving(detailId),
    parts: { ...parts, entityTabs },
  });

  // Writes the draft into the game. Removing an invented entity also keeps the story from bringing it back.
  const save = async () => {
    if (!dirty) return true;
    const gone = liveDiscovered.filter((d) => draft.removed.includes(d.entity.id));
    for (const d of gone) removeCharacter(d.entity.name);
    if (Object.keys(draft.entities).length) setDiscoveredEntities((prev) => savedEntities(prev, draft));
    for (const [id, values] of Object.entries(draft.stats ?? {})) {
      if (id === GAME_EDITOR_PLAYER) commitManualStatEdit(draftedStats(globalStats, draft, id));
      else for (const [statId, value] of Object.entries(values)) commitManualEntityStatEdit(id, statId, value);
    }
    for (const part of added) part.onSave?.();
    setHistory(EMPTY_DRAFT_HISTORY);
    return true;
  };
  const discard = () => setHistory(EMPTY_DRAFT_HISTORY);
  const historyView = useMemo<HistoryView>(() => ({
    canUndo: history.cursor > 0,
    canRedo: history.cursor < history.steps.length,
    rows: history.steps.map((s) => s.label),
    cursor: history.cursor,
    saved: null,
    undo: () => setHistory((h) => ({ ...h, cursor: Math.max(0, h.cursor - 1) })),
    redo: () => setHistory((h) => ({ ...h, cursor: Math.min(h.steps.length, h.cursor + 1) })),
    jump: (position) => setHistory((h) => ({ ...h, cursor: Math.max(0, Math.min(h.steps.length, position)) })),
  }), [history]);

  // Find and Replace over the game's text, as the World Editor's docked search does over the world's.
  const searchTargets = useMemo(() => (past ? [] : gameSearchTargets({
    entities: shownDiscovered,
    onEntity: editEntity,
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the editors read the same draft these lists come from
  }).concat(added.flatMap((p) => p.searchTargets ?? []))), [past, shownDiscovered, draft.extras]);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const revealMatch = (match: SearchMatch | null) => {
    if (!match) return;
    setTab('entities');
    setSelectedId(match.target.itemId);
    setEntityTab(gameEntityTabFor(match.target.fieldKey));
  };
  const saveProps = {
    status: saveStatus.status,
    onSave: () => { void saveStatus.track(save); },
    menu: [{ label: 'Discard Changes', icon: <Undo2 className="mr-2 h-4 w-4 shrink-0" />, onClick: discard }],
  };
  const requestClose = (next: boolean) => {
    if (next) { onOpenChange(true); return; }
    if (dirty) setClosePrompt(true);
    else onOpenChange(false);
  };

  const turnLabel = `Turn ${currentPage} of ${totalPages}${past ? ' · Read Only' : ''}`;
  const removingRecord = shownDiscovered.find((d) => d.entity.id === removing);

  // ── Entities ──
  const entityList = (
    <EditorRowList aria-label="Game entities">
      {playerListed && player && (
        <EditorRow
          grip={false}
          selected={detailId === GAME_EDITOR_PLAYER}
          onSelect={() => setSelectedId(GAME_EDITOR_PLAYER)}
          selectionLabel={playerName}
          label={<>{playerName}<YouMark onFill={detailId === GAME_EDITOR_PLAYER} /></>}
          meta="Your stats"
        />
      )}
      {listedEntities.map((d) => (
        <EditorRow
          key={d.entity.id}
          grip={false}
          selected={detailId === d.entity.id}
          onSelect={() => setSelectedId(d.entity.id)}
          selectionLabel={d.entity.name}
          label={d.entity.name}
          meta={placeName(d.locationId)}
        />
      ))}
      {shownDiscovered.length === 0 && !term && (
        <Hint className="px-2 py-3">The story hasn&apos;t invented any entities yet.</Hint>
      )}
      {term && !playerListed && listedEntities.length === 0 && <Hint className="px-2 py-3">No matches</Hint>}
    </EditorRowList>
  );
  const entityToolbar = (
    <SearchField data-editor-find-skip placeholder="Search Entities" value={search.term} onChange={search.setTerm} onClear={search.clear} />
  );
  const noEntity = <Hint className="p-3">Select an entity to edit it</Hint>;

  // ── Overview ──
  const facts: [string, ReactNode][] = [
    ['World', worldName || 'Untitled World'],
    ['Turn', past ? `${currentPage} of ${totalPages}` : String(currentPage)],
    ...(scene.timeLabel ? [['Time', scene.timeLabel] as [string, ReactNode]] : []),
    ['Location', scene.locationName ?? 'Nowhere'],
  ];
  // The player's stats as the turn on show has them; editing is on Active.
  const playerStats = player ? (past ? liveStatsOf(GAME_EDITOR_PLAYER) : draftedStats(liveStatsOf(GAME_EDITOR_PLAYER), draft, GAME_EDITOR_PLAYER)).filter((s) => !s.hidden) : [];
  const jumps: [string, string, string][] = [
    ['entities', 'Active', count(shownDiscovered.length + (player ? 1 : 0), 'entity', 'entities')],
    ...extraTabs.flatMap(({ tab: t, jump }): [string, string, string][] => (jump ? [[t.value, t.label, jump]] : [])),
  ];
  const overviewList = (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionTitle>This Game</SectionTitle>
        <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-label">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 truncate">{value}</dd>
            </div>
          ))}
        </dl>
        <EditorRowList aria-label="Jump to a tab">
          {jumps.map(([value, label, meta]) => (
            <EditorRow key={value} grip={false} selected={false} onSelect={() => setTab(value)} selectionLabel={label} label={label} meta={meta} />
          ))}
        </EditorRowList>
      </section>
      {player && (
        <section className="space-y-3">
          <SectionTitle>You</SectionTitle>
          <EditorRowList>
            <EditorRow grip={false} selected={false} onSelect={() => openEntity(GAME_EDITOR_PLAYER)} selectionLabel={playerName} label={<>{playerName}<YouMark /></>} meta="Edit on Active" />
          </EditorRowList>
          {playerStats.length > 0 && (
            <div className="space-y-3">
              {playerStats.map((stat) => (
                <StatRow
                  key={stat.id}
                  stat={stat}
                  change={0}
                  barDelta={0}
                  draining={false}
                  fading={false}
                  page={currentPage}
                  isViewingPast={past}
                  snap
                  editable={false}
                  reserveDescriptorLine={false}
                  onCommitValue={() => {}}
                />
              ))}
            </div>
          )}
        </section>
      )}
      {added.map((p, i) => <Fragment key={i}>{p.overviewList}</Fragment>)}
    </div>
  );
  const editableIds = new Set(shownDiscovered.map((d) => d.entity.id));
  const overviewDetail = (
    <div className="space-y-6">
    <section className="space-y-3">
      <SectionTitle>Here Now</SectionTitle>
      <Hint>Who the story has at {scene.locationName ?? 'this location'}</Hint>
      {scene.here.length === 0 ? <Hint>Nobody else is here</Hint> : (
        <EditorRowList>
          {scene.here.map((e) => {
            const editable = editableIds.has(e.id);
            return (
              <EditorRow
                key={e.id}
                grip={false}
                selected={false}
                onSelect={() => { if (editable) openEntity(e.id); }}
                selectionLabel={e.name}
                label={e.name}
                meta={editable ? undefined : 'World entity'}
              />
            );
          })}
        </EditorRowList>
      )}
    </section>
    <section className="space-y-3">
      <SectionTitle>Nearby</SectionTitle>
      <Hint>Who the AI is told is in the places reachable from here</Hint>
      {(scene.nearby ?? []).length === 0 ? <Hint>Nobody is nearby</Hint> : (
        <EditorRowList aria-label="Nearby">
          {(scene.nearby ?? []).map((e) => {
            const editable = editableIds.has(e.id);
            return (
              <EditorRow
                key={e.id}
                grip={false}
                selected={false}
                onSelect={() => { if (editable) openEntity(e.id); }}
                selectionLabel={e.name}
                label={e.name}
                meta={editable ? undefined : 'World entity'}
              />
            );
          })}
        </EditorRowList>
      )}
    </section>
    {added.map((p, i) => <Fragment key={i}>{p.overviewDetail}</Fragment>)}
    </div>
  );


  const section: GameEditorSection = extraTabs.find((t) => t.tab.value === tab)?.section ?? (tab === 'entities'
    ? {
      toolbar: entityToolbar, list: entityList, detail: entityDetail ?? noEntity, footer: entityFooter, detailScrolls: !!entityDetail,
      push: { showDetail: !!selectedId, onBack: () => setSelectedId(null), backLabel: 'Active' },
    }
    : { list: overviewList, detail: overviewDetail });

  // One panel per tab so every trigger's `aria-controls` resolves; only the active tab has a body.
  const tabPanels = (body: ReactNode) => allTabs.map((t) => (
    <TabsContent key={t.value} value={t.value} className="contents">
      {t.value === tab ? body : null}
    </TabsContent>
  ));
  const [listCardRef, listCardSize] = useElementSize();
  const railAutoCollapsed = listCardSize.width > 0 && listCardSize.width < RAIL_ROOM_PX;

  const appBar = (
    <SurfaceAppBar
      start={(
        <>
          <CardTitle className="shrink-0">Game Editor</CardTitle>
          {worldName.trim() && (
            <>
              <ChevronRight aria-hidden className="mx-1 h-3 w-3 shrink-0 text-muted-foreground" />
              <TruncatedText text={worldName.trim()} className="text-body text-muted-foreground" />
            </>
          )}
        </>
      )}
      center={(
        <EditorFindBar
          layout="docked"
          expanded={searchExpanded}
          onExpandedChange={setSearchExpanded}
          targets={searchTargets}
          placeholders={NO_PLACEHOLDERS}
          placementLetters={EMPTY_LETTERS}
          allowPlaceholderReplace={false}
          onNavigate={revealMatch}
          onAddPlaceholder={() => {}}
          onClose={() => setSearchExpanded(false)}
          subject="Game"
        />
      )}
      end={(
        <>
          <HistoryControls history={historyView} layout="pill" headLabel="Editor opened" />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <SaveSplitButton {...saveProps} />
        </>
      )}
    />
  );

  // The turns from the start of the game to the latest, spread over the window's width.
  const timeline = (
    <div className="flex shrink-0 items-center gap-3 border-t px-3 py-2">
      <Pager page={currentPage} pageCount={totalPages} onPageChange={onPageChange} fill className="min-w-0 flex-1" />
      <span className="shrink-0 text-meta text-muted-foreground">{turnLabel}</span>
    </div>
  );

  const desktop = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* The dialog's close X sits in the bar's corner, so the bar keeps clear of it. */}
      <div className="shrink-0 border-b pr-10">{appBar}</div>
      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal">
          <Panel id="game-editor-list" order={1} defaultSize={45} minSize={30}>
            <div className="h-full p-3">
              <Card ref={listCardRef} className="flex h-full flex-col">
                <Tabs value={tab} onValueChange={setTab} orientation="vertical" surfaceTabs="gameEditor" className="flex min-h-0 flex-1">
                  <NavRail label="Game Editor Sections" groups={tabGroups} value={tab} storageKey={RAIL_STORAGE_KEY} autoCollapsed={railAutoCollapsed} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <CardContent className="flex flex-grow flex-col overflow-hidden p-3">
                      {section.toolbar}
                      {tabPanels(
                        <div className={cn('min-h-0 flex-grow', section.toolbar && 'mt-4')}>
                          {section.listScrolls
                            ? <div className="flex h-full flex-col">{section.list}</div>
                            : <ScrollArea landingRoom className="h-full">{section.list}</ScrollArea>}
                        </div>,
                      )}
                    </CardContent>
                  </div>
                </Tabs>
              </Card>
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 cursor-col-resize bg-secondary" />
          <Panel id="game-editor-detail" order={2} minSize={30}>
            <div className="h-full p-3">
              <Card className="flex h-full flex-col">
                <CardContent className="flex min-h-0 flex-1 flex-col p-3 [--panel-gutter:theme(spacing.3)]">
                  {section.detailScrolls ? section.detail : <ScrollArea className="h-full">{section.detail}</ScrollArea>}
                </CardContent>
                {section.footer}
              </Card>
            </div>
          </Panel>
        </PanelGroup>
      </div>
      {timeline}
    </div>
  );

  const mobile = (
    // `min-h-0` lets the body scroll inside the dialog instead of pushing the header and footer out of it.
    <Card className="flex min-h-0 flex-1 flex-col rounded-none border-0">
      <CardHeader className="flex-row items-center gap-2 space-y-0 px-3 py-2 pr-12">
        <CardTitle className="shrink-0">Game Editor</CardTitle>
        <div className="ml-auto"><HistoryControls history={historyView} layout="icon" headLabel="Editor opened" /></div>
      </CardHeader>
      <Tabs value={tab} onValueChange={setTab} orientation="vertical" activationMode="manual" surfaceTabs="gameEditor" className="flex min-h-0 flex-grow flex-col">
        <EditorSectionsBar groups={tabGroups} label="Game Editor Sections" bodyId="game-editor-sections" value={tab} open={sectionsOpen} onOpenChange={setSectionsOpen} />
        <CardContent className="flex flex-grow flex-col overflow-hidden p-2">
          {section.push && !section.push.showDetail && section.toolbar}
          {tabPanels(section.push ? (
            <ListDetail
              className={!section.push.showDetail && section.toolbar ? 'mt-4' : undefined}
              showDetail={section.push.showDetail}
              onBack={section.push.onBack}
              backLabel={section.push.backLabel}
              list={section.list}
              detail={<div className="flex h-full flex-col p-1 [--panel-gutter:theme(spacing.1)]">{section.detail}</div>}
              detailFooter={section.footer}
              scrollDetail={!section.detailScrolls}
            />
          ) : (
            <ScrollArea className="min-h-0 flex-grow">
              <div className="space-y-6 p-1">{section.list}{section.detail}</div>
            </ScrollArea>
          ))}
        </CardContent>
      </Tabs>
      {/* Mobile has no app bar, so Save sits in the footer, within thumb reach. */}
      <div className="flex flex-wrap items-center gap-2 border-t p-3">
        <Pager page={currentPage} pageCount={totalPages} onPageChange={onPageChange} />
        <span className="text-meta text-muted-foreground">{turnLabel}</span>
        <div className="ml-auto"><SaveSplitButton {...saveProps} iconOnly /></div>
      </div>
    </Card>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent surface="gameEditor" aria-describedby={undefined} className="flex h-[90dvh] w-[95vw] max-w-[95vw] flex-col overflow-hidden p-0">
          <DialogTitle className="sr-only">Game Editor</DialogTitle>
          {isMobile ? mobile : desktop}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => { if (!o) setRemoving(null); }}
        title={`Remove ${removingRecord?.entity.name ?? ''}?`}
        description="This takes them out of the game when you save, and stops the story bringing them back."
        onConfirm={() => {
          if (removing) edit({ verb: 'Remove', type: 'Entity', name: removingRecord?.entity.name }, `remove:${removing}`, (d) => withDraftRemoved(d, removing));
          setSelectedId(null);
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
      <UnsavedChangesDialog
        open={closePrompt}
        onOpenChange={setClosePrompt}
        onSave={() => { void saveStatus.track(save).then((ok) => { if (ok) onOpenChange(false); }); }}
        onExit={() => { discard(); onOpenChange(false); }}
      />
    </>
  );
}
