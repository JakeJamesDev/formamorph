import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { Entity, Opening, World } from '@/types';

/** What the Openings tab's panes say about whose openings draw: This World's footer hint, an entity's Never
 *  Draws marks, and an entity opening's Preview. Driven through the real editor. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const others: Opening = { id: 'o1', text: 'The Warden waves you in.', kind: 'action' };
const self: Opening = { id: 'o2', text: 'You wake as the Warden.', kind: 'narration', self: true };
const custom = { id: 'custom', name: 'You', customPersona: true } as Entity;
const keeper = { id: 'keeper', name: 'Keeper', locations: ['dock'] } as Entity;

const worldWith = (entities: Entity[]): World => benchEditorWorld({
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', readme: '', tags: [],
  },
  locations: [{ id: 'dock', name: 'Dock', isStarting: true }],
  entities,
} as unknown as Partial<World>);

const pane = () => {
  const el = document.querySelector<HTMLElement>('[data-panel-id="editor-detail"]');
  if (!el) throw new Error('No detail pane');
  return el;
};
const selectOwner = (name: string) => {
  const list = document.querySelector<HTMLElement>('[data-panel-id="editor-list"]')!;
  fireEvent.click(within(list).getByRole('button', { name: `Select ${name}` }));
};

const openOpeningsTab = async (entities: Entity[]) => {
  renderWorldEditorBench(worldWith(entities), 'advanced');
  await screen.findByLabelText('World Name');
  openEditorTab(/^Openings$/);
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("This World's footer hint", () => {
  const hint = () => within(pane()).getByText(/Draws one opening|Write an opening here|Openings are off/).textContent;

  it('keeps the default-opening state when the only text is on Custom Persona Others rows', async () => {
    await openOpeningsTab([{ ...custom, openings: [others] } as Entity]);
    expect(hint()).toMatch(/^Write an opening here/);
  });

  it('says one opening draws when a Custom Persona Self row has text', async () => {
    await openOpeningsTab([{ ...custom, openings: [others, self] } as Entity]);
    expect(hint()).toMatch(/^Draws one opening/);
  });

  it('says one opening draws when another entity has a drawable row', async () => {
    await openOpeningsTab([{ ...custom, openings: [others] } as Entity, { ...keeper, openings: [others] } as Entity]);
    expect(hint()).toMatch(/^Draws one opening/);
  });
});

describe("an entity's Never Draws mark", () => {
  const markOn = (row: HTMLElement) => within(row).queryByText('Never Draws');

  it.each<[string, Entity]>([
    ['the Custom Persona', { ...custom, openings: [others, self] } as Entity],
    ['a Persona-Only entity', { ...keeper, name: 'Warden', persona: true, personaOnly: true, openings: [others, self] } as Entity],
  ])('marks an Others row of %s, not its Self row', async (_name, entity) => {
    await openOpeningsTab([entity]);
    selectOwner(entity.name);
    const [othersRow, selfRow] = within(pane()).getAllByTestId('opening-row');
    expect(markOn(othersRow)).toBeInTheDocument();
    expect(markOn(selfRow)).toBeNull();
  });
});

describe("an entity opening's Preview", () => {
  it("reads Entity Name as the entity's name and Persona Name as its label", async () => {
    await openOpeningsTab([{ ...keeper, openings: [{ id: 'g1', text: '{{char}} nods to {{user}}.', kind: 'narration' }] } as Entity]);
    selectOwner('Keeper');
    // Radix tabs switch on mouseDown.
    fireEvent.mouseDown(within(pane()).getByRole('tab', { name: 'Preview' }));
    expect(within(pane()).getByTestId('prompt-preview').textContent).toBe('Keeper nods to Persona Name.');
  });
});
