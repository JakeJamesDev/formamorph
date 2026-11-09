import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { DrillSlide, type SlideFrom } from '@/components/DrillSlide';
import { useListAdd } from '@/components/listToolbarHooks';
import { MENU_ROW } from '@/components/menuRow';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { useGameData } from '@/contexts/GameDataContext';
import { EntityIcon, LocationIcon } from '@/lib/elementIcons';
import type { OwnerChoice } from '@/lib/ownerChoices';
import type { LocationPicker } from '@/lib/openingsTab';
import type { GameLocation } from '@/types';
import { MENU_ROW_NAME, MenuLevel, OwnerList } from './OwnerPicker';

type Drill = 'location' | 'entity';

/**
 * The Openings tab's + menu: Location and Entity drill-ins over the locations and entities the tab doesn't
 * list. Lives inside a `ListSearchToolbar` menu; a pick closes it. Closing unmounts the drill-in, so the next
 * open starts at the top.
 */
export function OpeningsAddMenu({ locations, entityChoices, onPickLocation, onPickEntity }: {
  locations: LocationPicker;
  entityChoices: OwnerChoice[];
  onPickLocation: (location: GameLocation) => void;
  onPickEntity: (entityId: string) => void;
}) {
  const { add } = useListAdd();
  const [drill, setDrill] = useState<Drill | null>(null);
  // The drill-in last left, whose row takes focus back.
  const [left, setLeft] = useState<Drill | null>(null);
  const [from, setFrom] = useState<SlideFrom>(null);
  const go = (next: Drill | null) => { setLeft(drill); setDrill(next); setFrom(next ? 'right' : 'left'); };
  const drillRow = (to: Drill, Icon: typeof LocationIcon, text: string, enabled: boolean) => (
    <button type="button" className={MENU_ROW} disabled={!enabled} onClick={() => go(to)} autoFocus={left === to}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{text}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
  if (drill === 'entity') {
    return (
      <DrillSlide key="entity" from={from}>
        <OwnerList
          choices={entityChoices}
          label="Entities"
          onPick={(id) => add(() => onPickEntity(id))}
          back={{ label: 'Entity', onBack: () => go(null) }}
        />
      </DrillSlide>
    );
  }
  if (drill === 'location') {
    return (
      <DrillSlide key="location" from={from}>
        <LocationLevels picker={locations} onPick={(location) => add(() => onPickLocation(location))} onBack={() => go(null)} />
      </DrillSlide>
    );
  }
  return (
    <DrillSlide key="" from={from}>
      {drillRow('location', LocationIcon, 'Location', locations.any)}
      {drillRow('entity', EntityIcon, 'Entity', entityChoices.length > 0)}
    </DrillSlide>
  );
}

/**
 * The location drill-in, one level at a time. A location with a pickable location below it opens its level,
 * which starts with an Add to row for the location itself when it is pickable. Every other row is a pick.
 */
function LocationLevels({ picker, onPick, onBack }: {
  picker: LocationPicker;
  onPick: (location: GameLocation) => void;
  /** Returns to the menu from the top level. */
  onBack: () => void;
}) {
  const { placeholders } = useGameData();
  const [path, setPath] = useState<GameLocation[]>([]);
  const [from, setFrom] = useState<SlideFrom>(null);
  const go = (next: GameLocation[], side: SlideFrom) => { setPath(next); setFrom(side); };
  const here = path.at(-1) ?? null;
  const name = (location: GameLocation) => (location.name
    ? <PlaceholderText text={location.name} placeholders={placeholders} />
    : 'Unnamed Location');
  return (
    <MenuLevel
      levelKey={here?.id ?? ''}
      from={from}
      back={{ label: here ? name(here) : 'Location', onBack: () => (here ? go(path.slice(0, -1), 'left') : onBack()) }}
      label="Locations"
    >
      {here && picker.pickable(here.id) && (
        <>
          <button type="button" className={MENU_ROW} onClick={() => onPick(here)}>
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className={MENU_ROW_NAME}>Add to {name(here)}</span>
          </button>
          <div role="separator" className="-mx-1 my-1 h-px bg-border" />
        </>
      )}
      {picker.level(here?.id ?? null).map(({ location, drills }) => (
        <button
          key={location.id}
          type="button"
          className={MENU_ROW}
          onClick={() => (drills ? go([...path, location], 'right') : onPick(location))}
        >
          <LocationIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className={MENU_ROW_NAME}>{name(location)}</span>
          {drills && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
        </button>
      ))}
    </MenuLevel>
  );
}
