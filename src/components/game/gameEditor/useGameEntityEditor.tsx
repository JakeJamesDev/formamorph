import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PanelTabContent, PanelTabs } from '@/components/ui/panel-tabs';
import { KeywordChips } from '@/components/KeywordChips';
import AiGenerateButton from '@/components/AiGenerateButton';
import { StatRow } from '@/components/game/StatRow';
import { ImageGallery, ImageWidget } from '@/managers/ImageTagsField';
import { GAME_ENTITY_PANEL_TABS } from '@/views/gameEditorTabs';
import { entityImages } from '@/lib/entityImages';
import { IMAGE_CAPS } from '@/lib/imageOptim';
import type { GameEditorParts } from './gameEditorExtension';
import type { DiscoveredEntity, Entity, GalleryImage, GameLocation, PlayerStat } from '@/types';

/** The location select's value for an entity that belongs nowhere: it is in no scene until moved. */
const NO_PLACE = '__nowhere__';
/** The player's entry holds stats only, unless an extension keeps their fields in the save. */
const STATS_TAB = GAME_ENTITY_PANEL_TABS.filter((t) => t.value === 'stats');

/** Whose entry the panel shows: the player's stats, an entity of the world, or an invented entity. A world
 *  entity's text belongs to the world; its stats, and where it stands when it has one place, are this game's. */
export type GameEntitySubject =
  | { kind: 'player'; persona?: Entity }
  | { kind: 'world'; entity: Entity; position: string | undefined; listed: readonly string[]; onMove: (locationId: string) => void }
  | { kind: 'entity'; record: DiscoveredEntity; live: DiscoveredEntity | undefined };

export interface GameEntityEditorProps {
  /** Null when there is nothing to show; the panel and footer are then empty. */
  subject: GameEntitySubject | null;
  /** A past turn: the panel reads only. */
  readOnly: boolean;
  locations: readonly GameLocation[];
  tab: string;
  onTabChange: (tab: string) => void;
  onEntityChange: (record: DiscoveredEntity) => void;
  /** The entity's stats, or the player's, with the draft's values. */
  stats: readonly PlayerStat[];
  onStatChange: (statId: string, value: number) => void;
  /** The turn on show, so a stat row's change chip resets per page. */
  page: number;
  onRemove: () => void;
  /** What the editor's extensions add to the panel. */
  parts: GameEditorParts;
}

/**
 * The Game Editor's detail panel for one entry, and its frozen footer. Edits go to the editor's draft as
 * they are made. The footer holds the actions on the whole entity, as the World Editor's blueprint footer does.
 */
export function useGameEntityEditor(props: GameEntityEditorProps): { detail: ReactNode; footer: ReactNode } {
  const { subject, readOnly, locations, tab, onTabChange, parts } = props;
  const record = subject?.kind === 'entity' ? subject.record : null;
  const player = subject?.kind === 'player';
  const world = subject?.kind === 'world' ? subject : null;
  const id = record?.entity.id ?? world?.entity.id ?? '';
  const entry = player ? parts.player : undefined;
  const persona = subject?.kind === 'player' ? subject.persona : undefined;
  const entity: Partial<Entity> = record?.entity ?? world?.entity ?? entry?.fields ?? persona ?? {};
  const name = entity.name ?? '';
  const pronouns = entity.pronouns ?? '';
  const aliases = entity.aliases ?? [];
  const note = entity.aiDescription ?? '';
  const playerDescription = entity.playerDescription ?? '';
  const summary = entity.aiSummary ?? '';

  const locked = readOnly || !!world || (!!persona && !entry);

  const edit = (patch: Partial<Entity>) => {
    if (record) props.onEntityChange({ ...record, entity: { ...record.entity, ...patch } });
    else entry?.onEdit(patch);
  };
  const liveName = subject?.kind === 'entity' ? subject.live?.entity.name : undefined;

  const profile = (
    <ImageWidget
      label="Pictures"
      images={entityImages(entity)}
      onImagesChange={(next: GalleryImage[]) => edit({ images: next })}
      slots={Infinity}
      imageId={`game-entity-image-${id}`}
      cap={IMAGE_CAPS.entity}
      description={note}
      kind="character"
      onTagsChange={() => {}}
    >
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <ImageGallery />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`game-entity-name-${id}`}>Name</Label>
            <Input id={`game-entity-name-${id}`} value={name} onChange={(e) => edit({ name: e.target.value })} />
            {liveName && name.trim() && name.trim() !== liveName && (
              <p className="text-meta text-muted-foreground">{liveName} is kept under Aliases, so the story can still use it</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Aliases</Label>
            <KeywordChips keywords={aliases} onChange={(next) => edit({ aliases: next })} placeholder="Press Enter after each alias" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`game-entity-pronouns-${id}`}>Pronouns</Label>
            <Hint>Tells the AI how to refer to this entity</Hint>
            <Input id={`game-entity-pronouns-${id}`} value={pronouns} placeholder="she/her, he/him, it/its" onChange={(e) => edit({ pronouns: e.target.value })} />
          </div>
          {record && (
            <div className="space-y-2">
              <Label id={`game-entity-place-${id}`}>Location</Label>
              <Hint>Moves this entity in the game</Hint>
              <Select value={record.locationId ?? NO_PLACE} onValueChange={(v) => props.onEntityChange({ ...record, locationId: v === NO_PLACE ? undefined : v })}>
                <SelectTrigger aria-labelledby={`game-entity-place-${id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  <SelectItem value={NO_PLACE}>Nowhere</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {parts.profile}
        </div>
      </div>
    </ImageWidget>
  );

  // The World Editor's three descriptions.
  const descriptions = (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`game-entity-player-desc-${id}`}>Player-Facing Description</Label>
          <AiGenerateButton mode="playerDesc" kind="character" source={note} onChange={(s) => edit({ playerDescription: s })} />
        </div>
        <Textarea id={`game-entity-player-desc-${id}`} className="min-h-24" value={playerDescription} onChange={(e) => edit({ playerDescription: e.target.value })} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`game-entity-ai-desc-${id}`}>AI-Facing Description</Label>
          <div className="flex items-center gap-1">
            {parts.descriptionTools}
            <AiGenerateButton mode="aiDesc" kind="character" source={playerDescription} onChange={(s) => edit({ aiDescription: s })} />
          </div>
        </div>
        <Textarea id={`game-entity-ai-desc-${id}`} className="min-h-32" value={note} onChange={(e) => edit({ aiDescription: e.target.value })} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`game-entity-summary-${id}`}>AI-Facing Summary</Label>
          <AiGenerateButton mode="summary" source={note} onChange={(s) => edit({ aiSummary: s })} />
        </div>
        <Hint>Replaces the full description in prompt slots too small for it. Keep it brief.</Hint>
        <Textarea id={`game-entity-summary-${id}`} className="min-h-16" value={summary} onChange={(e) => edit({ aiSummary: e.target.value })} />
      </div>
    </>
  );

  // The game's own stat rows, editable as in the side panel's Edit Stats.
  const visibleStats = props.stats.filter((stat) => !stat.hidden);
  const statsBody = visibleStats.length === 0
    ? <Hint>{player ? 'This world gives you no stats' : 'This entity has no stats in this game'}</Hint>
    : (
      <div className="space-y-3">
        {visibleStats.map((stat) => (
          <StatRow
            key={stat.id}
            stat={stat}
            change={0}
            barDelta={0}
            draining={false}
            fading={false}
            page={props.page}
            isViewingPast={readOnly}
            snap
            editable={!readOnly}
            reserveDescriptorLine={visibleStats.some((s) => (s.descriptors?.length ?? 0) > 0)}
            onCommitValue={(value) => props.onStatChange(stat.id, value)}
          />
        ))}
      </div>
    );

  const worldNote = world && (
    <div className="mb-3 space-y-3">
      <Hint>A world entity. Its text stays as the world has it; its stats and where it stands are this game&apos;s.</Hint>
      <div className="space-y-2">
        <Label id={`game-entity-place-${id}`}>Location</Label>
        <Hint>Moves this entity in this game</Hint>
        <Select disabled={readOnly} value={world.position ?? (world.listed.length === 1 ? world.listed[0] : '')} onValueChange={world.onMove}>
          <SelectTrigger aria-labelledby={`game-entity-place-${id}`}><SelectValue placeholder={world.listed.length ? 'Several places' : 'Nowhere'} /></SelectTrigger>
          <SelectContent>
            {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const personaNote = persona && !entry && (
    <Hint className="mb-3">Your persona. Its text stays as it is outside this game; your stats are this game&apos;s.</Hint>
  );

  // The panel's tabs: the fields when there are any, an extension's tabs, then the stats.
  const fieldTabs = record || world || entry || persona ? GAME_ENTITY_PANEL_TABS.filter((t) => t.value !== 'stats') : [];
  const extraTabs = parts.entityTabs ?? [];
  const tabs = [...fieldTabs, ...extraTabs, ...STATS_TAB];
  const detail = (
    <PanelTabs
      tabs={tabs}
      value={tabs.some((t) => t.value === tab) ? tab : tabs[0].value}
      onValueChange={onTabChange}
      stripLabel="Entity Fields"
      surfaceTabs="gameEditorEntity"
    >
      {fieldTabs.length > 0 && (
        <>
          <PanelTabContent value="profile">{worldNote}{personaNote}<fieldset disabled={locked} className="contents">{profile}</fieldset></PanelTabContent>
          <PanelTabContent value="descriptions"><fieldset disabled={locked} className="contents">{descriptions}</fieldset></PanelTabContent>
        </>
      )}
      {extraTabs.map((t) => <PanelTabContent key={t.value} value={t.value}>{t.body}</PanelTabContent>)}
      <PanelTabContent value="stats">{statsBody}</PanelTabContent>
    </PanelTabs>
  );

  const footer = readOnly || (!record && !parts.footerStart && !parts.footerEnd) ? null : (
    <div className="flex flex-wrap items-center gap-2 border-t p-3">
      {parts.footerStart}
      {record && (
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={props.onRemove}>
          <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />Remove
        </Button>
      )}
      {parts.footerEnd && <span className="mr-auto" />}
      {parts.footerEnd}
    </div>
  );

  return subject ? { detail, footer } : { detail: null, footer: null };
}
