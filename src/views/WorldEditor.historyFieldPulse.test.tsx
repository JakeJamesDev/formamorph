import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { $createParagraphNode, $createTextNode, $getRoot, getNearestEditorFromDOMNode, type LexicalEditor } from 'lexical';
import {
  benchEditorWorld, openEditorTab, pickEditorMode, renderWorldEditorBench, shownEditorTab,
} from '@/test/worldEditorBench';
import { frames } from '@/test/landing';
import { stubReducedMotion } from '@/test/reducedMotion';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { LANDING_PULSE_CLASS, LANDING_RING_CLASS } from '@/lib/landingPulse';
import type { World } from '@/types';

/** After an undo or redo, the field the author edited scrolls into view and pulses, and focus stays put. */

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

const WORLD: World = benchEditorWorld({
  stats: [{
    id: 's-mood', name: 'Mood', type: 'number', description: 'How calm', min: 0, max: 10, value: 4, regen: 0,
    descriptors: [{ id: 'd-low', threshold: 3, description: 'Tense' }, { id: 'd-high', threshold: 10, description: 'Calm' }],
  }],
  entities: [{
    id: 'resident', name: 'Odd Wick', pronouns: 'he/him', playerDescription: 'The lamp-keeper.',
    aiDescription: 'Keeps the lamps.', aiSummary: 'A lamp-keeper.', locations: ['harbor'],
  }],
  placeholders: [{ id: 'weather', name: 'Weather', values: [{ id: 'v-fog', text: 'fog' }] }],
} as Partial<World>);

/** One author action, then the event loop moves on as it does between two presses. */
const step = (action: () => void | Promise<void>) => act(async () => {
  await action();
  await new Promise((resolve) => setTimeout(resolve, 0));
});
/** Ctrl+Z or Ctrl+Y pressed wherever focus is, then the reveal's frames. */
const press = async (key: 'z' | 'y') => {
  await step(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key, ctrlKey: true }); });
  await frames(2);
};
const undo = () => press('z');
const redo = () => press('y');

/** The one element wearing a moving pulse or a still ring. */
const ringed = (name = LANDING_PULSE_CLASS) => {
  const rings = document.querySelectorAll<HTMLElement>(`.${name}`);
  expect(rings).toHaveLength(1);
  return rings[0];
};
const noRing = () => document.querySelectorAll(`.${LANDING_PULSE_CLASS}, .${LANDING_RING_CLASS}`);

const pronouns = () => screen.getByPlaceholderText('she/her, he/him, it/its') as HTMLInputElement;
/** Clicks into a plain field and types, as two author actions. */
const typeIn = async (field: HTMLInputElement, text: string) => {
  await step(() => field.focus());
  await step(() => { fireEvent.change(field, { target: { value: text } }); });
};

const editorOf = (field: HTMLElement): LexicalEditor => {
  const found = getNearestEditorFromDOMNode(field);
  if (!found) throw new Error('no editor');
  return found;
};
/** Clicks into a chip field, then replaces its text through the composer as one edit. */
const typeInto = async (field: HTMLElement, text: string) => {
  await step(() => field.focus());
  await step(() => {
    editorOf(field).update(() => {
      $getRoot().clear().append($createParagraphNode().append($createTextNode(text)));
    }, { discrete: true });
  });
};
const textOf = (field: HTMLElement) => editorOf(field).getEditorState().read(() => $getRoot().getTextContent());

/** The prompt field under a visible label: its label names no editable, so the field is the nearest one below. */
const promptFieldUnder = (label: string): HTMLElement => {
  for (let at: HTMLElement | null = screen.getByText(label); at; at = at.parentElement) {
    const field = at.querySelector<HTMLElement>('[data-lexical-editor="true"]');
    if (field) return field;
  }
  throw new Error(`no field under ${label}`);
};

/** Leaves for another tab the way a click does: the tab's trigger takes focus. */
const leaveFor = async (tab: RegExp) => {
  const trigger = within(screen.getByRole('tablist', { name: 'Editor Sections' })).getByRole('tab', { name: tab });
  await step(() => {
    openEditorTab(tab);
    trigger.focus();
  });
  return trigger;
};

const openWick = (subTab?: RegExp) => {
  openEditorTab(/Entities/);
  fireEvent.click(screen.getAllByText('Odd Wick')[0]);
  if (subTab) fireEvent.mouseDown(screen.getByRole('tab', { name: subTab }));
};

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
});
let clock: { mockRestore(): void } | null = null;
afterEach(() => {
  clock?.mockRestore();
  clock = null;
  vi.unstubAllGlobals();
});

describe('the field pulse after undo and redo', () => {
  it('pulses the text field the author edited, after undo and after redo', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openWick();
    await typeIn(pronouns(), 'they/them');
    await leaveFor(/Stats/);

    await undo();
    expect(ctx().entities[0].pronouns).toBe('he/him');
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(ringed()).toContainElement(pronouns());

    await leaveFor(/Stats/);
    await redo();
    expect(pronouns().value).toBe('they/them');
    expect(ringed()).toContainElement(pronouns());
  });

  it('pulses the prompt field the author edited', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openWick(/Descriptions/);
    await typeInto(promptFieldUnder('AI-Facing Description'), 'Trims the wicks.');
    expect(ctx().entities[0].aiDescription).toBe('Trims the wicks.');
    await leaveFor(/Stats/);

    await undo();
    const field = promptFieldUnder('AI-Facing Description');
    expect(textOf(field)).toBe('Keeps the lamps.');
    expect(ringed()).toContainElement(field);
    expect(ringed()).not.toContainElement(promptFieldUnder('Player-Facing Description'));
  });

  it("pulses the edited row's field, not the first row's", async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Mood' }));
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Descriptors/ }));
    const [, second] = screen.getAllByRole('textbox', { name: 'Description' });
    await typeInto(second, 'Serene');
    expect(ctx().stats[0].descriptors!.map((d) => d.description)).toEqual(['Tense', 'Serene']);
    await leaveFor(/Entities/);

    await undo();
    const [first, restored] = screen.getAllByRole('textbox', { name: 'Description' });
    expect(textOf(restored)).toBe('Calm');
    expect(ringed()).toContainElement(restored);
    expect(ringed()).not.toContainElement(first);
  });

  it('opens the readme tab that holds the edited readme and pulses it', async () => {
    // With both readmes written, the Overview opens on the Introduction.
    const world = { ...WORLD, worldOverview: { ...WORLD.worldOverview, introReadme: 'Before setup.' } };
    const { ctx } = renderWorldEditorBench(world, 'advanced');
    openEditorTab(/Overview/);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Gameplay' }));
    await typeInto(screen.getByRole('textbox', { name: 'Readme (Gameplay)' }), 'A drowned primer.');
    await leaveFor(/Stats/);

    await undo();
    expect(ctx().worldOverview.readme).toBe('A fen primer.');
    expect(screen.getByRole('tab', { name: 'Gameplay' })).toHaveAttribute('aria-selected', 'true');
    expect(ringed()).toContainElement(screen.getByRole('textbox', { name: 'Readme (Gameplay)' }));
  });

  it('pulses a field that commits on blur, when the author moves straight to another field', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(screen.getAllByText('Weather', { selector: 'span' }).find((el) => !el.closest('button'))!);
    await typeInto(screen.getByRole('textbox', { name: 'Add keyword' }), 'mist');
    expect(ctx().placeholders[0].values.map((v) => v.text)).toEqual(['fog']);
    // The click into the name blurs the keyword box, which adds its keyword in the same task.
    await step(() => screen.getByPlaceholderText('e.g. Eye Color').focus());
    expect(ctx().placeholders[0].values.map((v) => v.text)).toEqual(['fog', 'mist']);
    await leaveFor(/Stats/);

    await undo();
    expect(ctx().placeholders[0].values.map((v) => v.text)).toEqual(['fog']);
    expect(ringed()).toContainElement(screen.getByRole('textbox', { name: 'Add keyword' }));
    expect(ringed()).not.toContainElement(screen.getByPlaceholderText('e.g. Eye Color'));
  });

  it('leaves focus on the element that held it before the undo', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openWick();
    await typeIn(pronouns(), 'they/them');
    const trigger = await leaveFor(/Stats/);

    await undo();
    expect(ringed()).toContainElement(pronouns());
    expect(document.activeElement).toBe(trigger);
  });

  it('ends the reveal at the selection, with no pulse, when the field is not rendered', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openWick(/Descriptions/);
    await typeInto(promptFieldUnder('AI-Facing Summary'), 'A drowned lamp-keeper.');
    // Simple mode has no summary field, so the field is gone while its entity and sub-tab remain.
    pickEditorMode('Simple');
    await leaveFor(/Locations/);

    await undo();
    await frames(40);
    expect(ctx().entities[0].aiSummary).toBe('A lamp-keeper.');
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(document.querySelector('[data-editor-row-selected]')).toHaveTextContent('Odd Wick');
    expect(screen.queryByText('AI-Facing Summary')).toBeNull();
    expect(noRing()).toHaveLength(0);
  });

  it('drops a landing still looking for its field when the next move names none', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openWick(/Descriptions/);
    // A write with no field in use, as a chip's popover makes.
    await step(() => ctx().updateEntity({ ...ctx().entities[0], playerDescription: 'The soaked lamp-keeper.' }));
    await typeInto(promptFieldUnder('AI-Facing Summary'), 'A drowned lamp-keeper.');
    pickEditorMode('Simple');
    await leaveFor(/Locations/);

    // The first undo looks for the summary, which Simple mode hides; the second names no field.
    await undo();
    await undo();
    expect(ctx().entities[0].playerDescription).toBe('The lamp-keeper.');
    pickEditorMode('Advanced');
    await frames(5);
    expect(screen.getByText('AI-Facing Summary')).toBeInTheDocument();
    expect(noRing()).toHaveLength(0);
  });

  it('restarts the pulse on a second quick undo, while the author is already on the field', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openWick();
    await typeIn(pronouns(), 'they');
    // Past the typing pause, so the second edit is its own Step.
    clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    await step(() => { fireEvent.change(pronouns(), { target: { value: 'they/them' } }); });

    const starts: Element[] = [];
    const observer = new MutationObserver((records) => records.forEach((record) => {
      const el = record.target as Element;
      if (el.classList.contains(LANDING_PULSE_CLASS) && !record.oldValue?.split(' ').includes(LANDING_PULSE_CLASS)) {
        starts.push(el);
      }
    }));
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    await undo();
    expect(pronouns().value).toBe('they');
    await undo();
    observer.disconnect();
    expect(pronouns().value).toBe('he/him');
    expect(starts).toHaveLength(2);
    expect(starts[1]).toContainElement(pronouns());
    expect(document.activeElement).toBe(pronouns());
  });

  it('draws the still ring under reduced motion', async () => {
    stubReducedMotion();
    renderWorldEditorBench(WORLD, 'advanced');
    openWick();
    await typeIn(pronouns(), 'they/them');
    await leaveFor(/Stats/);

    await undo();
    expect(ringed(LANDING_RING_CLASS)).toContainElement(pronouns());
    expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(0);
  });
});
