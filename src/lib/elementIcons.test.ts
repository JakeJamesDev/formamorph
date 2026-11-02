import { describe, it, expect } from 'vitest';
import {
  ELEMENT_ICONS,
  AvatarIcon,
  BlueprintIcon,
  DictionaryIcon,
  EntitiesIcon,
  EntityIcon,
  GroupIcon,
  ItemIcon,
  LocationIcon,
  MascotIcon,
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

  it('exports every component alias for its map entry', () => {
    expect([
      TraitIcon, EntityIcon, EntitiesIcon, ItemIcon, LocationIcon, StatIcon, DictionaryIcon, PlaceholderIcon,
      BlueprintIcon, PersonaIcon, AvatarIcon, MascotIcon, OpeningIcon, WorldIcon, GroupIcon,
    ]).toEqual(Object.values(ELEMENT_ICONS));
  });
});
