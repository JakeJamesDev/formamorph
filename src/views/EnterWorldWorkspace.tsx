import { useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ListTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { DictionarySelectionItem } from '@/lib/dictionarySelection';
import type { EntityMetadata, GameLocation, Stat, Trait, TraitGroup } from '@/types';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useIsMobile';
import EnterWorldLibrary from './EnterWorldLibrary';

interface TraitCategory {
  kind: 'traits';
  id: string | null;
  name: string;
  group?: TraitGroup;
  path: TraitGroup[];
  depth: number;
  traits: Trait[];
}

interface NavigationGroup {
  group: TraitGroup;
  depth: number;
  categoryIndex: number;
}

interface TraitWorkspace {
  categories: TraitCategory[];
  navigationGroups: NavigationGroup[];
}

export interface EnterWorldWorkspaceProps {
  worldName: string;
  traits: Trait[];
  traitGroups: TraitGroup[];
  stats: Stat[];
  locations: GameLocation[];
  resolveText: (text: string) => string;
  resolveTraitText: (trait: Trait, text: string) => string;
  selectedTraits: string[];
  selectedLocationId: string | null;
  libraryEntities: EntityMetadata[];
  selectedEntityIds: Set<string>;
  dictionaryItems: DictionarySelectionItem[];
  categoryIndex: number;
  onCategoryChange: (index: number) => void;
  onTraitSelect: (traitId: string) => void;
  onLocationChange: (locationId: string | null) => void;
  onEntityToggle: (entityId: string, selected: boolean) => void;
  onDictionaryItemsChange: (items: DictionarySelectionItem[]) => void;
  onSaveAdditions?: () => void;
  onIntroduction?: () => void;
  onCancel: () => void;
  onContinue: () => void;
  continueLabel: string;
  resolving?: boolean;
}

const authoredOrder = <T extends { order?: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const choiceRowClass = (selected: boolean) => cn(
  'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors',
  'focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset',
  selected
    ? 'border-primary bg-primary/10'
    : 'border-border hover:border-muted-foreground/60 hover:bg-muted/40',
);

const buildTraitWorkspace = (traits: Trait[], groups: TraitGroup[]): TraitWorkspace => {
  const directTraits = (groupId: string | null) => authoredOrder(
    traits.filter((trait) => (trait.groupId ?? null) === groupId),
  );
  const children = (parentId: string | null) => authoredOrder(
    groups.filter((group) => (group.parentId ?? null) === parentId),
  );
  const hasTraits = (groupId: string): boolean =>
    directTraits(groupId).length > 0 || children(groupId).some((group) => hasTraits(group.id));

  const categories: TraitCategory[] = [];
  const navigationGroups: NavigationGroup[] = [];
  const general = directTraits(null);
  if (general.length > 0) {
    categories.push({ kind: 'traits', id: null, name: 'General', path: [], depth: 0, traits: general });
  }

  const walk = (parentId: string | null, path: TraitGroup[], depth: number) => {
    for (const group of children(parentId).filter((candidate) => hasTraits(candidate.id))) {
      const nextPath = [...path, group];
      const ownTraits = directTraits(group.id);
      const categoryIndex = ownTraits.length > 0 ? categories.length : -1;
      if (ownTraits.length > 0) {
        categories.push({ kind: 'traits', id: group.id, name: group.name, group, path: nextPath, depth, traits: ownTraits });
      }
      navigationGroups.push({ group, depth, categoryIndex });
      walk(group.id, nextPath, depth + 1);
    }
  };
  walk(null, [], 0);
  return { categories, navigationGroups };
};

export default function EnterWorldWorkspace(props: EnterWorldWorkspaceProps) {
  const isMobile = useIsMobile();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileNavigationButton = useRef<HTMLButtonElement>(null);
  const traitWorkspace = useMemo(
    () => buildTraitWorkspace(props.traits, props.traitGroups),
    [props.traits, props.traitGroups],
  );
  const categories = useMemo(
    () => [
      ...traitWorkspace.categories,
      ...(props.locations.length > 1
        ? [{ kind: 'location' as const, id: 'location', name: 'Starting Location' }]
        : []),
      ...((props.libraryEntities.length > 0 || props.dictionaryItems.length > 0)
        ? [{ kind: 'library' as const, id: 'library', name: 'Library Additions' }]
        : []),
    ],
    [props.dictionaryItems.length, props.libraryEntities.length, props.locations.length, traitWorkspace],
  );
  const currentIndex = Math.min(props.categoryIndex, Math.max(categories.length - 1, 0));
  const current = categories[currentIndex];
  const visibleGroups = traitWorkspace.navigationGroups;
  const statById = useMemo(() => new Map(props.stats.map((stat) => [stat.id, stat])), [props.stats]);
  const dialogDescription = 'Configure this playthrough before entering the world.';

  const categoryButton = (category: (typeof categories)[number], index: number, depth = 0) => {
    const selected = category.kind === 'traits'
      ? category.traits.filter((trait) => props.selectedTraits.includes(trait.id)).length
      : 0;
    return (
      <button
        type="button"
        aria-current={index === currentIndex ? 'page' : undefined}
        className={cn(
          'flex min-h-11 w-full min-w-0 items-center gap-2 rounded px-2 py-1 text-left text-label md:min-h-8',
          index === currentIndex
            ? 'bg-muted font-semibold text-foreground'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )}
        style={{ paddingLeft: 8 + Math.min(depth, 5) * 12 }}
        onClick={() => {
          props.onCategoryChange(index);
          if (!isMobile) return;
          setMobileNavigationOpen(false);
          mobileNavigationButton.current?.focus();
        }}
      >
        <span className="min-w-0 flex-1 break-words">{category.name}</span>
        {category.kind === 'traits' && (
          <span
            aria-label={`${selected} of ${category.traits.length} selected`}
            className={cn('shrink-0 text-meta font-normal', selected ? 'text-primary' : 'text-muted-foreground')}
          >
            {selected}/{category.traits.length}
          </span>
        )}
      </button>
    );
  };
  const generalIndex = categories.findIndex((category) => category.kind === 'traits' && category.id === null);
  const locationIndex = categories.findIndex((category) => category.kind === 'location');
  const libraryIndex = categories.findIndex((category) => category.kind === 'library');
  const navigation = (
    <nav
      aria-label="World setup categories"
      className={cn(
        'space-y-1 overflow-y-auto p-3',
        isMobile
          ? 'max-h-[45dvh] overscroll-contain border-t border-border/60'
          : 'h-full',
      )}
    >
      {props.traits.length > 0 && (
        <p className="my-3 flex items-center gap-3 px-2 text-meta font-medium uppercase text-muted-foreground">
          <span>Starting Traits</span><span className="h-px flex-1 bg-border" />
        </p>
      )}
      {generalIndex >= 0 && categoryButton(categories[generalIndex], generalIndex)}
      {visibleGroups.map(({ group, depth, categoryIndex }) => (
        <div key={group.id}>
          {categoryIndex >= 0 ? categoryButton(categories[categoryIndex], categoryIndex, depth) : (
            <div
              aria-describedby={group.playerDescription?.trim() ? `setup-group-${group.id}-description` : undefined}
              className="min-h-8 break-words px-2 py-1 text-label text-muted-foreground"
              style={{ paddingLeft: 8 + Math.min(depth, 5) * 12 }}
            >
              {group.name}
              {group.playerDescription?.trim() && (
                <span id={`setup-group-${group.id}-description`} className="sr-only">
                  {props.resolveText(group.playerDescription)}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
      {locationIndex >= 0 && (
        <>
          <p className="my-3 flex items-center gap-3 px-2 text-meta font-medium uppercase text-muted-foreground">
            <span>World</span><span className="h-px flex-1 bg-border" />
          </p>
          {categoryButton(categories[locationIndex], locationIndex)}
        </>
      )}
      {libraryIndex >= 0 && categoryButton(categories[libraryIndex], libraryIndex)}
    </nav>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onCancel(); }}>
      <DialogContent
        hideClose
        unanimated
        className="fixed inset-x-0 left-0 top-[var(--app-top,0px)] flex h-[var(--app-h,100dvh)] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 pt-[env(safe-area-inset-top)] sm:inset-x-6 sm:top-6 sm:mx-auto sm:h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-[1600px] sm:rounded-xl sm:border sm:pt-0 [@media(max-height:500px)]:inset-0 [@media(max-height:500px)]:m-0 [@media(max-height:500px)]:h-[var(--app-h,100dvh)] [@media(max-height:500px)]:w-full [@media(max-height:500px)]:rounded-none"
      >
      <DialogTitle className="sr-only">Enter {props.worldName}</DialogTitle>
      <DialogDescription className="sr-only">{dialogDescription}</DialogDescription>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 sm:px-6">
        <h1 className="min-w-0 truncate text-label font-semibold sm:text-heading">{props.worldName}</h1>
        <div className="flex shrink-0 items-center gap-1">
          {props.onIntroduction && (
            <Button
              variant="ghost"
              className="min-h-11 gap-2 px-3"
              aria-label="Read Introduction"
              onClick={props.onIntroduction}
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Introduction</span>
            </Button>
          )}
          <Button variant="ghost" className="min-h-11 text-muted-foreground" onClick={props.onCancel}>Cancel</Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside
          className={cn(
            'relative z-10 shrink-0 md:w-72 md:border-r xl:w-80',
            isMobile
              ? cn('border-b bg-secondary/60', mobileNavigationOpen ? 'border-muted-foreground/30' : 'border-border')
              : 'bg-background',
          )}
        >
          {isMobile && (
            <button
              ref={mobileNavigationButton}
              type="button"
              aria-expanded={mobileNavigationOpen}
              aria-controls="setup-category-tree"
              className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-label"
              onClick={() => setMobileNavigationOpen((open) => !open)}
            >
              <ListTree className="h-4 w-4 shrink-0" />
              <span className="font-medium">Categories</span>
              <span className="ml-auto min-w-0 truncate text-helper text-muted-foreground">
                {current?.name ?? 'Setup'}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
                  mobileNavigationOpen && 'rotate-180',
                )}
              />
            </button>
          )}
          <div
            id="setup-category-tree"
            aria-hidden={isMobile ? !mobileNavigationOpen : undefined}
            {...(isMobile && !mobileNavigationOpen ? { inert: '' } : {})}
            className={cn(
              isMobile && 'grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none',
              !isMobile && 'h-full min-h-0',
            )}
            style={isMobile ? { gridTemplateRows: mobileNavigationOpen ? '1fr' : '0fr' } : undefined}
          >
            <div className={cn('min-h-0', isMobile ? 'overflow-hidden' : 'h-full')}>
              {navigation}
            </div>
          </div>
        </aside>
        <main className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col p-4 md:px-6 md:py-4',
          current?.kind === 'library' ? 'overflow-hidden' : 'overflow-y-auto',
        )}>
          {current?.kind === 'traits' && (
            <>
              <p className="mb-1 text-meta font-medium tracking-wide text-muted-foreground">Starting Traits</p>
              <h2 className="mb-3 text-heading font-semibold">{current.name}</h2>
              {current.path.map((group) => group.playerDescription?.trim() && (
                <p key={group.id} className="mb-2 max-w-3xl text-helper text-muted-foreground">
                  {props.resolveText(group.playerDescription)}
                </p>
              ))}
              <fieldset className="mt-4 min-w-0">
                <legend className="sr-only">{current.name} choices</legend>
                {(() => {
                  const exclusive = current.group?.exclusive === true;
                  const selectedExclusive = current.traits.find((trait) => props.selectedTraits.includes(trait.id))?.id;
                  const rows = current.traits.map((trait) => {
                    const selected = props.selectedTraits.includes(trait.id);
                    const description = props.resolveTraitText(trait, trait.playerDescription ?? '').trim();
                    const changes = trait.statChanges
                      .map((change) => ({ change, stat: statById.get(change.statId) }))
                      .filter(({ stat }) => stat !== undefined && stat.hidden !== true);
                    return (
                      <div key={trait.id} className={choiceRowClass(selected)}>
                        {exclusive ? (
                          <RadioGroupItem
                            id={`setup-trait-${trait.id}`}
                            value={trait.id}
                            aria-label={trait.name}
                            className="mt-0.5 h-5 w-5 shrink-0"
                            onClick={(event) => {
                              if (selected) {
                                event.preventDefault();
                                props.onTraitSelect(trait.id);
                              }
                            }}
                          />
                        ) : (
                          <Checkbox
                            id={`setup-trait-${trait.id}`}
                            checked={selected}
                            aria-label={trait.name}
                            className="mt-0.5 h-5 w-5 shrink-0"
                            onCheckedChange={() => props.onTraitSelect(trait.id)}
                          />
                        )}
                        <label htmlFor={`setup-trait-${trait.id}`} className="min-w-0 flex-1 cursor-pointer">
                          <strong className="block text-label font-semibold">{trait.name}</strong>
                          {description && <span className="mt-1 block text-helper text-muted-foreground">{description}</span>}
                          {changes.length > 0 && (
                            <ul className="mt-2 list-inside list-disc text-helper text-muted-foreground">
                              {changes.map(({ change, stat }, index) => (
                                <li key={index}>
                                  {props.resolveTraitText(trait, stat!.name)}:{' '}
                                  <span className={change.value > 0 ? 'text-success' : 'text-destructive'}>
                                    {change.value > 0 ? '+' : ''}{change.value}
                                  </span>
                                  {change.type && change.type !== 'starting' ? ` (${change.type})` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </label>
                      </div>
                    );
                  });
                  return exclusive ? (
                    <RadioGroup
                      value={selectedExclusive ?? ''}
                      onValueChange={props.onTraitSelect}
                      className="grid min-w-0 gap-3 xl:grid-cols-2"
                    >
                      {rows}
                    </RadioGroup>
                  ) : (
                    <div className="grid min-w-0 gap-3 xl:grid-cols-2">{rows}</div>
                  );
                })()}
              </fieldset>
            </>
          )}
          {current?.kind === 'location' && (
            <>
              <p className="mb-1 text-meta font-medium tracking-wide text-muted-foreground">World Setup</p>
              <h2 className="mb-3 text-heading font-semibold">{current.name}</h2>
              <p className="mb-4 text-helper text-muted-foreground">Choose where your story begins.</p>
              <RadioGroup
                value={props.selectedLocationId ?? 'random'}
                onValueChange={(locationId) => props.onLocationChange(locationId === 'random' ? null : locationId)}
                className="space-y-3"
              >
                <div className={choiceRowClass(props.selectedLocationId === null)}>
                  <RadioGroupItem id="setup-location-random" value="random" aria-label="Random" className="mt-0.5 h-5 w-5 shrink-0" />
                  <label htmlFor="setup-location-random" className="min-w-0 flex-1 cursor-pointer">
                    <strong className="block text-label font-semibold">Random</strong>
                    <span className="mt-1 block text-helper text-muted-foreground">
                      Let the world choose a starting place.
                    </span>
                  </label>
                </div>
                {props.locations.map((location) => {
                  const description = location.playerDescription?.trim() || location.description?.trim();
                  return (
                    <div
                      key={location.id}
                      className={choiceRowClass(props.selectedLocationId === location.id)}
                    >
                      <RadioGroupItem
                        id={`setup-location-${location.id}`}
                        value={location.id}
                        aria-label={location.name}
                        className="mt-0.5 h-5 w-5 shrink-0"
                      />
                      <label htmlFor={`setup-location-${location.id}`} className="min-w-0 flex-1 cursor-pointer">
                        <strong className="block text-label font-semibold">{location.name}</strong>
                        {description && (
                          <span className="mt-1 block text-helper text-muted-foreground">
                            {props.resolveText(description)}
                          </span>
                        )}
                      </label>
                    </div>
                  );
                })}
              </RadioGroup>
            </>
          )}
          {current?.kind === 'library' && (
            <>
              <p className="mb-1 text-meta font-medium tracking-wide text-muted-foreground">World Setup</p>
              <h2 className="mb-4 text-heading font-semibold">Library Additions</h2>
              {props.onSaveAdditions && (
                <Button
                  type="button"
                  variant="outline"
                  className="mb-4 h-auto min-h-11 max-w-full whitespace-normal text-left"
                  onClick={props.onSaveAdditions}
                  disabled={props.resolving}
                >
                  Use these additions for future games
                </Button>
              )}
              <EnterWorldLibrary
                entities={props.libraryEntities}
                selectedEntityIds={props.selectedEntityIds}
                dictionaryItems={props.dictionaryItems}
                onEntityToggle={props.onEntityToggle}
                onDictionaryItemsChange={props.onDictionaryItemsChange}
              />
            </>
          )}
        </main>
      </div>
      <footer className="shrink-0 border-t bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-3">
        <div className="flex justify-end">
          <Button className="min-h-12 w-full sm:w-auto" disabled={props.resolving} onClick={props.onContinue}>
            {props.resolving ? 'Loading…' : props.continueLabel}
          </Button>
        </div>
      </footer>
      </DialogContent>
    </Dialog>
  );
}
