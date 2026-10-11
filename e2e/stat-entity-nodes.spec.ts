import { test, expect, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';
import { IN_TAB_PANEL, editorGrip, editorRow, rowIndents, rowLabels } from './dragSampling';

/**
 * Entity nodes in the Stats tree, dragged with the real mouse: a node into a world group, a Blueprint stat linked
 * into an entity, a top-level group moved into one, and moves refused with a note. jsdom has no layout, so where
 * a drop lands is only real here.
 */

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
  getWorld(id: string): Promise<StoredWorld>;
}

interface StoredWorld {
  stats: Array<{ id: string }>;
  statGroups: Array<{ id: string }>;
  entities: Array<{
    id: string;
    stats?: Array<{ id: string; groupId?: string | null }>;
    statGroups?: Array<{ id: string }>;
    statLinks?: Array<{ originalId: string }>;
    statPlacement?: { groupId: string | null; order: number };
  }>;
}

const ROOT = IN_TAB_PANEL;
const INDENT = 24;
const ROOT_PADDING = 8;

const stat = (id: string, name: string, groupId: string | null, order: number) =>
  ({ id, name, type: 'number', description: '', value: 10, min: 0, max: 20, regen: 0, descriptors: [], groupId, order });

const WORLD = {
  id: 'e2e-stat-entity-nodes',
  worldOverview: { name: 'E2E Stat Entity Nodes', description: '', author: '' },
  locations: [],
  statUpdates: [],
  traits: [],
  statGroups: [
    { id: 'g-companions', name: 'Companions', parentId: null, order: 0 },
    { id: 'g-mind', name: 'Mind', parentId: null, order: 1 },
    { id: 'g-blueprints', name: 'Blueprints', parentId: null, order: 2, system: 'blueprints' },
  ],
  stats: [stat('s-wits', 'Wits', 'g-mind', 0), stat('s-trust', 'Trust', 'g-blueprints', 0), stat('s-fear', 'Fear', 'g-blueprints', 1)],
  entities: [
    { id: 'ash', name: 'Ash', type: 'Creature', stats: [stat('s-grit', 'Grit', null, 0)] },
    { id: 'bob', name: 'Bob', type: 'Person', stats: [stat('s-nerve', 'Nerve', null, 0)] },
  ],
};

async function openStats(page: Page, world: unknown = WORLD): Promise<void> {
  await openApp(page);
  await page.evaluate(async (w) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(w));
  }, world);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'stats' });
  await expect(editorRow(page, ROOT, 'Ash')).toBeVisible();
}

/** Drag a row's grip onto another row, `levels` indents right of where it started. */
async function dragOnto(page: Page, label: string, target: string, levels: number): Promise<void> {
  const grip = editorGrip(page, ROOT, label);
  const from = (await grip.boundingBox())!;
  const x = from.x + from.width / 2;
  const y = from.y + from.height / 2;
  const before = (await editorRow(page, ROOT, target).boundingBox())!;
  const dx = levels * INDENT;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + Math.sign(before.y - y) * 8);
  // A dragged group hides its children once the drag starts, so the rows below it move up.
  await page.waitForTimeout(100);
  const to = (await editorRow(page, ROOT, target).boundingBox())!;
  const dy = to.y + to.height / 2 - y;
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x + (dx * i) / 12, y + (dy * i) / 12);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(200);
}

async function tree(page: Page): Promise<string[]> {
  const [labels, indents] = await Promise.all([rowLabels(page, ROOT), rowIndents(page, ROOT)]);
  return labels.map((l, i) => `${'-'.repeat(Math.round((indents[i] - ROOT_PADDING) / INDENT))}${l}`);
}

async function saved(page: Page): Promise<StoredWorld> {
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await save.click();
  await expect(save).toBeDisabled();
  return page.evaluate(async (id) => (window as unknown as { __fmDev: DevRouter }).__fmDev.getWorld(id), WORLD.id);
}

const BLUEPRINT_ROWS = ['Blueprints', '-Trust', '-Fear'];

test('an entity node drags into a world group, and a Blueprint stat dropped on it becomes a link', async ({ page }) => {
  await openStats(page);
  expect(await tree(page)).toEqual(['Companions', 'Mind', '-Wits', ...BLUEPRINT_ROWS, 'Ash', '-Grit', 'Bob', '-Nerve']);

  // Onto Mind, one level in: Ash lands inside Companions, above Mind.
  await dragOnto(page, 'Ash', 'Mind', 1);
  expect(await tree(page)).toEqual(['Companions', '-Ash', '--Grit', 'Mind', '-Wits', ...BLUEPRINT_ROWS, 'Bob', '-Nerve']);

  // Onto Grit: Ash links Trust, and Trust stays in Blueprints.
  await dragOnto(page, 'Trust', 'Grit', 1);
  expect(await tree(page)).toEqual(['Companions', '-Ash', '--Trust', '--Grit', 'Mind', '-Wits', ...BLUEPRINT_ROWS, 'Bob', '-Nerve']);

  const world = await saved(page);
  const ash = world.entities.find((e) => e.id === 'ash')!;
  expect(ash.statPlacement).toEqual({ groupId: 'g-companions', order: 0 });
  expect(ash.stats?.map((s) => s.id)).toEqual(['s-grit']);
  expect(ash.statLinks?.map((l) => l.originalId)).toEqual(['s-trust']);
  expect(world.stats.map((s) => s.id)).toContain('s-trust');
});

test('a second link to one Blueprint is refused with a note', async ({ page }) => {
  await openStats(page);
  // A drag down onto Grit lands below it.
  await dragOnto(page, 'Trust', 'Grit', 1);
  expect(await tree(page)).toEqual(['Companions', 'Mind', '-Wits', ...BLUEPRINT_ROWS, 'Ash', '-Grit', '-Trust', 'Bob', '-Nerve']);

  // Trust again: Ash already has it. The first Trust row is the Blueprint.
  await dragOnto(page, 'Trust', 'Grit', 1);
  // dnd-kit's live regions are statuses too, so the note is found by its own wording.
  const note = page.getByRole('status').filter({ hasText: 'already links' });
  await expect(note).toHaveText('Ash already links Trust.Dismiss');
  expect(await tree(page)).toEqual(['Companions', 'Mind', '-Wits', ...BLUEPRINT_ROWS, 'Ash', '-Grit', '-Trust', 'Bob', '-Nerve']);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(note).toHaveCount(0);
});

test("an entity node never nests inside another entity's node", async ({ page }) => {
  await openStats(page);
  const before = await tree(page);
  // Onto Grit: the rows below would hold Bob inside Ash's node, so the drop goes nowhere.
  await dragOnto(page, 'Bob', 'Grit', 1);
  expect(await tree(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Save', exact: true }), 'the drop should write nothing').toBeDisabled();
});

test('a top-level group dragged onto an entity moves into it with its stats, ids kept', async ({ page }) => {
  await openStats(page);
  // Onto Ash's node, one level in: Mind lands inside it.
  await dragOnto(page, 'Mind', 'Ash', 1);
  const rows = await tree(page);
  expect(rows.slice(rows.indexOf('Ash'), rows.indexOf('Bob'))).toEqual(expect.arrayContaining(['-Mind', '--Wits', '-Grit']));

  const world = await saved(page);
  const ash = world.entities.find((e) => e.id === 'ash')!;
  expect(ash.statGroups?.map((g) => g.id)).toEqual(['g-mind']);
  expect(ash.stats?.find((s) => s.id === 's-wits')?.groupId).toBe('g-mind');
  expect(world.statGroups.map((g) => g.id)).not.toContain('g-mind');
  expect(world.stats.map((s) => s.id)).not.toContain('s-wits');
});

test('a group whose stat a world trait changes stays, with a note naming the trait', async ({ page }) => {
  await openStats(page, { ...WORLD, traits: [{ id: 't-brave', name: 'Brave', statChanges: [{ statId: 's-wits', value: 2, type: 'max' }] }] });
  const before = await tree(page);
  await dragOnto(page, 'Mind', 'Ash', 1);
  const note = page.getByRole('status').filter({ hasText: 'stays' });
  await expect(note).toHaveText('Wits stays a world stat, because Brave changes it. Remove that stat change first.Dismiss');
  expect(await tree(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Save', exact: true }), 'the refused drop should write nothing').toBeDisabled();
});
