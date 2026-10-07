import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  ELEMENT_ICONS,
  AvatarIcon,
  BlueprintIcon,
  DictionaryIcon,
  EntitiesIcon,
  EntityIcon,
  GroupIcon,
  LocationIcon,
  OpeningIcon,
  PersonaIcon,
  PlaceholderIcon,
  StatIcon,
  TraitIcon,
  WorldIcon,
} from './elementIcons';
import { KIND_ICONS, KIND_TAB_ICONS } from './catalogKinds';
import { WORLD_EDITOR_TABS } from '@/views/worldEditorTabs';
import { ENTITY_EDITOR_TABS, ENTITY_PANEL_TABS } from '@/views/entityPanelTabs';
import { STAT_PANEL_TABS } from '@/views/statPanelTabs';
import { TRAIT_PANEL_TABS } from '@/views/traitPanelTabs';

const SRC = resolve(__dirname, '..');

/** Every icon the map owns, by lucide name. A file outside the map imports one of these only for a meaning that is not an element type. */
const MAPPED = new Set<string>(Object.values(ELEMENT_ICONS).map((icon) => icon.displayName ?? ''));

/** Direct imports of a mapped icon that mean something else. A new element-type call site reads the map instead. */
const OTHER_MEANINGS: Record<string, { icons: string[]; meaning: string }> = {
  'components/community/ProfileStats.tsx': { icons: ['Users'], meaning: 'follower count' },
  'components/community/RemoteWorldDetailsModal.tsx': { icons: ['Play'], meaning: 'use-preset action' },
  'components/editor/IssuesInstrument.tsx': { icons: ['Play'], meaning: 'run-check action' },
  'components/formaquestion/FormaquestionMascotTab.tsx': { icons: ['Play'], meaning: 'preview action' },
  'components/formaquestion/GuideBody.tsx': { icons: ['BookOpen'], meaning: 'Guide tab' },
  'components/formaquestion/MinimalChat.tsx': { icons: ['PersonStanding'], meaning: 'full-body view toggle' },
  'components/game/AudioPlayer.tsx': { icons: ['Play'], meaning: 'playback' },
  'components/game/TtsPlaybackBar.tsx': { icons: ['Play'], meaning: 'playback' },
  'components/menu/SentMessageList.tsx': { icons: ['Users'], meaning: 'message audience' },
  'components/modals/LoadGameDialog.tsx': { icons: ['Folder'], meaning: 'save folder' },
  'components/modals/ToolTryIt.tsx': { icons: ['Play'], meaning: 'run action' },
  'components/modals/toolsView.ts': { icons: ['Braces'], meaning: 'Parameters tab' },
  'components/prompt/CodeArea.tsx': { icons: ['Braces'], meaning: 'slot snippet menu' },
  'views/DesignSystemShowcase.tsx': { icons: ['BookOpen'], meaning: 'guide link' },
  'views/MainMenu.tsx': { icons: ['BookOpen', 'User'], meaning: 'View Prompts action, account button' },
};

/** Icons an element type used to wear that no surface may import again. */
const RETIRED = new Set(['SquareUser', 'Gauge', 'Activity']);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
  });

/** The names a file imports from `lucide-react`, original spelling, across multi-line imports. */
function lucideImports(source: string): string[] {
  const names: string[] = [];
  for (const m of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
      if (name) names.push(name);
    }
  }
  return names;
}

/** Each file's direct imports of a mapped icon, keyed by path under `src/`. The map module itself is exempt. */
function directMappedImports(): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const file of sourceFiles(SRC)) {
    const path = relative(SRC, file).replace(/\\/g, '/');
    if (path === 'lib/elementIcons.ts' || path.startsWith('components/ui/')) continue;
    const hits = lucideImports(readFileSync(file, 'utf8')).filter((n) => MAPPED.has(n));
    if (hits.length > 0) found[path] = [...new Set(hits)].sort();
  }
  return found;
}

describe('element icon map', () => {
  it('gives each element type its own icon', () => {
    const icons = Object.values(ELEMENT_ICONS);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('feeds the library and community kind icons', () => {
    expect(KIND_ICONS.world).toBe(ELEMENT_ICONS.world);
    expect(KIND_ICONS.entity).toBe(ELEMENT_ICONS.entity);
    expect(KIND_ICONS.dictionary).toBe(ELEMENT_ICONS.dictionary);
    expect(KIND_ICONS.model).toBe(ELEMENT_ICONS.avatar);
  });

  it('gives tabs that list many entities the plural icon', () => {
    expect(KIND_TAB_ICONS.entity).toBe(ELEMENT_ICONS.entities);
    expect(KIND_TAB_ICONS.world).toBe(KIND_ICONS.world);
  });

  it('feeds the World Editor tabs', () => {
    const iconOf = (value: string) => WORLD_EDITOR_TABS.find((t) => t.value === value)?.icon;
    expect(iconOf('overview')).toBe(WorldIcon);
    expect(iconOf('stats')).toBe(StatIcon);
    expect(iconOf('entities')).toBe(EntitiesIcon);
    expect(iconOf('locations')).toBe(LocationIcon);
    expect(iconOf('traits')).toBe(TraitIcon);
    expect(iconOf('dictionary')).toBe(DictionaryIcon);
    expect(iconOf('placeholders')).toBe(PlaceholderIcon);
  });

  it('feeds the editor panel tabs that name an element type', () => {
    const iconIn = (tabs: readonly { value: string; icon: unknown }[], value: string) => tabs.find((t) => t.value === value)?.icon;
    expect(iconIn(ENTITY_EDITOR_TABS, 'entity')).toBe(EntityIcon);
    expect(iconIn(ENTITY_PANEL_TABS, 'traits')).toBe(TraitIcon);
    expect(iconIn(ENTITY_PANEL_TABS, 'openings')).toBe(OpeningIcon);
    expect(iconIn(STAT_PANEL_TABS, 'details')).toBe(StatIcon);
    expect(iconIn(TRAIT_PANEL_TABS, 'stats')).toBe(StatIcon);
    // A facet tab never wears an element type's icon.
    expect(Object.values(ELEMENT_ICONS)).not.toContain(iconIn(TRAIT_PANEL_TABS, 'availability'));
  });

  it('names every icon the scan guards', () => {
    expect(MAPPED.has('')).toBe(false);
    expect(MAPPED.size).toBe(Object.keys(ELEMENT_ICONS).length);
  });

  it('exports every component alias for its map entry', () => {
    expect([
      TraitIcon, EntityIcon, EntitiesIcon, LocationIcon, StatIcon, DictionaryIcon, PlaceholderIcon,
      BlueprintIcon, PersonaIcon, AvatarIcon, OpeningIcon, WorldIcon, GroupIcon,
    ]).toEqual(Object.values(ELEMENT_ICONS));
  });

  it('keeps the retired element icons out of every surface', () => {
    const used = sourceFiles(SRC).filter((file) => lucideImports(readFileSync(file, 'utf8')).some((n) => RETIRED.has(n)));
    expect(used.map((file) => relative(SRC, file).replace(/\\/g, '/'))).toEqual([]);
  });

  it('keeps every call site on the map, apart from the ledger of other meanings', () => {
    const expected = Object.fromEntries(Object.entries(OTHER_MEANINGS).map(([path, { icons }]) => [path, [...icons].sort()]));
    expect(directMappedImports()).toEqual(expected);
  });
});
