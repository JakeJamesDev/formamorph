import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act, within } from '@testing-library/react';
import { $createParagraphNode, $getRoot, getNearestEditorFromDOMNode } from 'lexical';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { blankItem } from '@/lib/items';
import { itemTabForField } from '@/views/itemPanelTabs';
import type { Item, World } from '@/types';

/** Where the item editor puts Unidentified Name and Unidentified Description. */

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

const VIAL: Item = {
  ...blankItem('vial', 'Sunfire Elixir'),
  playerDescription: 'A ruby tonic.',
  unidentifiedName: 'Cloudy Vial',
  unidentifiedDescription: 'A murky liquid.',
};
const WORLD: World = benchEditorWorld({ items: [VIAL] } as Partial<World>);

const openVial = () => {
  openEditorTab(/Items/);
  fireEvent.click(screen.getByRole('button', { name: 'Select Sunfire Elixir' }));
};
const openTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });
const labelOf = (text: string) => screen.getByText(text, { selector: 'label' });
const frame = (text: string) => labelOf(text).closest('[data-history-field]') as HTMLElement;
const helpButtons = (root: HTMLElement) => within(root).queryAllByRole('button', { name: /^About / });

beforeEach(() => { localStorage.clear(); });

describe('the item editor name row', () => {
  it('holds Unidentified Name beside Name on the Profile tab', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openVial();
    const name = frame('Name');
    const partner = frame('Unidentified Name');
    expect(name.parentElement).toBe(partner.parentElement);
    expect(name.compareDocumentPosition(partner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Unidentified Name off the Descriptions tab', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openVial();
    openTab('Descriptions');
    expect(screen.queryByText('Unidentified Name', { selector: 'label' })).toBeNull();
  });

  it('gives Unidentified Name one help button and no inline hint', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openVial();
    expect(helpButtons(frame('Unidentified Name'))).toHaveLength(1);
    expect(screen.queryByText(/until the narration identifies the item/)).toBeNull();
  });
});

describe('the item Descriptions tab', () => {
  it('shows Unidentified Description directly after Player-Facing Description, before the AI-facing fields', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openVial();
    openTab('Descriptions');
    const labels = [...document.querySelectorAll('label')].map((l) => l.textContent);
    const player = labels.indexOf('Player-Facing Description');
    expect(labels[player + 1]).toBe('Unidentified Description');
    expect(labels.indexOf('AI-Facing Description')).toBeGreaterThan(player + 1);
  });

  it('gives Unidentified Description one help button and no inline hint', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openVial();
    openTab('Descriptions');
    expect(helpButtons(frame('Unidentified Description'))).toHaveLength(1);
    expect(screen.queryByText(/Leave it blank to show the Player-Facing Description\./)).toBeNull();
  });

  it('keeps Unidentified Description when Unidentified Name is cleared', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openVial();
    const editor = getNearestEditorFromDOMNode(screen.getByRole('textbox', { name: 'Unidentified Name' }));
    await act(async () => {
      editor?.update(() => { $getRoot().clear().append($createParagraphNode()); }, { discrete: true });
    });
    expect(ctx().items[0].unidentifiedName).toBeUndefined();
    expect(ctx().items[0].unidentifiedDescription).toBe('A murky liquid.');
  });
});

describe('the item field-to-tab map', () => {
  it('sends a search hit on Unidentified Name to Profile and Unidentified Description to Descriptions', () => {
    expect(itemTabForField('unidentifiedName')).toBe('profile');
    expect(itemTabForField('unidentifiedDescription')).toBe('descriptions');
  });
});
