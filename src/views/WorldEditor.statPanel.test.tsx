import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * What the World Editor's stat panel puts on screen, driven through the real editor.
 *
 * The panel splits its field groups across its own tabs, so a group that loses a field, gains a duplicate,
 * lands out of order, or lands on the wrong tab shows up here as a changed label list. Simple mode keeps one
 * tab, which is no choice, so the strip goes away entirely — the case the shared strip gained for this panel.
 */

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

// The real editor arrives on its own chunk and brings CodeMirror with it; the Code tab's shape is what these
// cases are about, so the field stands in as a plain box that still names itself.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; ariaLabel: string; label?: string }) => (
    <div><span>{props.label}</span><textarea aria-label={props.ariaLabel} defaultValue={props.value} /></div>
  ),
}));

const WORLD: World = benchEditorWorld({
  stats: [
    {
      id: 's1', name: 'Warmth', type: 'number', description: 'How thawed the traveler is.',
      min: 0, max: 10, value: 4, regen: 0, code: 'return 4;',
      descriptors: [{ id: 'd1', threshold: 3, description: 'chilled' }],
    },
    { id: 's2', name: 'Damp', type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [] },
    { id: 's3', name: 'Resolve', type: 'percentage', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] },
  ],
} as Partial<World>);

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

const FIELD_LABELS =
  /^(Name|Type|Description|Min|Max|Initial Value|Initial Value \(%\)|Regen|Body Sliders|Availability|Prevent AI Changes|Stat Descriptors|Dynamic Value Calculation|Code)$/;

/** Every field label the panel shows, in document order. The panel's own strip carries a Code tab and a
 *  Details tab, so the match is taken from the panel body rather than the whole editor. */
const panelLabels = () =>
  screen.getAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);

/** The checkbox captions the panel shows, which are spans rather than labeled fields. */
const panelSwitches = () =>
  screen.getAllByText(/^(Enabled|Hidden|Don't Increase|Don't Increase Max|Don't Decrease|Don't Decrease Max)$/)
    .map((el) => el.textContent);

/** One range box, read through its own label. The four carry no accessible name of their own, so the label
 *  is found first and the box taken from the pair it sits in. */
const rangeInput = (label: string) => {
  const tag = screen.getAllByText(label).find((el) => el.tagName === 'LABEL');
  if (!tag) throw new Error(`No range label named ${label}`);
  return tag.parentElement!.querySelector('input') as HTMLInputElement;
};

/** The stat panel's own strip. The editor's top-level one carries a Stats tab of its own, so every read and
 *  click here is taken from the named strip rather than by tab name. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Stat Fields' });

const panelTabNames = () => {
  const strip = panelStrip();
  return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
};

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name });

const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

const selectStat = (name: string) => {
  openTab(/Stats/);
  fireEvent.click(screen.getByText(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor stat panel tabs', () => {
  it('offers three tabs in Advanced mode and opens on Details', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    expect(panelTabNames()).toEqual(['Details', 'Descriptors', 'Code']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });

  it('puts what the stat is and how it behaves on Details, and nothing else', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    expect(panelLabels()).toEqual([
      'Name', 'Type', 'Description', 'Min', 'Max', 'Initial Value', 'Regen', 'Body Sliders',
      'Availability', 'Prevent AI Changes',
    ]);
    expect(panelSwitches()).toEqual([
      'Enabled', 'Hidden', "Don't Increase", "Don't Increase Max", "Don't Decrease", "Don't Decrease Max",
    ]);
  });

  it('carries both meanings of Availability on one short line, with the definitions behind the info control', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    const help = screen.getByText(/Enabled makes the stat live/);
    expect(help.textContent).toMatch(/Hidden keeps it from the player only/);
    // The pair had a paragraph each before; a second line under Availability is the regression.
    expect(screen.queryByText(/regen and code/)).toBeNull();
    await userEvent.click(within(help.parentElement!).getByRole('button', { name: 'More info' }));
    expect(await screen.findByText(/regen and code keep running/)).toBeInTheDocument();
  });

  it('puts the descriptor section whole on Descriptors', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    openPanelTab('Descriptors');
    expect(panelLabels()).toEqual(['Stat Descriptors']);
    expect(screen.getByRole('radio', { name: 'Raw' })).toBeInTheDocument();
    expect(screen.getByLabelText('Threshold for chilled')).toBeInTheDocument();
  });

  it('puts the code section whole on Code', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    openPanelTab('Code');
    expect(panelLabels()).toEqual(['Dynamic Value Calculation', 'Code']);
    expect(screen.getByRole('button', { name: /Templates/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Stat code')).toHaveValue('return 4;');
    expect(screen.getByRole('button', { name: /Test Code/ })).toBeInTheDocument();
  });

  it('leaves Simple mode no strip and only the fields that mode has always shown', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectStat('Warmth');
    expect(panelTabNames()).toEqual([]);
    expect(panelLabels()).toEqual([
      'Name', 'Type', 'Description', 'Min', 'Max', 'Initial Value', 'Regen', 'Body Sliders',
    ]);
    expect(screen.queryByText('Enabled')).toBeNull();
    expect(screen.queryByText('Hidden')).toBeNull();
    expect(screen.queryByText('Stat Descriptors')).toBeNull();
    expect(screen.queryByLabelText('Stat code')).toBeNull();
  });

  it('keeps the chosen tab when the author selects another stat', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    openPanelTab('Descriptors');
    fireEvent.click(screen.getByText('Damp'));
    expect(panelTab('Descriptors')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Stat Descriptors']);
  });

  it('lands on Details with no strip when Simple mode takes the Code tab away, and restores it', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    openPanelTab('Code');

    fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
    expect(panelTabNames()).toEqual([]);
    expect(panelLabels()).toEqual([
      'Name', 'Type', 'Description', 'Min', 'Max', 'Initial Value', 'Regen', 'Body Sliders',
    ]);

    // The switch wears the hidden-data marker, whose own label joins its accessible name.
    fireEvent.click(screen.getByRole('radio', { name: /^Advanced/ }));
    expect(panelTabNames()).toEqual(['Details', 'Descriptors', 'Code']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });

  it('gives a Percentage stat the same three tabs over its pinned range', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Resolve');
    expect(panelTabNames()).toEqual(['Details', 'Descriptors', 'Code']);
    expect(panelLabels()).toEqual([
      'Name', 'Type', 'Description', 'Min', 'Max', 'Initial Value (%)', 'Regen', 'Body Sliders',
      'Availability', 'Prevent AI Changes',
    ]);
    const min = rangeInput('Min');
    const max = rangeInput('Max');
    expect([min.value, max.value]).toEqual(['0', '100']);
    expect([min.disabled, max.disabled]).toEqual([true, true]);
  });
});
