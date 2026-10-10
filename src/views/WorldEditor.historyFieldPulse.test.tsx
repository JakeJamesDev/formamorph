import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { $createParagraphNode, $createTextNode, $getRoot, getNearestEditorFromDOMNode, type LexicalEditor } from 'lexical';
import {
  benchEditorWorld, openEditorTab, openTraitFieldsTab, pickEditorMode, renderWorldEditorBench, shownEditorTab,
} from '@/test/worldEditorBench';
import { frames } from '@/test/landing';
import { stubReducedMotion } from '@/test/reducedMotion';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
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

const CHIP = encodePlaceholderToken({ id: 'weather', mode: 'world', placementId: 'p1' });
const CONTROL_WORLD: World = benchEditorWorld({
  stats: [{ id: 's-mood', name: 'Mood', type: 'number', description: 'How calm', min: 0, max: 10, value: 4, regen: 0 }],
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true },
    { id: 'docks', name: 'Docks' },
  ],
  entities: [{
    id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: `Keeps lamps in ${CHIP}.`,
    locations: ['harbor'],
  }],
  traits: [{ id: 't-calm', name: 'Calm', statChanges: [{ statId: 's-mood', value: 2, type: 'starting' }], groupId: null, order: 0 }],
  placeholders: [{ id: 'weather', name: 'Weather', values: phValues(['fog', 'rain']) }],
} as Partial<World>);

/** A press, its release and its click as three author actions, without focus: some browsers don't focus a pressed button. */
const clickOn = async (control: HTMLElement) => {
  await step(() => { fireEvent.pointerDown(control); });
  await step(() => { fireEvent.pointerUp(control); });
  await step(() => { fireEvent.click(control); });
};

/** Picks an option from a select by keyboard: a click needs pointer capture, which jsdom lacks. */
const pickOption = async (select: HTMLElement, option: string) => {
  await step(() => select.focus());
  await step(() => { fireEvent.keyDown(select, { key: 'Enter' }); });
  await step(() => { fireEvent.keyDown(screen.getByRole('option', { name: option }), { key: 'Enter' }); });
};

describe('the field pulse on controls and chips', () => {
  it('pulses a checkbox, and the switch it stands for', async () => {
    const { ctx } = renderWorldEditorBench(CONTROL_WORLD, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Mood' }));
    await clickOn(screen.getByRole('checkbox', { name: 'Hidden' }));
    expect(ctx().stats[0].hidden).toBe(true);
    const trigger = await leaveFor(/Entities/);

    await undo();
    expect(ctx().stats[0].hidden).toBeFalsy();
    expect(shownEditorTab()).toMatch(/Stats/);
    expect(ringed()).toContainElement(screen.getByRole('checkbox', { name: 'Hidden' }));
    expect(ringed()).not.toContainElement(screen.getByRole('checkbox', { name: 'Enabled' }));
    expect(document.activeElement).toBe(trigger);

    await leaveFor(/Entities/);
    await redo();
    expect(ctx().stats[0].hidden).toBe(true);
    expect(ringed()).toContainElement(screen.getByRole('checkbox', { name: 'Hidden' }));
  });

  it('keeps the field a press leaves, when that field commits on blur', async () => {
    const { ctx } = renderWorldEditorBench(CONTROL_WORLD, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(screen.getAllByText('Weather', { selector: 'span' }).find((el) => !el.closest('button'))!);
    await typeInto(screen.getByRole('textbox', { name: 'Add keyword' }), 'mist');
    // A real press: down, the old field blurs and commits, the new control takes focus, up, click.
    const object = screen.getByRole('radio', { name: 'Object' });
    await step(() => { fireEvent.pointerDown(object); });
    await step(() => object.focus());
    await step(() => { fireEvent.pointerUp(object); });
    await step(() => { fireEvent.click(object); });
    expect(ctx().placeholders[0].values.map((v) => v.text)).toEqual(['fog', 'rain', 'mist']);
    expect(ctx().placeholders[0].roll).toBe(false);

    await undo();
    expect(ctx().placeholders[0].roll).not.toBe(false);
    expect(ringed()).toContainElement(screen.getByRole('radio', { name: 'Object' }));

    await undo();
    expect(ctx().placeholders[0].values.map((v) => v.text)).toEqual(['fog', 'rain']);
    expect(ringed()).toContainElement(screen.getByRole('textbox', { name: 'Add keyword' }));
  });

  it("pulses the edited row's select, not its neighbor's", async () => {
    const { ctx } = renderWorldEditorBench(CONTROL_WORLD, 'advanced');
    openEditorTab(/Traits/);
    fireEvent.click(screen.getAllByText('Calm', { exact: true })[0]);
    openTraitFieldsTab('Stats');
    const section = () => screen.getByText('Stat Changes').closest<HTMLElement>('[data-tour-anchor]')!;
    await pickOption(within(section()).getAllByRole('combobox')[1], 'Max');
    expect(ctx().traits[0].statChanges[0].type).toBe('max');
    // The option list closes, and Radix hands the page back, a few frames later.
    await frames(5);
    expect(screen.queryByRole('listbox')).toBeNull();
    const trigger = await leaveFor(/Stats/);
    expect(document.activeElement).toBe(trigger);

    await undo();
    expect(ctx().traits[0].statChanges[0].type).toBe('starting');
    expect(shownEditorTab()).toMatch(/Traits/);
    const [stat, type] = within(section()).getAllByRole('combobox');
    expect(ringed()).toContainElement(type);
    expect(ringed()).not.toContainElement(stat);
    expect(document.activeElement).toBe(trigger);
  });

  it('pulses a segmented choice', async () => {
    const { ctx } = renderWorldEditorBench(CONTROL_WORLD, 'advanced');
    openWick();
    const before = ctx().entities[0].persona;
    await clickOn(screen.getByRole('radio', { name: 'Playable' }));
    expect(ctx().entities[0].persona).not.toBe(before);
    const trigger = await leaveFor(/Stats/);

    await undo();
    expect(ctx().entities[0].persona).toBe(before);
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(ringed()).toContainElement(screen.getByRole('radio', { name: 'Cast' }));
    expect(document.activeElement).toBe(trigger);
  });

  it('pulses the host prompt field after a chip pop-out edit', async () => {
    const { ctx } = renderWorldEditorBench(CONTROL_WORLD, 'advanced');
    openWick(/Descriptions/);
    await clickOn(within(promptFieldUnder('AI-Facing Description')).getByText('Weather'));
    await clickOn(screen.getByRole('radio', { name: 'Unique' }));
    expect(ctx().entities[0].aiDescription).not.toBe(`Keeps lamps in ${CHIP}.`);
    const trigger = await leaveFor(/Stats/);

    await undo();
    expect(ctx().entities[0].aiDescription).toBe(`Keeps lamps in ${CHIP}.`);
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(ringed()).toContainElement(promptFieldUnder('AI-Facing Description'));
    expect(ringed()).not.toContainElement(promptFieldUnder('Player-Facing Description'));
    expect(document.activeElement).toBe(trigger);
  });

  it('reveals a canvas edit with no pulse', async () => {
    vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
    const { ctx } = renderWorldEditorBench(CONTROL_WORLD, 'advanced');
    openEditorTab(/Locations/);
    fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));
    fireEvent.click(document.querySelector('.react-flow__node[data-id="harbor"]')!);
    // The author's caret rests in the location's name while they drag a node.
    await step(() => screen.getByRole('textbox', { name: 'Name' }).focus());
    const pane = document.querySelector('.react-flow__pane')!;
    await step(() => { fireEvent.pointerDown(pane); });
    await step(() => { fireEvent.pointerUp(pane); });
    // The drop commits through the world; jsdom cannot drag a node.
    await step(() => ctx().updateLocation({ ...ctx().locations[1], parentId: 'harbor' }));
    expect(ctx().locations[1].parentId).toBe('harbor');
    await step(() => openEditorTab(/Stats/));

    await undo();
    await frames(40);
    expect(ctx().locations[1].parentId).toBeUndefined();
    expect(shownEditorTab()).toMatch(/Locations/);
    expect(document.querySelector('.react-flow')).not.toBeNull();
    expect(noRing()).toHaveLength(0);
  });
});
