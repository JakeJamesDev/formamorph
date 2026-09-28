import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, openTraitFieldsTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The Traits tab's system nodes: adding and removing Templates, the Custom Persona entity's node, and Basic visibility. */

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

const BARE: World = benchEditorWorld({
  traits: [{ id: 't-brave', name: 'Brave', statChanges: [] }],
} as Partial<World>);

const FULL: World = benchEditorWorld({
  traits: [
    { id: 't-brave', name: 'Brave', statChanges: [] },
    { id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'g-templates' },
    { id: 't-wizard', name: 'Wizard', statChanges: [], groupId: 'g-templates' },
  ],
  traitGroups: [{ id: 'g-templates', name: 'Templates', parentId: null, system: 'templates' }],
  entities: [{ id: 'e-you', name: 'Wanderer', customPersona: true, traitLinks: [
    { id: 'l-paladin', originalId: 't-paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 0 },
    { id: 'l-wizard', originalId: 't-wizard', kind: 'trait', originalName: 'Wizard', groupId: null, order: 1 },
  ] }],
} as Partial<World>);
const marked = (ctx: () => { entities: World['entities'] }) => ctx().entities.find((e) => e.id === 'e-you')!;

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
const openAddMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Add to Traits' }));

/** A tree row found by its drag grip, so the panel's own copy of the name never matches. */
const treeRow = (name: string) => screen.queryAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name));

const confirm = () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));

beforeEach(() => { localStorage.clear(); });

describe('the + menu', () => {
  it('adds a Templates group at most once', () => {
    const { ctx } = renderWorldEditorBench(BARE, 'advanced');
    openTab(/Traits/);
    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Add Templates Group' }));
    expect(ctx().traitGroups).toEqual([expect.objectContaining({ name: 'Templates', parentId: null, system: 'templates' })]);
    expect(treeRow('Templates')).toHaveTextContent(/Not offered/);

    openAddMenu();
    expect(screen.queryByRole('button', { name: 'Add Templates Group' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Group' })).toBeInTheDocument();
  });

  it('offers no Templates group in Basic', () => {
    renderWorldEditorBench(BARE, 'simple');
    openTab(/Traits/);
    openAddMenu();
    expect(screen.queryByRole('button', { name: 'Add Templates Group' })).toBeNull();
  });
});

describe('removing a system node', () => {
  it('removes Templates after a confirmation that its traits become offered, moving them to the top level', () => {
    const { ctx } = renderWorldEditorBench(FULL, 'advanced');
    openTab(/Traits/);
    const templates = treeRow('Templates')!;
    expect(within(templates).queryByRole('button', { name: 'Duplicate' })).toBeNull();
    fireEvent.click(within(templates).getByRole('button', { name: 'Remove Templates' }));
    expect(screen.getByText('Its traits move to the top level, where the player can pick them.')).toBeInTheDocument();
    confirm();
    expect(ctx().traitGroups).toEqual([]);
    expect(ctx().traits.find((t) => t.id === 't-paladin')?.groupId).toBeNull();
  });

  it('removes an empty Templates group without asking', () => {
    const { ctx } = renderWorldEditorBench({ ...FULL, traits: BARE.traits }, 'advanced');
    openTab(/Traits/);
    fireEvent.click(within(treeRow('Templates')!).getByRole('button', { name: 'Remove Templates' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ctx().traitGroups).toEqual([]);
  });

  it("removes a link from the Custom Persona entity's node alone, leaving the originals", () => {
    const { ctx } = renderWorldEditorBench(FULL, 'advanced');
    openTab(/Traits/);
    expect(treeRow('Wanderer')).toBeDefined();
    const link = screen.getAllByLabelText('Drag to reorder or nest')
      .map((grip) => grip.parentElement as HTMLElement)
      .find((row) => within(row).queryByRole('button', { name: 'Open Paladin' }))!;
    fireEvent.click(within(link).getByRole('button', { name: 'Remove Link' }));
    expect(marked(ctx).traitLinks?.map((l) => l.id)).toEqual(['l-wizard']);
    expect(ctx().traits).toHaveLength(3);
  });

  it("writes a Custom Persona entity link's own default as an override against the original's value", () => {
    const { ctx } = renderWorldEditorBench(FULL, 'advanced');
    openTab(/Traits/);
    const link = screen.getAllByLabelText('Drag to reorder or nest')
      .map((grip) => grip.parentElement as HTMLElement)
      .find((row) => within(row).queryByRole('button', { name: 'Open Paladin' }))!;
    fireEvent.click(within(link).getByText('Paladin'));
    openTraitFieldsTab('Availability');
    const section = screen.getByText('This Link').closest('section')!;
    expect(within(section).getByText('Selected when a new game starts')).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('checkbox'));
    expect(marked(ctx).traitLinks?.[0].overrides).toEqual({ 't-paladin': { isDefault: { value: true, blueprint: false } } });
  });
});

describe('system nodes in Basic', () => {
  it("shows Templates and the Custom Persona entity's node, still editable", () => {
    const { ctx } = renderWorldEditorBench(FULL, 'simple');
    openTab(/Traits/);
    expect(treeRow('Templates')).toBeDefined();
    const link = screen.getAllByLabelText('Drag to reorder or nest')
      .map((grip) => grip.parentElement as HTMLElement)
      .find((row) => within(row).queryByRole('button', { name: 'Open Paladin' }))!;
    fireEvent.click(within(link).getByRole('button', { name: 'Remove Link' }));
    expect(marked(ctx).traitLinks?.map((l) => l.id)).toEqual(['l-wizard']);
  });

  it('hides an empty Templates group and a Custom Persona entity that bears nothing', () => {
    renderWorldEditorBench({ ...BARE, traitGroups: FULL.traitGroups, entities: [{ id: 'e-you', name: 'Wanderer', customPersona: true }] }, 'simple');
    openTab(/Traits/);
    expect(treeRow('Brave')).toBeDefined();
    expect(treeRow('Templates')).toBeUndefined();
    expect(treeRow('Wanderer')).toBeUndefined();
  });
});
