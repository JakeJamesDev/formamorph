import { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { DictionarySelectionItem } from '@/lib/dictionarySelection';
import type { EntityMetadata, GameLocation, Stat, Trait, TraitGroup } from '@/types';
import { cn } from '@/lib/utils';
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
  onIntroduction?: () => void;
  onCancel: () => void;
  onContinue: () => void;
  continueLabel: string;
  resolving?: boolean;
}

const authoredOrder = <T extends { order?: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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
          'flex min-h-8 w-full min-w-0 items-center gap-2 rounded px-2 py-1 text-left text-label',
          index === currentIndex
            ? 'bg-muted font-semibold text-foreground'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )}
        style={{ paddingLeft: 8 + Math.min(depth, 5) * 12 }}
        onClick={() => props.onCategoryChange(index)}
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
            <Button variant="ghost" className="min-h-11 gap-2 px-3" onClick={props.onIntroduction}>
              <BookOpen className="h-4 w-4" /> Introduction
            </Button>
          )}
          <Button variant="ghost" className="min-h-11 text-muted-foreground" onClick={props.onCancel}>Cancel</Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="World setup categories"
          className="max-h-[36dvh] shrink-0 space-y-1 overflow-y-auto border-b bg-secondary/60 p-3 md:max-h-none md:w-72 md:border-b-0 md:border-r md:bg-background xl:w-80"
        >
          {props.traits.length > 0 && (
            <p className="my-3 flex items-center gap-3 px-2 text-meta font-medium uppercase text-muted-foreground">
              <span>Starting traits</span><span className="h-px flex-1 bg-border" />
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
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:px-6 md:py-4">
          {current?.kind === 'traits' && (
            <>
              <p className="mb-1 text-meta uppercase tracking-wide text-muted-foreground">Starting traits</p>
              <h2 className="mb-3 text-heading font-semibold">{current.name}</h2>
              {current.path.map((group) => group.playerDescription?.trim() && (
                <p key={group.id} className="mb-2 max-w-3xl text-helper text-muted-foreground">
                  {props.resolveText(group.playerDescription)}
                </p>
              ))}
              <fieldset className="mt-4 grid min-w-0 gap-3 xl:grid-cols-2">
                <legend className="sr-only">{current.name} choices</legend>
                {current.traits.map((trait) => {
                  const selected = props.selectedTraits.includes(trait.id);
                  const exclusive = current.group?.exclusive === true;
                  const description = props.resolveTraitText(trait, trait.playerDescription ?? '').trim();
                  const changes = trait.statChanges
                    .map((change) => ({ change, stat: statById.get(change.statId) }))
                    .filter(({ stat }) => stat !== undefined && stat.hidden !== true);
                  return (
                    <label
                      key={trait.id}
                      className={cn(
                        'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        selected ? 'border-primary bg-primary/10' : 'bg-background hover:bg-muted/40',
                      )}
                    >
                      <input
                        className="mt-1 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]"
                        type={exclusive ? 'radio' : 'checkbox'}
                        name={exclusive ? `trait-group-${current.id}` : undefined}
                        aria-label={trait.name}
                        checked={selected}
                        onClick={() => {
                          if (!exclusive || !selected) return;
                          props.onTraitSelect(trait.id);
                        }}
                        onChange={() => {
                          if (!exclusive || !selected) props.onTraitSelect(trait.id);
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block">{trait.name}</strong>
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
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </>
          )}
          {current?.kind === 'location' && (
            <>
              <p className="mb-1 text-meta uppercase tracking-wide text-muted-foreground">World setup</p>
              <h2 className="mb-3 text-heading font-semibold">{current.name}</h2>
              <p className="mb-4 text-helper text-muted-foreground">Choose where your story begins.</p>
              <div className="space-y-3">
                <label
                  className={cn(
                    'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    props.selectedLocationId === null
                      ? 'border-primary bg-primary/10'
                      : 'bg-background hover:bg-muted/40',
                  )}
                >
                  <input
                    className="mt-1 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]"
                    type="radio"
                    name="starting-location"
                    aria-label="Random"
                    checked={props.selectedLocationId === null}
                    onChange={() => props.onLocationChange(null)}
                  />
                  <span className="min-w-0">
                    <strong className="block">Random</strong>
                    <span className="mt-1 block text-helper text-muted-foreground">
                      Let the world choose a starting place.
                    </span>
                  </span>
                </label>
                {props.locations.map((location) => {
                  const description = location.playerDescription?.trim() || location.description?.trim();
                  return (
                    <label
                      key={location.id}
                      className={cn(
                        'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        props.selectedLocationId === location.id
                          ? 'border-primary bg-primary/10'
                          : 'bg-background hover:bg-muted/40',
                      )}
                    >
                      <input
                        className="mt-1 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]"
                        type="radio"
                        name="starting-location"
                        aria-label={location.name}
                        checked={props.selectedLocationId === location.id}
                        onChange={() => props.onLocationChange(location.id)}
                      />
                      <span className="min-w-0">
                        <strong className="block">{location.name}</strong>
                        {description && (
                          <span className="mt-1 block text-helper text-muted-foreground">
                            {props.resolveText(description)}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          {current?.kind === 'library' && (
            <>
              <p className="mb-1 text-meta uppercase tracking-wide text-muted-foreground">World setup</p>
              <h2 className="mb-4 text-heading font-semibold">Library Additions</h2>
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
