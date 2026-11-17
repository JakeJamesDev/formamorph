import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { DictionaryIcon, EntityIcon } from '@/lib/elementIcons';
import { Button } from '@/components/ui/button';
import { NavDisclosure } from '@/components/NavDisclosure';
import { SetupTraitList, TraitCascadeNotice, type TraitCascade } from '@/components/game/SetupTraitList';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { groupPickState, type GateStates } from '@/lib/traitGates';
import type { OwnerId, Scoped } from '@/lib/scope';
import { choiceRowClass } from '@/components/game/setupChoiceRow';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, dialogCenteredAnimation } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import type { DictionarySelectionItem } from '@/lib/dictionarySelection';
import type { Entity, GameLocation, PersonaRef, PresetWorldOption, Stat, StatGroup, Trait, TraitGroup, WorldOption, WorldOptionValueOf, WorldOptionValues } from '@/types';
import { SetupWorldOptions } from '@/components/game/SetupWorldOptions';
import { shownOptions } from '@/lib/worldOptions';
import { resolvedEntityStats } from '@/lib/statLinks';
import { PersonaPicker, PersonaPortrait, type PersonaOption } from '@/components/game/PersonaPicker';
import { primaryImage } from '@/lib/entityImages';
import type { ResolveEntityText } from '@/lib/resolveWorldNames';
import { ownerTraitTree, playerEntityIds } from '@/lib/ownedTraitsInPlay';
import { hasPersonaChoice } from '@/lib/personaPick';
import { stripMarkdown } from '@/lib/stripMarkdown';
import { navItemStates } from '@/lib/navSelection';
import { useElementSize } from '@/lib/useElementSize';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useIsMobile';
import {
  buildTraitWorkspace, collapsedAtCut, fitCutDepth, subtreeRollup,
  type SubtreeRollup, type TraitCategory, type TraitNavNode,
} from '@/lib/setupTraitWorkspace';
import { isShown } from '@/lib/traitEffects';
import { YouMark } from '@/components/game/YouMark';
import { Hint, Meta } from '@/components/ui/typography';
import EnterWorldLibrary, { type EntityAddition } from './EnterWorldLibrary';
import { useMediaList } from '@/lib/useMediaList';

export interface EnterWorldWorkspaceProps {
  /** False plays the exit animation; the host keeps the workspace mounted until it finishes. */
  open?: boolean;
  worldName: string;
  /** Who wrote the world, for the provenance line on its own dictionaries. */
  worldAuthor?: string;
  traits: Trait[];
  /** The world's Options. Only those Shown to Player appear; none hides the category. */
  options?: readonly WorldOption[];
  optionValues?: WorldOptionValues;
  onOptionChange?: (optionId: string, value: WorldOptionValueOf) => void;
  /** The value of a Preset the setup matches, or null. */
  presetMatch?: (preset: PresetWorldOption) => string | null;
  onPreset?: (preset: PresetWorldOption, valueId: string) => void;
  traitGroups: TraitGroup[];
  /** The world's entities; each that has traits gets a page in the tree. */
  traitEntities?: readonly Entity[];
  /** The library persona and the added library entities, in the order added. */
  traitLibrary?: readonly Entity[];
  resolveEntityText?: ResolveEntityText;
  stats: Stat[];
  /** The world's stat groups, which hold the blueprints entity stats link to. */
  statGroups?: StatGroup[];
  locations: GameLocation[];
  resolveText: (text: string) => string;
  /** A trait's own text, bound for its owner, which is the Entity Name in it. */
  resolveTraitText: (trait: Trait, text: string, owner?: Entity | null) => string;
  /** The global picks, and each entity's by its id. */
  selectedTraits: Scoped<readonly string[]>;
  selectedLocationId: string | null;
  libraryEntities: EntityAddition[];
  selectedEntityIds: Set<string>;
  dictionaryItems: DictionarySelectionItem[];
  /** The world's own personas on offer. */
  worldPersonas?: PersonaOption[];
  /** The library personas on offer. The category hides when neither list has one. */
  personas?: PersonaOption[];
  /** The picker offers None. Absent = yes. */
  personaNone?: boolean;
  /** The Custom Persona entity, which replaces None. */
  personaCustom?: PersonaOption;
  persona?: PersonaRef;
  onPersonaChange?: (ref: PersonaRef) => void;
  categoryIndex: number;
  onCategoryChange: (index: number) => void;
  onTraitSelect: (traitId: string, ownerId: OwnerId) => void;
  traitGates?: GateStates;
  /** Whether an owner's Avatar will be in use, which shows the Avatar icon on the traits that change it. */
  avatarInUse?: (ownerId: OwnerId) => boolean;
  /** What the last selection change turned off; shown until dismissed or the next change. */
  traitCascade?: TraitCascade | null;
  onDismissTraitCascade?: () => void;
  onLocationChange: (locationId: string | null) => void;
  onEntityToggle: (entityId: string, selected: boolean) => void;
  onDictionaryItemsChange: (items: DictionarySelectionItem[]) => void;
  /** Persists the current additions as this world's defaults; returns whether the save succeeded. */
  onSaveAdditions?: () => boolean;
  onIntroduction?: () => void;
  onCancel: () => void;
  onContinue: () => void;
  continueLabel: string;
  resolving?: boolean;
}

const REMEMBERED_MS = 3000;

/** Auto folds by a fitted cut depth until the player's first toggle; manual keeps the player's set. */
type NavFold =
  | { mode: 'auto'; cut: number; held: ReadonlySet<string> }
  | { mode: 'manual'; folded: ReadonlySet<string> };

const navIconButton = 'flex shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

export default function EnterWorldWorkspace(props: EnterWorldWorkspaceProps) {
  const viewportMobile = useIsMobile();
  const media = useMediaList();
  const [containerRef, containerSize] = useElementSize();
  const categoriesCollapsed = containerSize.width > 0 ? containerSize.width < 72 * 16 : viewportMobile;
  const [categoryNavigationOpen, setCategoryNavigationOpen] = useState(false);
  // The remembered state shows for a few seconds or until the additions change, then the button re-arms.
  const [additionsRemembered, setAdditionsRemembered] = useState(false);
  useEffect(() => {
    if (!additionsRemembered) return;
    const timer = setTimeout(() => setAdditionsRemembered(false), REMEMBERED_MS);
    return () => clearTimeout(timer);
  }, [additionsRemembered]);
  const categoryNavigationButton = useRef<HTMLButtonElement>(null);
  const traitTree = useMemo(
    () => ownerTraitTree(
      { traits: props.traits, traitGroups: props.traitGroups, entities: props.traitEntities ?? [] },
      props.persona, props.traitLibrary ?? [],
    ),
    [props.traits, props.traitGroups, props.traitEntities, props.persona, props.traitLibrary],
  );
  const picksOf = (ownerId: string | undefined) =>
    (ownerId === undefined ? props.selectedTraits.global : props.selectedTraits.owners[ownerId] ?? []);
  // Every category, seen or not, for the Begin check.
  const allCategories = useMemo(
    () => buildTraitWorkspace(traitTree.traits, traitTree.groups, new Set(traitTree.entityNodes.keys())).categories,
    [traitTree],
  );
  // A category with no row the player sees drops out, so the page index can move as picks change (Q33).
  const traitWorkspace = useMemo(
    () => buildTraitWorkspace(
      traitTree.traits, traitTree.groups, new Set(traitTree.entityNodes.keys()),
      (trait, entityId) => isShown(trait, picksOf(entityId ?? undefined)),
    ),
    [traitTree, props.selectedTraits],
  );
  const playerIds = playerEntityIds(traitTree);
  const ownStatsOf = (entityId: string) => {
    const entity = traitTree.entityNodes.get(entityId);
    return entity ? resolvedEntityStats({ stats: props.stats, statGroups: props.statGroups ?? [] }, entity) : undefined;
  };
  // One entity, one role: the persona leaves the character list, and an added character leaves the picker.
  const personaId = props.persona?.source === 'library' ? props.persona.entityId : null;
  const personaOptions = useMemo(
    () => (props.personas ?? []).filter((option) => option.id === personaId || !props.selectedEntityIds.has(option.id)),
    [personaId, props.personas, props.selectedEntityIds],
  );
  const characterOptions = useMemo(
    () => (personaId ? props.libraryEntities.filter((entity) => entity.id !== personaId) : props.libraryEntities),
    [personaId, props.libraryEntities],
  );
  const setupOptions = useMemo(() => shownOptions(props.options), [props.options]);
  const hasOptions = setupOptions.length > 0;
  const hasPersonas = hasPersonaChoice({
    world: props.worldPersonas ?? [], library: props.personas ?? [], none: props.personaNone !== false, custom: props.personaCustom,
  });
  const categories = useMemo(
    () => [
      ...(hasOptions ? [{ kind: 'options' as const, id: 'options', name: 'World Options' }] : []),
      ...(hasPersonas ? [{ kind: 'persona' as const, id: 'persona', name: 'Persona' }] : []),
      ...traitWorkspace.categories,
      ...(props.locations.length > 1
        ? [{ kind: 'location' as const, id: 'location', name: 'Starting Location' }]
        : []),
      ...((props.libraryEntities.length > 0 || props.dictionaryItems.length > 0)
        ? [{ kind: 'library' as const, id: 'library', name: 'Library Additions' }]
        : []),
    ],
    [hasOptions, hasPersonas, props.dictionaryItems.length, props.libraryEntities.length, props.locations.length, traitWorkspace],
  );
  const pickStateOf = (category: TraitCategory) =>
    (category.group ? groupPickState(category.group, category.traits, picksOf(category.entityId)) : null);
  // Begin waits for every owner's groups to meet their minimums; Quick Start never comes through here.
  const short = allCategories.some((category) => !!pickStateOf(category)?.short);
  const currentIndex = Math.min(props.categoryIndex, Math.max(categories.length - 1, 0));
  const current = categories[currentIndex];
  const dialogDescription = 'Choose how this game starts';
  // Trait group indices count from the first trait category.
  const traitOffset = Math.max(categories.findIndex((category) => category.kind === 'traits'), 0);
  const navNodes = traitWorkspace.navigationNodes;
  const nodeById = useMemo(() => new Map(navNodes.map((node) => [node.group.id, node])), [navNodes]);
  // The clicked page holds while the category index stays in its subtree; otherwise the index's own node is the page.
  const [clickedPageId, setClickedPageId] = useState<string | null>(null);
  const traitIndex = current?.kind === 'traits' ? currentIndex - traitOffset : -1;
  const clickedPage = clickedPageId ? nodeById.get(clickedPageId) : undefined;
  // Once the index leaves the clicked subtree, the hold ends, so a later return lands on the index's own node (Q21).
  if (clickedPage && !clickedPage.subtree.includes(traitIndex)) setClickedPageId(null);
  const page = traitIndex < 0 ? undefined
    : clickedPage?.subtree.includes(traitIndex) ? clickedPage
    : navNodes.find((node) => node.categoryIndex === traitIndex);
  const rollupOf = (subtree: readonly number[]) => subtreeRollup(traitWorkspace.categories, subtree, picksOf);

  // Fold state lasts for this setup only: the host unmounts the workspace once it closes (Q6).
  const [fold, setFold] = useState<NavFold>({ mode: 'auto', cut: Infinity, held: new Set() });
  // While true, the nav renders fully expanded so the layout effect can measure every row once.
  const [measuring, setMeasuring] = useState(true);
  // State, not a ref: the dialog mounts the nav after this component's first commit, and the fit waits for it.
  const [navElement, setNavElement] = useState<HTMLElement | null>(null);
  const navRootRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const isFolded = (node: TraitNavNode) => node.hasChildren && !measuring && (fold.mode === 'manual'
    ? fold.folded.has(node.group.id)
    : collapsedAtCut({ id: node.group.id, depth: node.depth, hasChildren: true }, fold.cut, fold.held));
  const foldedIds = new Set(navNodes.filter(isFolded).map((node) => node.group.id));
  const isHidden = (node: TraitNavNode) => node.ancestorIds.some((id) => foldedIds.has(id));
  // A page under a folded row lends its highlight to the outermost folded ancestor (Q15).
  const foldedAncestorId = page?.ancestorIds.find((id) => foldedIds.has(id));
  const highlighted = foldedAncestorId ? nodeById.get(foldedAncestorId) : page;
  const manual = fold.mode === 'manual';
  // Until the first toggle, a window resize or a switch between sidebar and drawer fits again (Q4).
  useEffect(() => {
    if (manual) return;
    const refit = () => setMeasuring(true);
    window.addEventListener('resize', refit);
    return () => window.removeEventListener('resize', refit);
  }, [manual]);
  useLayoutEffect(() => {
    if (!manual) setMeasuring(true);
  }, [manual, categoriesCollapsed]);
  useLayoutEffect(() => {
    if (!measuring || !navElement) return;
    const rows = navNodes.map((node) => {
      const element = rowRefs.current.get(node.group.id);
      const height = element ? element.offsetHeight + (parseFloat(getComputedStyle(element).marginTop) || 0) : 0;
      return { id: node.group.id, depth: node.depth, hasChildren: node.hasChildren, ancestorIds: node.ancestorIds, height };
    });
    const fixedHeight = navElement.offsetHeight - rows.reduce((sum, row) => sum + row.height, 0);
    // The drawer's cap is its own max-height (45% of the window); the sidebar's is its height.
    const root = navRootRef.current;
    const drawer = root && categoriesCollapsed ? getComputedStyle(root) : null;
    const available = !root ? 0
      : drawer ? (parseFloat(drawer.maxHeight) || 0) - (parseFloat(drawer.borderTopWidth) || 0) - (parseFloat(drawer.borderBottomWidth) || 0)
      : root.clientHeight;
    // The current page's ancestors are held open as of this fit (Q5, Q24).
    const held = new Set(page?.ancestorIds ?? []);
    setFold((prev) => (prev.mode === 'manual' ? prev : { mode: 'auto', cut: fitCutDepth(rows, fixedHeight, available, held), held }));
    setMeasuring(false);
  }, [measuring, navElement]); // eslint-disable-line react-hooks/exhaustive-deps -- measures once per request, against that render
  // A later page change opens what the new page needs and never folds a row back (Q24).
  useLayoutEffect(() => {
    if (fold.mode !== 'auto' || !page) return;
    const missing = page.ancestorIds.filter((id) => !fold.held.has(id));
    if (missing.length > 0) setFold({ ...fold, held: new Set([...fold.held, ...missing]) });
  }, [page, fold]);
  const toggleFold = (node: TraitNavNode) => {
    const folded = new Set(foldedIds);
    if (!folded.delete(node.group.id)) folded.add(node.group.id);
    setFold({ mode: 'manual', folded });
  };
  const parents = navNodes.filter((node) => node.hasChildren);
  // Only a parent the player can see counts, so Collapse All never makes a dead click (Q13).
  const anyExpanded = parents.some((node) => !foldedIds.has(node.group.id) && !isHidden(node));
  const toggleAll = () => setFold({ mode: 'manual', folded: new Set(anyExpanded ? parents.map((node) => node.group.id) : []) });

  const closeNavigation = () => {
    if (!categoriesCollapsed) return;
    setCategoryNavigationOpen(false);
    categoryNavigationButton.current?.focus();
  };
  const rowClass = (isCurrent: boolean) => cn(
    'flex min-h-11 w-full min-w-0 items-center gap-2 rounded px-2 py-1 text-left text-label md:min-h-8',
    navItemStates(isCurrent),
  );
  const rowCount = ({ shown, selected, short: isShort }: SubtreeRollup, isCurrent: boolean) => (
    <>
      {isShort && <span role="img" aria-label="Needs more picks" className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />}
      {shown > 0 && (
        <span
          aria-label={`${selected} of ${shown} selected`}
          className={cn(
            'shrink-0 text-meta font-normal',
            isCurrent ? 'text-primary-foreground' : selected ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {selected}/{shown}
        </span>
      )}
    </>
  );
  const categoryButton = (category: (typeof categories)[number], index: number) => {
    const isCurrent = index === currentIndex;
    return (
      <button
        type="button"
        aria-current={isCurrent ? 'page' : undefined}
        className={rowClass(isCurrent)}
        onClick={() => {
          props.onCategoryChange(index);
          closeNavigation();
        }}
      >
        <span className="min-w-0 flex-1 break-words">{category.name}</span>
        {category.kind === 'traits' && rowCount(rollupOf([index - traitOffset]), isCurrent)}
      </button>
    );
  };
  // Every row in the Starting Traits block keeps the chevron's width, so names align (Q17, Q25).
  const emptySlot = <span aria-hidden className="w-6 shrink-0" />;
  const chevron = (node: TraitNavNode) => {
    const folded = foldedIds.has(node.group.id);
    return (
      <button
        type="button"
        aria-expanded={!folded}
        aria-label={`${folded ? 'Expand' : 'Collapse'} ${node.group.name}`}
        className={cn(navIconButton, 'w-6 self-stretch')}
        onClick={() => toggleFold(node)}
      >
        {folded ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
    );
  };
  const navRow = (node: TraitNavNode) => {
    const isCurrent = highlighted === node;
    const own = node.categoryIndex >= 0 ? traitWorkspace.categories[node.categoryIndex] : undefined;
    // A label-only group has no traits list of its own, so its row carries its description for screen readers.
    const description = own ? undefined : node.group.playerDescription?.trim();
    const descriptionId = `setup-group-${node.group.id}-description`;
    return (
      <div
        key={node.group.id}
        ref={(element) => {
          if (element) rowRefs.current.set(node.group.id, element);
          else rowRefs.current.delete(node.group.id);
        }}
      >
        <div className="flex" style={{ paddingLeft: Math.min(node.depth, 5) * 12 }}>
          {node.hasChildren ? chevron(node) : emptySlot}
          <button
            type="button"
            // A folded ancestor carries the highlight for the page inside it, but only the page itself is current.
            aria-current={page === node ? 'page' : undefined}
            aria-describedby={description ? descriptionId : undefined}
            className={rowClass(isCurrent)}
            onClick={() => {
              setClickedPageId(node.group.id);
              if (node.subtree.length > 0) props.onCategoryChange(node.subtree[0] + traitOffset);
              closeNavigation();
            }}
          >
            {own?.entityNode && <EntityIcon aria-hidden className="h-4 w-4 shrink-0" />}
            <span className="min-w-0 flex-1 break-words">
              {node.group.name}
              {/* On the selected row the pill inverts, or it would vanish into the primary fill. */}
              {own?.entityNode && !!own.entityId && playerIds.includes(own.entityId) && <YouMark onFill={isCurrent} />}
            </span>
            {rowCount(rollupOf(node.subtree), isCurrent)}
          </button>
        </div>
        {description && <span id={descriptionId} className="sr-only">{stripMarkdown(props.resolveText(description))}</span>}
      </div>
    );
  };
  // An entity's page opens on its portrait beside its name and player description.
  const entityHeading = (entityId: string) => {
    const entity = traitTree.entityNodes.get(entityId);
    if (!entity) return null;
    const description = entity.playerDescription?.trim();
    return (
      <div className="mb-3 flex items-start gap-4">
        <PersonaPortrait image={primaryImage(entity, media)} />
        <div className="min-w-0">
          <Meta as="p" className="mb-1 font-medium tracking-wide">Starting Traits</Meta>
          <h2 className="break-words text-heading font-semibold">
            {entity.name}
            {playerIds.includes(entity.id) && <YouMark />}
          </h2>
          {description && (
            <div className="mt-1 max-w-3xl text-helper text-muted-foreground">
              <MarkdownRenderer text={props.resolveEntityText ? props.resolveEntityText(entity, description) : description} />
            </div>
          )}
        </div>
      </div>
    );
  };
  // One category's traits. The page's own section reads its whole group path; a later one only its own group.
  const traitSection = (category: TraitCategory, heading: ReactNode, groups: TraitGroup[]) => (
    <SetupTraitList
      heading={heading}
      name={category.name}
      groups={groups}
      traits={category.traits}
      picks={pickStateOf(category)}
      stats={props.stats}
      selectedTraits={picksOf(category.entityId)}
      resolveText={props.resolveText}
      resolveTraitText={(trait, text) =>
        props.resolveTraitText(trait, text, category.entityId ? traitTree.entityNodes.get(category.entityId) ?? null : null)}
      onTraitSelect={props.onTraitSelect}
      ownerId={category.entityId ?? null}
      ownStats={category.entityId ? ownStatsOf(category.entityId) : undefined}
      gates={props.traitGates}
      avatarInUse={props.avatarInUse?.(category.entityId ?? null) ?? false}
    />
  );
  const ownSection = (category: TraitCategory) => (category.entityNode && category.traits.length === 0
    ? entityHeading(category.entityId!)
    : traitSection(category, category.entityNode ? entityHeading(category.entityId!) : undefined, category.path));
  // The nodes between the page and a descendant, which its separator names: Martial / Weapon Style.
  const between = (node: TraitNavNode, pageNode: TraitNavNode) => node.ancestorIds
    .slice(node.ancestorIds.indexOf(pageNode.group.id) + 1)
    .flatMap((id) => nodeById.get(id) ?? []);
  const nodeByCategory = useMemo(
    () => new Map(navNodes.filter((node) => node.categoryIndex >= 0).map((node) => [node.categoryIndex, node])),
    [navNodes],
  );
  // A label-only page reads its group path from its first descendant, which holds it.
  const labelPath = (pageNode: TraitNavNode) => {
    const path = traitWorkspace.categories[pageNode.subtree[0]]?.path ?? [];
    const at = path.findIndex((group) => group.id === pageNode.group.id);
    return at >= 0 ? path.slice(0, at + 1) : [pageNode.group];
  };
  // General has no nav node, so it falls back to its own category's page.
  const traitPage = (fallback: TraitCategory) => {
    // A label-only group has no section, so its description rides on the first section under it.
    const described = new Set<string>();
    const sectionGroups = (node: TraitNavNode, pageNode: TraitNavNode, own?: TraitGroup) => [
      ...between(node, pageNode).filter((step) => step.categoryIndex < 0 && !described.has(step.group.id)).map((step) => {
        described.add(step.group.id);
        return step.group;
      }),
      ...(own ? [own] : []),
    ];
    return (
      <>
        {!page ? ownSection(fallback) : (
          <>
            {page.categoryIndex < 0 && (
              <>
                <Meta as="p" className="mb-1 font-medium tracking-wide">Starting Traits</Meta>
                <h2 className="mb-3 break-words text-heading font-semibold">{page.group.name}</h2>
                {labelPath(page).map((group) => group.playerDescription?.trim() && (
                  <div key={group.id} className="mb-2 max-w-3xl text-helper text-muted-foreground">
                    <MarkdownRenderer text={props.resolveText(group.playerDescription)} />
                  </div>
                ))}
              </>
            )}
            {page.subtree.map((index) => {
              const section = traitWorkspace.categories[index];
              const node = nodeByCategory.get(index);
              if (!node) return null;
              if (node === page) return <section key={node.group.id}>{ownSection(section)}</section>;
              return (
                <section key={node.group.id} className="mt-8">
                  {traitSection(
                    section,
                    <Meta as="h3" className="mb-2 flex items-center gap-3 font-medium uppercase">
                      <span className="min-w-0 break-words">
                        {[...between(node, page), node].map((step) => step.group.name).join(' / ')}
                      </span>
                      <span className="h-hairline flex-1 bg-border" />
                    </Meta>,
                    sectionGroups(node, page, section.group),
                  )}
                </section>
              );
            })}
          </>
        )}
        {props.traitCascade && props.onDismissTraitCascade && (
          <TraitCascadeNotice cascade={props.traitCascade} onDismiss={props.onDismissTraitCascade} />
        )}
      </>
    );
  };
  const optionsIndex = categories.findIndex((category) => category.kind === 'options');
  const personaIndex = categories.findIndex((category) => category.kind === 'persona');
  const generalIndex = categories.findIndex((category) => category.kind === 'traits' && category.id === null);
  const locationIndex = categories.findIndex((category) => category.kind === 'location');
  const libraryIndex = categories.findIndex((category) => category.kind === 'library');
  const navigation = (
    <ScrollArea
      ref={navRootRef}
      className={cn(
        categoriesCollapsed
          ? 'max-h-[45dvh] border-t border-border/60 [&>[data-radix-scroll-area-viewport]]:overscroll-contain'
          : 'h-full min-h-0',
      )}
    >
    <nav ref={setNavElement} aria-label="World setup categories" className="space-y-1 p-3">
      {optionsIndex >= 0 && categoryButton(categories[optionsIndex], optionsIndex)}
      {personaIndex >= 0 && categoryButton(categories[personaIndex], personaIndex)}
      {traitTree.traits.length > 0 && (
        <Meta as="div" className="my-3 flex items-center gap-3 px-2 font-medium uppercase">
          <span>Starting Traits</span><span className="h-px flex-1 bg-border" />
          {parents.length > 0 && (
            <Tip tip={anyExpanded ? 'Collapse All' : 'Expand All'}>
              <button type="button" className={cn(navIconButton, 'h-6 w-6 hover:bg-accent')} onClick={toggleAll}>
                {anyExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
              </button>
            </Tip>
          )}
        </Meta>
      )}
      {generalIndex >= 0 && <div className="flex">{emptySlot}{categoryButton(categories[generalIndex], generalIndex)}</div>}
      {navNodes.filter((node) => !isHidden(node)).map(navRow)}
      {locationIndex >= 0 && (
        <>
          <Meta as="p" className="my-3 flex items-center gap-3 px-2 font-medium uppercase">
            <span>World</span><span className="h-px flex-1 bg-border" />
          </Meta>
          {categoryButton(categories[locationIndex], locationIndex)}
        </>
      )}
      {libraryIndex >= 0 && (
        <>
          <Meta as="p" className="my-3 flex items-center gap-3 px-2 font-medium uppercase">
            <span>Library</span><span className="h-px flex-1 bg-border" />
          </Meta>
          {categoryButton(categories[libraryIndex], libraryIndex)}
        </>
      )}
    </nav>
    </ScrollArea>
  );

  return (
    <Dialog open={props.open ?? true} onOpenChange={(open) => { if (!open) props.onCancel(); }}>
      <DialogContent
        surface="enterWorld"
        placement="own"
        ref={containerRef}
        data-enter-world-container="dialog"
        hideClose
        unanimated
        className={cn(
          // The stock slide assumes a transform-centered box; this one is inset-positioned, so it takes
          // the Introduction popup's fade-and-zoom without the slide.
          dialogCenteredAnimation,
          'fixed inset-x-0 left-0 top-[var(--app-top,0px)] flex h-[var(--app-h,100dvh)] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 pt-[env(safe-area-inset-top)] sm:inset-x-6 sm:top-6 sm:mx-auto sm:h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-[1600px] sm:rounded-xl sm:border sm:pt-0 [@media(max-height:500px)]:inset-0 [@media(max-height:500px)]:m-0 [@media(max-height:500px)]:h-[var(--app-h,100dvh)] [@media(max-height:500px)]:w-full [@media(max-height:500px)]:rounded-none',
        )}
      >
      <DialogTitle className="sr-only">Enter {props.worldName}</DialogTitle>
      <DialogDescription className="sr-only">{dialogDescription}</DialogDescription>
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <h1 className="min-w-0 truncate text-label font-semibold sm:text-heading">{props.worldName}</h1>
        <div className="flex shrink-0 items-center gap-1">
          {props.onIntroduction && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              aria-label="Read Introduction"
              onClick={props.onIntroduction}
            >
              <DictionaryIcon aria-hidden className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Introduction</span>
            </Button>
          )}
        </div>
      </header>
      <div className={cn('flex min-h-0 flex-1', categoriesCollapsed ? 'flex-col' : 'flex-row')}>
        <aside className={cn('relative z-10 shrink-0', !categoriesCollapsed && 'w-80 border-r bg-background')}>
          <NavDisclosure
            ref={categoryNavigationButton}
            collapsed={categoriesCollapsed}
            open={categoryNavigationOpen}
            onOpenChange={setCategoryNavigationOpen}
            label="Categories"
            current={page?.group.name ?? current?.name ?? 'Setup'}
            bodyId="setup-category-tree"
          >
            {navigation}
          </NavDisclosure>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {current?.kind !== 'library' && (
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4 md:px-6 md:py-4">
          {current?.kind === 'traits' && traitPage(current)}
          {current?.kind === 'options' && (
            <SetupWorldOptions
              options={setupOptions} values={props.optionValues ?? {}}
              onChange={(id, value) => props.onOptionChange?.(id, value)} resolveText={props.resolveText}
              presetMatch={(preset) => props.presetMatch?.(preset) ?? null} onPreset={(preset, valueId) => props.onPreset?.(preset, valueId)}
            />
          )}
          {current?.kind === 'persona' && props.persona && props.onPersonaChange && (
            <>
              <Meta as="p" className="mb-1 font-medium tracking-wide">World Setup</Meta>
              <h2 className="mb-3 text-heading font-semibold">{current.name}</h2>
              <Hint className="mb-4">Choose who you play in this world</Hint>
              <PersonaPicker
                world={props.worldPersonas}
                library={personaOptions}
                none={props.personaNone}
                custom={props.personaCustom}
                value={props.persona}
                onChange={props.onPersonaChange}
              />
              {props.traitCascade && props.onDismissTraitCascade && (
                <TraitCascadeNotice cascade={props.traitCascade} onDismiss={props.onDismissTraitCascade} />
              )}
            </>
          )}
          {current?.kind === 'location' && (
            <>
              <Meta as="p" className="mb-1 font-medium tracking-wide">World Setup</Meta>
              <h2 className="mb-3 text-heading font-semibold">{current.name}</h2>
              <Hint className="mb-4">Choose where your story starts</Hint>
              <RadioGroup
                value={props.selectedLocationId ?? 'random'}
                onValueChange={(locationId) => props.onLocationChange(locationId === 'random' ? null : locationId)}
                className="space-y-3"
              >
                <label htmlFor="setup-location-random" className={choiceRowClass(props.selectedLocationId === null)}>
                  <RadioGroupItem id="setup-location-random" value="random" aria-label="Random" className="mt-0.5 shrink-0" />
                  <span className="block min-w-0 flex-1">
                    <strong className="block text-label font-semibold">Random</strong>
                    <Hint as="span" className="mt-1 block">Starts at a random location</Hint>
                  </span>
                </label>
                {props.locations.map((location) => {
                  const description = location.playerDescription?.trim() || location.description?.trim();
                  return (
                    <label
                      key={location.id}
                      htmlFor={`setup-location-${location.id}`}
                      className={choiceRowClass(props.selectedLocationId === location.id)}
                    >
                      <RadioGroupItem
                        id={`setup-location-${location.id}`}
                        value={location.id}
                        aria-label={location.name}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="block min-w-0 flex-1">
                        <strong className="block text-label font-semibold">{location.name}</strong>
                        {description && (
                          <Hint as="span" className="mt-1 block">
                            {props.resolveText(description)}
                          </Hint>
                        )}
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            </>
          )}
              </div>
            </ScrollArea>
          )}
          {current?.kind === 'library' && (
            <div className="flex min-h-0 flex-1 flex-col p-4 md:px-6 md:py-4">
            <>
              <Meta as="p" className="mb-1 font-medium tracking-wide">World Setup</Meta>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-heading font-semibold">Library Additions</h2>
                {props.onSaveAdditions && (
                  <Tip
                    tip={additionsRemembered
                      ? 'Future games of this world start with these additions'
                      : "Save these additions as this world's defaults for future games"}
                    labelsChild={false}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={additionsRemembered ? 'Remembered' : 'Remember Additions'}
                      className={cn(
                        // One color transition serves both directions: adding the success classes fades in,
                        // removing them plays the same fade back.
                        'min-h-11 shrink-0 duration-300 motion-reduce:transition-none sm:min-h-9',
                        additionsRemembered && 'border-transparent bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground focus-visible:ring-success-foreground',
                      )}
                      onClick={() => setAdditionsRemembered(props.onSaveAdditions?.() === true)}
                      disabled={props.resolving}
                    >
                      {/* Both labels stay mounted and stacked, so the button keeps one width while they cross-fade. */}
                      <span aria-hidden className="grid">
                        <span className={cn(
                          'col-start-1 row-start-1 transition-opacity duration-300 motion-reduce:transition-none',
                          additionsRemembered && 'opacity-0',
                        )}>
                          Remember Additions
                        </span>
                        <span className={cn(
                          'col-start-1 row-start-1 flex items-center justify-center gap-2 transition-opacity duration-300 motion-reduce:transition-none',
                          !additionsRemembered && 'opacity-0',
                        )}>
                          <Check className="h-4 w-4" />
                          Remembered
                        </span>
                      </span>
                    </Button>
                  </Tip>
                )}
                <span role="status" className="sr-only">
                  {additionsRemembered ? 'This world remembers these additions.' : ''}
                </span>
              </div>
              <EnterWorldLibrary
                entities={characterOptions}
                selectedEntityIds={props.selectedEntityIds}
                dictionaryItems={props.dictionaryItems}
                worldAuthor={props.worldAuthor}
                onEntityToggle={(id, selected) => { setAdditionsRemembered(false); props.onEntityToggle(id, selected); }}
                onDictionaryItemsChange={(items) => { setAdditionsRemembered(false); props.onDictionaryItemsChange(items); }}
              />
            </>
            </div>
          )}
        </main>
      </div>
      <footer className="shrink-0 bg-background px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-2">
        <DialogFooter>
          <Button variant="ghost" className="w-full text-muted-foreground sm:w-auto" onClick={props.onCancel}>Cancel</Button>
          <Button className="w-full sm:w-auto" disabled={props.resolving || short} onClick={props.onContinue}>
            {props.resolving ? 'Loading…' : props.continueLabel}
          </Button>
        </DialogFooter>
      </footer>
      </DialogContent>
    </Dialog>
  );
}
