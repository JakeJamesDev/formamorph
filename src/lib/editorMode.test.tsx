import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorModeProvider } from '@/components/EditorModeProvider';
import { readEditorMode, useEditorMode } from './editorMode';
import { editorTabsFor } from '@/views/worldEditorTabs';
import { worldUsesAdvancedFeatures } from './editorAdvancedData';
import type { Dictionary, Entity, GameLocation, Placeholder, Stat, Trait, WorldOverview } from '@/types';

/** Stands in for an Advanced-only field — the same gate every one of them uses. */
const Gated = () => (useEditorMode().advanced ? <p>Aliases</p> : null);

const emptyWorld = {
  worldOverview: { name: 'Sedge Landing', description: '', tags: [] } as unknown as WorldOverview,
  stats: [{ id: 's1', name: 'Warmth', type: 'number', min: 0, max: 10, regen: 0, descriptors: [] }] as unknown as Stat[],
  entities: [{ id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.' }] as unknown as Entity[],
  locations: [{ id: 'l1', name: 'The Jetty', entities: ['e1'] }] as unknown as GameLocation[],
  traits: [{ id: 't1', name: 'Saltborn', statChanges: [] }] as unknown as Trait[],
  dictionaries: [] as Dictionary[],
  placeholders: [] as Placeholder[],
};

beforeEach(() => localStorage.clear());

describe('editor mode', () => {
  it('defaults to Simple on first run and remembers Advanced', () => {
    expect(readEditorMode()).toBe('simple');
    localStorage.setItem('formamorph.worldEditorMode', 'advanced');
    expect(readEditorMode()).toBe('advanced');
  });

  it('drops Placeholders from the tab strip in Simple only', () => {
    expect(editorTabsFor(false).map((t) => t.value)).toEqual(['overview', 'stats', 'entities', 'locations', 'traits', 'dictionary']);
    expect(editorTabsFor(true).map((t) => t.value)).toContain('placeholders');
  });

  it('hides an advanced field in Simple and shows it in Advanced', () => {
    const { unmount } = render(<EditorModeProvider forcedMode="simple"><Gated /></EditorModeProvider>);
    expect(screen.queryByText('Aliases')).toBeNull();
    unmount();
    render(<EditorModeProvider forcedMode="advanced"><Gated /></EditorModeProvider>);
    expect(screen.getByText('Aliases')).toBeTruthy();
  });

  it('shows every field outside a provider — the library editor is not the World Editor', () => {
    render(<Gated />);
    expect(screen.getByText('Aliases')).toBeTruthy();
  });
});

describe('worldUsesAdvancedFeatures', () => {
  it('is false for a world using nothing Simple hides', () => {
    expect(worldUsesAdvancedFeatures(emptyWorld)).toBe(false);
  });

  // The Dictionary tab is visible in Simple, so an ordinary keyword entry hides nothing.
  it('is false for a plain keyword entry', () => {
    const plain = { ...emptyWorld, dictionaries: [{ id: 'b1', name: 'Lore', enabled: true, entries: [{ id: 'd1', key: ['tide'], value: 'It takes.' }] }] as unknown as Dictionary[] };
    expect(worldUsesAdvancedFeatures(plain)).toBe(false);
  });

  it.each([
    ['a placeholder', { placeholders: [{ id: 'p1', name: 'Eye Color', values: ['gray'] }] as Placeholder[] }],
    ['an always-inject entry', { dictionaries: [{ id: 'b1', name: 'Lore', enabled: true, entries: [{ id: 'd1', key: ['tide'], value: 'It takes.', constant: true }] }] as unknown as Dictionary[] }],
    ['a regex entry', { dictionaries: [{ id: 'b1', name: 'Lore', enabled: true, entries: [{ id: 'd1', key: ['tid.'], value: 'It takes.', useRegex: true }] }] as unknown as Dictionary[] }],
    ['secondary keywords', { dictionaries: [{ id: 'b1', name: 'Lore', enabled: true, entries: [{ id: 'd1', key: ['bridge'], value: 'A toll.', secondaryKeys: ['toll'] }] }] as unknown as Dictionary[] }],
    ['a muted book', { dictionaries: [{ id: 'b1', name: 'Lore', enabled: false, entries: [] }] as Dictionary[] }],
    ['a muted entry', { dictionaries: [{ id: 'b1', name: 'Lore', enabled: true, entries: [{ id: 'd1', key: ['tide'], value: 'It takes.', enabled: false }] }] as unknown as Dictionary[] }],
    ['stat code', { stats: [{ ...emptyWorld.stats[0], code: 'return 1;' }] }],
    ['a stat descriptor', { stats: [{ ...emptyWorld.stats[0], descriptors: [{ id: 1, threshold: 50, description: 'cold' }] }] }],
    ['an AI lock', { stats: [{ ...emptyWorld.stats[0], noDecrease: true }] }],
    ['an alias', { entities: [{ ...emptyWorld.entities[0], aliases: ['Roz'] }] }],
    ['an entity summary', { entities: [{ ...emptyWorld.entities[0], aiSummary: 'Keeps the lamp.' }] }],
    ['entity image tags', { entities: [{ ...emptyWorld.entities[0], imageTags: '1girl, lamp' }] }],
    ['a world readme', { worldOverview: { ...emptyWorld.worldOverview, readme: 'Welcome to the coast.' } as unknown as WorldOverview }],
    ['a location summary', { locations: [{ ...emptyWorld.locations[0], aiSummary: 'Rotting boards.' }] }],
    ['a trait stat toggle', { traits: [{ ...emptyWorld.traits[0], statToggles: [{ statId: 's1', enabled: false }] }] }],
    ['a narration override', { worldOverview: { ...emptyWorld.worldOverview, promptOverrides: { systemPrompt: 'You narrate.' } } as unknown as WorldOverview }],
  ])('is true for %s', (_label, patch) => {
    expect(worldUsesAdvancedFeatures({ ...emptyWorld, ...patch })).toBe(true);
  });
});
