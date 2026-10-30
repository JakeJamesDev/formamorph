import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Smile } from 'lucide-react';
import type { ComponentProps } from 'react';
import type { DiscoveredEntity, PlayerStat } from '@/types';
import type { UseGameEditorExtension } from './gameEditorExtension';

const state = vi.hoisted(() => ({
  discoveredEntities: [] as DiscoveredEntity[],
  setDiscoveredEntities: vi.fn(),
  setSuppressedCharacterNames: vi.fn(),
  setVisibleEntities: vi.fn(),
  currentPage: 1,
  totalPages: 1,
  isViewingPast: false,
  viewDiscoveredEntities: [] as DiscoveredEntity[],
  globalStats: [] as PlayerStat[],
  viewStats: [] as PlayerStat[],
  entityStats: {} as Record<string, PlayerStat[]>,
  viewEntityStats: {} as Record<string, PlayerStat[]>,
  commitManualStatEdit: vi.fn(),
  commitManualEntityStatEdit: vi.fn(),
  entityPositions: {} as Record<string, string>,
  setEntityPositions: vi.fn(),
}));
vi.mock('@/contexts/GameplayContext', () => ({ useGameplay: () => state }));
// The generate buttons have their own tests; here they only need to be there.
vi.mock('@/components/AiGenerateButton', () => ({ default: () => null }));

// The gallery needs the app's settings; a stand-in shows the pictures and adds one.
vi.mock('@/managers/ImageTagsField', () => ({
  ImageWidget: ({ images, onImagesChange, children }: { images: { data: string }[]; onImagesChange: (next: { data: string }[]) => void; children: React.ReactNode }) => (
    <div>
      <span data-testid="pictures">{images.map((img) => img.data).join(',')}</span>
      <button type="button" onClick={() => onImagesChange([...images, { data: 'data:own' }])}>Add picture</button>
      {children}
    </div>
  ),
  ImageGallery: () => null,
}));

// The resizable split listens for pointerdown on the document and cancels it, which stops user-event's mouse events.
vi.mock('react-resizable-panels', () => ({
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PanelResizeHandle: () => null,
}));

import { GameEditor } from './GameEditor';

const SUYA: DiscoveredEntity = {
  entity: { id: 'suya', name: 'Suya', aiDescription: 'A vixen-spirit in a woman\'s shape.' },
  locationId: 'hut',
  sourceTurnId: 't1',
};
const GRUKK: DiscoveredEntity = { entity: { id: 'grukk', name: 'Grukk', aiDescription: 'A big goblin.' }, sourceTurnId: 't2' };

type Props = ComponentProps<typeof GameEditor>;
const renderEditor = (over: Partial<Props> = {}) => render(
  <GameEditor
    open
    onOpenChange={() => {}}
    request={{ tab: 'entities', entityId: 'suya', key: 1 }}
    worldName="Fox Hollow"
    locations={[{ id: 'hut', name: 'The Hut' } as never]}
    scene={{ locationName: 'The Hut', timeLabel: 'Day 2, 09:00', here: [] }}
    onPageChange={vi.fn()}
    {...over}
  />,
);
const list = () => screen.getByLabelText('Game entities');
const save = () => screen.getByRole('button', { name: 'Save' });
const lastUpdate = () => state.setDiscoveredEntities.mock.calls.at(-1)![0] as (prev: DiscoveredEntity[]) => DiscoveredEntity[];
const openTab = (user: ReturnType<typeof userEvent.setup>, name: string) => user.click(screen.getByRole('tab', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  state.discoveredEntities = [SUYA, GRUKK];
  Object.assign(state, { currentPage: 1, totalPages: 1, isViewingPast: false, viewDiscoveredEntities: state.discoveredEntities });
});

describe('the Game Editor on an earlier turn', () => {
  const pageBack = () => Object.assign(state, {
    currentPage: 3,
    totalPages: 7,
    isViewingPast: true,
    // Grukk came later, and Suya's description was different then.
    viewDiscoveredEntities: [{ ...SUYA, entity: { ...SUYA.entity, aiDescription: 'A fox at the door.' } }],
  });

  it('says which turn it shows, and shows the entities as that turn left them', async () => {
    const user = userEvent.setup();
    pageBack();
    renderEditor();
    expect(screen.getByText('Turn 3 of 7 · Read Only')).toBeTruthy();
    expect(list().textContent).toContain('Suya');
    expect(list().textContent).not.toContain('Grukk');
    await openTab(user, 'Descriptions');
    expect(screen.getByLabelText('AI-Facing Description')).toHaveProperty('value', 'A fox at the door.');
  });

  it('changes nothing there: locked fields, no Remove', async () => {
    const user = userEvent.setup();
    pageBack();
    renderEditor();
    expect(save()).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    await openTab(user, 'Descriptions');
    expect(screen.getByLabelText('AI-Facing Description')).toBeDisabled();
  });
});

describe('the Game Editor', () => {
  it('names the world and the turn, and lists every invented entity with where they are', () => {
    renderEditor();
    expect(screen.getByText('Fox Hollow')).toBeTruthy();
    expect(screen.getByText('Turn 1 of 1')).toBeTruthy();
    expect(list().textContent).toContain('Suya');
    expect(list().textContent).toContain('The Hut');
    expect(list().textContent).toContain('Grukk');
    expect(list().textContent).toContain('Nowhere');
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Suya');
  });

  it('keeps edits in a draft until Save, and Discard Changes drops them', async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(save()).toBeDisabled();
    await user.type(screen.getByLabelText('Pronouns'), 'she/her');
    expect(save()).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save options' }));
    await user.click(screen.getByRole('button', { name: /Discard Changes/ }));
    expect(screen.getByLabelText('Pronouns')).toHaveProperty('value', '');
    expect(state.setDiscoveredEntities).not.toHaveBeenCalled();

    await openTab(user, 'Descriptions');
    await user.type(screen.getByLabelText('AI-Facing Description'), ' Five tails.');
    await user.click(save());
    expect(lastUpdate()([SUYA, GRUKK])[0].entity.aiDescription).toBe(`${SUYA.entity.aiDescription} Five tails.`);
  });

  it('keeps edits to two entities in one draft', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.clear(screen.getByLabelText('Pronouns'));
    await user.type(screen.getByLabelText('Pronouns'), 'she/her');
    await user.click(screen.getByRole('button', { name: 'Grukk' }));
    await user.type(screen.getByLabelText('Pronouns'), 'he/him');
    await user.click(save());
    const saved = lastUpdate()([SUYA, GRUKK]);
    expect(saved.map((d) => d.entity.pronouns)).toEqual(['she/her', 'he/him']);
  });

  it('asks before closing with unsaved edits', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderEditor({ onOpenChange });
    await user.type(screen.getByLabelText('Pronouns'), 'she/her');
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('alertdialog', { name: 'Unsaved changes' })).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Exit Without Saving' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(state.setDiscoveredEntities).not.toHaveBeenCalled();
  });

  it('renames an entity on Save, keeping its old name under Aliases', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Bram');
    expect(screen.getByText(/Suya is kept under Aliases/)).toBeTruthy();
    await user.click(save());
    expect(lastUpdate()([SUYA, GRUKK])[0].entity).toMatchObject({ id: 'suya', name: 'Bram', aliases: ['Suya'] });
  });

  it('moves an entity to another location, or to nowhere', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('combobox', { name: 'Location' }));
    await user.click(screen.getByRole('option', { name: 'Nowhere' }));
    await user.click(save());
    const moved = lastUpdate()([SUYA, GRUKK])[0];
    expect(moved.locationId).toBeUndefined();
    expect(moved.entity.aiDescription).toBe(SUYA.entity.aiDescription);
  });

  it('removes an entity on Save after confirming', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: /^(Confirm|Continue|Yes|Remove)$/ }));
    expect(state.setSuppressedCharacterNames).not.toHaveBeenCalled();
    await user.click(save());
    expect(state.setSuppressedCharacterNames).toHaveBeenCalled();
    expect(lastUpdate()([SUYA, GRUKK]).map((d) => d.entity.name)).toEqual(['Grukk']);
  });

  it('opens on the player and says so when the story has invented no one', () => {
    state.discoveredEntities = [];
    renderEditor({ request: { tab: 'entities', key: 1 }, player: { name: 'Natmon' } });
    expect(list().textContent).toContain('hasn\'t invented any entities');
    expect(screen.getByText('This world gives you no stats')).toBeTruthy();
  });

  it("shows the player's persona, read only", async () => {
    const user = userEvent.setup();
    renderEditor({ request: { tab: 'entities', key: 1 }, player: { name: 'Natmon', persona: { id: 'n', name: 'Natmon', aiDescription: 'A tall ranger.' } } });
    expect(screen.getByLabelText('Name')).toBeDisabled();
    await openTab(user, 'Descriptions');
    expect(screen.getByLabelText('AI-Facing Description')).toHaveProperty('value', 'A tall ranger.');
  });

  it("edits the player's stats, kept on Save", async () => {
    const user = userEvent.setup();
    const health = { id: 'hp', name: 'Health', type: 'number', description: '', min: 0, max: 10, value: 7, regen: 0, descriptors: [] } as unknown as PlayerStat;
    state.globalStats = [health];
    renderEditor({ request: { tab: 'entities', key: 1 }, player: { name: 'Natmon' } });
    const field = screen.getByRole('spinbutton', { name: 'Health' });
    await user.clear(field);
    await user.type(field, '9');
    await user.click(save());
    expect(state.commitManualStatEdit).toHaveBeenCalledWith([{ ...health, value: 9 }]);
    state.globalStats = [];
  });

  it('undoes and redoes edits, a run of typing in one field as one step', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getByLabelText('Pronouns'), 'she/her');
    await user.click(screen.getByRole('combobox', { name: 'Location' }));
    await user.click(screen.getByRole('option', { name: 'Nowhere' }));
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(screen.getByRole('combobox', { name: 'Location' }).textContent).toContain('The Hut');
    expect(screen.getByLabelText('Pronouns')).toHaveProperty('value', 'she/her');
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(screen.getByLabelText('Pronouns')).toHaveProperty('value', '');
    expect(save()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Redo/ }));
    expect(screen.getByLabelText('Pronouns')).toHaveProperty('value', 'she/her');
  });

  it('lists each edit in History, by entity and field', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getByLabelText('Pronouns'), 'she/her');
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByText('Editor opened')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Edit Entity Suya: Pronouns/ })).toBeTruthy();
  });

  it('finds text across the game and opens the entity and tab that hold it', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getAllByRole('textbox', { name: 'Search Game' })[0], 'goblin');
    await waitFor(() => expect(screen.getByLabelText('AI-Facing Description')).toHaveProperty('value', 'A big goblin.'));
  });

  it('pages the game through the timeline', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    Object.assign(state, { currentPage: 2, totalPages: 3 });
    renderEditor({ onPageChange });
    expect(screen.getByText('Turn 2 of 3')).toBeTruthy();
    await user.click(screen.getByRole('link', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("edits every entity's three descriptions", async () => {
    const user = userEvent.setup();
    renderEditor();
    await openTab(user, 'Descriptions');
    await user.type(screen.getByLabelText('Player-Facing Description'), 'A fox at the door.');
    await user.type(screen.getByLabelText('AI-Facing Summary'), 'Fox spirit.');
    await user.click(save());
    expect(lastUpdate()([SUYA])[0].entity).toMatchObject({ playerDescription: 'A fox at the door.', aiSummary: 'Fox spirit.' });
  });

  it("edits an entity's stats on its Stats tab, kept on Save", async () => {
    const user = userEvent.setup();
    const trust = { id: 'trust', name: 'Trust', type: 'number', description: '', min: 0, max: 100, value: 40, regen: 0, descriptors: [] } as unknown as PlayerStat;
    state.entityStats = { suya: [trust] };
    renderEditor();
    await openTab(user, 'Stats');
    const field = screen.getByRole('spinbutton', { name: 'Trust' });
    await user.clear(field);
    await user.type(field, '75');
    expect(state.commitManualEntityStatEdit).not.toHaveBeenCalled();
    await user.click(save());
    expect(state.commitManualEntityStatEdit).toHaveBeenLastCalledWith('suya', 'trust', 75);
  });

  it('opens on the entity it was asked for', () => {
    renderEditor({ request: { tab: 'entities', entityId: 'grukk', key: 2 } });
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Grukk');
  });
});

describe('the Game Editor Overview', () => {
  it('shows the game and who is here, and opens an entity from there', async () => {
    const user = userEvent.setup();
    renderEditor({
      request: { tab: 'overview', key: 1 },
      scene: { locationName: 'The Hut', timeLabel: 'Day 2, 09:00', here: [{ id: 'suya', name: 'Suya' }, { id: 'ren', name: 'Ren' }] },
    });
    expect(screen.getByText('Day 2, 09:00')).toBeTruthy();
    expect(screen.getByText('Who the story has at The Hut')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Suya' }));
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Suya');
  });

  it('shows your stats, the tabs with their counts, and who is nearby', async () => {
    const user = userEvent.setup();
    state.globalStats = [{ id: 'hp', name: 'Health', value: 7, min: 0, max: 10 } as PlayerStat];
    renderEditor({
      request: { tab: 'overview', key: 1 },
      player: { name: 'Natmon' },
      scene: { locationName: 'The Hut', here: [], nearby: [{ id: 'grukk', name: 'Grukk' }] },
    });
    expect(screen.getByText('Health')).toBeTruthy();
    expect(screen.getByLabelText('Jump to a tab').textContent).toContain('3 entities');
    expect(screen.getByLabelText('Nearby').textContent).toContain('Grukk');
    await user.click(within(screen.getByLabelText('Jump to a tab')).getByRole('button', { name: 'Entities' }));
    expect(list()).toBeTruthy();
    state.globalStats = [];
  });
});

describe('world entities in the Game Editor', () => {
  const REN = { id: 'ren', name: 'Ren', aiDescription: 'The ferryman.' };

  it('lists them under From the World, and opens them from Here Now', async () => {
    const user = userEvent.setup();
    renderEditor({
      worldEntities: [REN],
      request: { tab: 'overview', key: 1 },
      scene: { locationName: 'The Hut', here: [{ id: 'ren', name: 'Ren' }] },
    });
    await user.click(screen.getByRole('button', { name: 'Ren' }));
    expect(list().textContent).toContain('From the World');
    expect(list().textContent).toContain('In the Game');
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Ren');
  });

  it('locks their text, and offers no Remove', async () => {
    const user = userEvent.setup();
    renderEditor({ worldEntities: [REN], request: { tab: 'entities', entityId: 'ren', key: 2 } });
    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    await openTab(user, 'Descriptions');
    expect(screen.getByLabelText('AI-Facing Description')).toBeDisabled();
  });

  it('edits their stats, kept on Save', async () => {
    const user = userEvent.setup();
    const trust = { id: 'trust', name: 'Trust', type: 'number', description: '', min: 0, max: 100, value: 40, regen: 0, descriptors: [] } as unknown as PlayerStat;
    state.entityStats = { ren: [trust] };
    renderEditor({ worldEntities: [REN], request: { tab: 'entities', entityId: 'ren', key: 2 } });
    await openTab(user, 'Stats');
    const field = screen.getByRole('spinbutton', { name: 'Trust' });
    await user.clear(field);
    await user.type(field, '75');
    await user.click(save());
    expect(state.commitManualEntityStatEdit).toHaveBeenLastCalledWith('ren', 'trust', 75);
    state.entityStats = {};
  });

  it('moves one listed at several places to one of them, on Save', async () => {
    const user = userEvent.setup();
    renderEditor({
      worldEntities: [{ ...REN, locations: ['hut', 'well'] }],
      locations: [{ id: 'hut', name: 'The Hut' } as never, { id: 'well', name: 'The Well' } as never],
      request: { tab: 'entities', entityId: 'ren', key: 2 },
    });
    expect(list().textContent).toContain('Several places');
    await user.click(screen.getByRole('combobox', { name: 'Location' }));
    await user.click(screen.getByRole('option', { name: 'The Well' }));
    await user.click(save());
    const update = state.setEntityPositions.mock.calls[0][0] as (prev: Record<string, string>) => Record<string, string>;
    expect(update({})).toEqual({ ren: 'well' });
  });

  it('moves one that stands at one place, on Save', async () => {
    const user = userEvent.setup();
    state.entityPositions = { ren: 'hut' };
    renderEditor({
      worldEntities: [REN],
      locations: [{ id: 'hut', name: 'The Hut' } as never, { id: 'well', name: 'The Well' } as never],
      request: { tab: 'entities', entityId: 'ren', key: 2 },
    });
    await user.click(screen.getByRole('combobox', { name: 'Location' }));
    await user.click(screen.getByRole('option', { name: 'The Well' }));
    await user.click(save());
    const update = state.setEntityPositions.mock.calls[0][0] as (prev: Record<string, string>) => Record<string, string>;
    expect(update({ ren: 'hut' })).toEqual({ ren: 'well' });
    state.entityPositions = {};
  });
});

describe('the Active and Inactive tabs', () => {
  it('shows everyone under Entities, then who the model can be told about, then the rest', async () => {
    const user = userEvent.setup();
    renderEditor({ activeEntityIds: ['suya'], sceneEntityIds: ['suya'], worldEntities: [{ id: 'ren', name: 'Ren' }], player: { name: 'Natmon' } });
    expect(list().textContent).toContain('Grukk');
    expect(list().textContent).toContain('Ren');
    expect(within(list()).getAllByRole('img', { name: 'In the scene' })).toHaveLength(1);
    await openTab(user, 'Active');
    expect(within(list()).getAllByRole('img', { name: 'In the scene' })).toHaveLength(1);
    expect(list().textContent).toContain('Natmon');
    expect(list().textContent).toContain('Suya');
    expect(list().textContent).not.toContain('Grukk');
    expect(list().textContent).not.toContain('Ren');
    await openTab(user, 'Inactive');
    expect(list().textContent).not.toContain('Natmon');
    expect(list().textContent).not.toContain('Suya');
    expect(list().textContent).toContain('Grukk');
    expect(list().textContent).toContain('Ren');
  });
});

describe('the mouse buttons in the Game Editor', () => {
  it('goes back to the Overview from an entity opened there, and forward again', async () => {
    const user = userEvent.setup();
    renderEditor({
      request: { tab: 'overview', key: 1 },
      scene: { locationName: 'The Hut', here: [{ id: 'suya', name: 'Suya' }] },
    });
    await user.click(screen.getByRole('button', { name: 'Suya' }));
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Suya');

    fireEvent.mouseUp(screen.getByLabelText('Game entities'), { button: 3 });
    expect(await screen.findByLabelText('Jump to a tab')).toBeTruthy();

    fireEvent.mouseUp(screen.getByLabelText('Jump to a tab'), { button: 4 });
    expect(await screen.findByLabelText('Name')).toHaveProperty('value', 'Suya');
  });
});

describe('a feature laid over the Game Editor', () => {
  // A stand-in feature with one rail tab, one panel tab and one slice of the draft.
  const onCommit = vi.fn();
  const useMoodFeature: UseGameEditorExtension = ({ extra, setExtra }) => {
    const mood = extra<string>('mood');
    return {
      tabs: [{
        tab: { value: 'moods', label: 'Moods', group: 'story', icon: Smile },
        section: { list: <p>Mood list</p>, detail: <p>Mood detail</p> },
        jump: 'One mood',
      }],
      entityTabs: [{
        value: 'mood',
        label: 'Mood',
        icon: Smile,
        body: <button type="button" onClick={() => setExtra({ verb: 'Edit', type: 'Entity' }, 'mood', 'mood', 'calm')}>Set mood {mood ?? 'none'}</button>,
      }],
      onSave: () => { if (mood) onCommit(mood); },
    };
  };
  const EXTENSIONS = [useMoodFeature];

  it('adds its tab to the rail, under its group, and to the Overview', async () => {
    const user = userEvent.setup();
    renderEditor({ extensions: EXTENSIONS, request: { tab: 'overview', key: 1 } });
    expect(within(screen.getByLabelText('Jump to a tab')).getByRole('button', { name: 'Moods' })).toBeTruthy();
    await openTab(user, 'Moods');
    expect(screen.getByText('Mood detail')).toBeTruthy();
  });

  it('keeps its edits in the draft: Save hands them over, undo takes them back', async () => {
    const user = userEvent.setup();
    renderEditor({ extensions: EXTENSIONS });
    await openTab(user, 'Mood');
    await user.click(screen.getByRole('button', { name: 'Set mood none' }));
    expect(save()).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(save()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Redo/ }));
    await user.click(save());
    expect(onCommit).toHaveBeenCalledWith('calm');
  });
});
