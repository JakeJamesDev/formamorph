import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Dictionary, Entity, GameLocation, Placeholder, Stat, Trait, WorldOverview } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import WorldDetailsManager from './WorldDetailsManager';
import { overviewPanelTabsFor, type OverviewPlace } from '@/views/overviewPanelTabs';

/** The World Editor hands Chip Options the authored world, never the sample world (spec Q22). */

// Only the fields the chips read; the full world shapes add nothing to this test.
const overview = {
  name: 'Sedge Landing', description: '', systemPrompt: 'A drowned coast where the tide keeps what it takes.', tags: [],
  promptOverrides: { systemPrompt: 'You are the narrator. <LOCATION> <INVENTORY>', systemPromptEnabled: true },
} as unknown as WorldOverview;
const locations = [{ id: 'loc1', name: 'The Jetty', aiDescription: 'Rotting boards over black water.' }] as unknown as GameLocation[];
const entities = [{ id: 'ent1', name: 'Wren', aiDescription: 'A lamp-keeper who does not sleep.', locations: ['loc1'] }] as unknown as Entity[];

vi.mock('@/contexts/GameDataContext', () => {
  const data = () => ({
    worldOverview: overview, updateWorldOverview: () => {}, updateEntity: () => {}, updateLocation: () => {},
    entities, locations, stats: [] as Stat[], statGroups: [], traits: [] as Trait[], traitGroups: [],
    dictionaries: [] as Dictionary[], placeholders: [] as Placeholder[],
    items: [{ id: 'copper', name: 'Copper', statEffects: [], traitEffects: [], equipRequires: [] }],
    placements: [{ id: 'p1', where: { kind: 'entity', id: 'ent1' }, quantity: 2, source: { kind: 'item', itemId: 'copper' } }],
    currencies: [{ id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }] } }],
  });
  return { useGameData: data, useGameDataOptional: data };
});
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    paragraphLimit: 'single', maxTokens: 800, markdownOutput: true,
    activeSectionStyle: 'default', limitActiveCharacters: true, activeCharacterLimit: 5, language: 'English',
    systemPrompt: 'PRESET narration prompt', choicesPrompt: 'PRESET choices prompt', statUpdatesPrompt: 'PRESET stat prompt',
  }),
}));
vi.mock('@/lib/useDanbooruTags', () => ({ useDanbooruTags: () => [] }));

/** The World Editor holds the shown tab and prompt kind in the app. */
function Harness() {
  const [place, setPlace] = useState<OverviewPlace>({ tab: 'details', kind: 'narration' });
  return <WorldDetailsManager place={place} onPlaceChange={setPlace} tabs={overviewPanelTabsFor(true)} />;
}

describe('Chip Options in the World Editor', () => {
  it("reads the world's own location, not the sample's", async () => {
    const user = userEvent.setup();
    render(
      <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
        <Harness />
      </EditorModeContext.Provider>,
    );
    await user.click(screen.getByRole('tab', { name: 'Custom Prompts' }));
    // The editor mounts its chips after the first paint.
    const chip = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-chip]');
      expect(found).toBeTruthy();
      return found!;
    });
    await user.click(chip);

    const reads = within(await screen.findByRole('dialog', { name: 'Chip Options' })).getByRole('region', { name: 'What the AI Reads' });
    expect(reads).toHaveTextContent('The Jetty');
    expect(reads).not.toHaveTextContent('The Landing');
  });

  it("reads the world's own balances in the Inventory chip", async () => {
    const user = userEvent.setup();
    render(
      <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
        <Harness />
      </EditorModeContext.Provider>,
    );
    await user.click(screen.getByRole('tab', { name: 'Custom Prompts' }));
    const chip = await waitFor(() => {
      const chips = document.querySelectorAll<HTMLElement>('[data-chip]');
      expect(chips.length).toBe(2);
      return chips[1];
    });
    await user.click(chip);

    const reads = within(await screen.findByRole('dialog', { name: 'Chip Options' })).getByRole('region', { name: 'What the AI Reads' });
    expect(reads).toHaveTextContent('balance: 2 Copper');
  });
});
