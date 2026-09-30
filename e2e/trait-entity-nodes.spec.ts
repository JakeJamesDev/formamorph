import { test, expect, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';
import { IN_TAB_PANEL, editorGrip, editorRow, rowIndents, rowLabels } from './dragSampling';

/**
 * Entity nodes in the Traits tree, dragged with the real mouse: a node into a world group, a Blueprints trait
 * linked into an entity, a top-level group moved into one, and a second link refused with a note. jsdom has
 * no layout, so where a drop lands is only real here.
 */

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
  getWorld(id: string): Promise<StoredWorld>;
}

interface StoredWorld {
  traits: Array<{ id: string }>;
  traitGroups: Array<{ id: string }>;
  entities: Array<{
    id: string;
    traits?: Array<{ id: string; groupId?: string | null }>;
    traitGroups?: Array<{ id: string }>;
    traitLinks?: Array<{ originalId: string }>;
    traitPlacement?: { groupId: string | null; order: number };
  }>;
}

const ROOT = IN_TAB_PANEL;
const INDENT = 24;
const ROOT_PADDING = 8;

const WORLD = {
  id: 'e2e-trait-entity-nodes',
  worldOverview: { name: 'E2E Trait Entity Nodes', description: '', author: '' },
  locations: [],
  stats: [{ id: 'hp', name: 'Health', value: 10, min: 0, max: 20 }],
  statUpdates: [],
  traitGroups: [
    { id: 'g-companions', name: 'Companions', parentId: null, order: 0 },
    { id: 'g-bonds', name: 'Bonds', parentId: null, order: 1 },
    { id: 'g-blueprints', name: 'Blueprints', parentId: null, order: 2, system: 'blueprints' },
    { id: 'g-class', name: 'Class', parentId: 'g-blueprints', order: 0 },
  ],
  traits: [
    { id: 't-oath', name: 'Oathbound', groupId: 'g-bonds', order: 0, statChanges: [] },
    { id: 't-plate', name: 'Plate Armor', groupId: 'g-class', order: 0, statChanges: [{ statId: 'hp', value: 5, type: 'max' }] },
    { id: 't-knight', name: 'Knight', groupId: 'g-class', order: 1, statChanges: [] },
    { id: 't-guard', name: 'Royal Guard', groupId: 'g-class', order: 2, statChanges: [], requires: [{ kind: 'trait', id: 't-knight' }] },
  ],
  entities: [{
    id: 'ash', name: 'Ash', type: 'Creature',
    traits: [{ id: 't-tamed', name: 'Tamed', groupId: null, order: 0, statChanges: [] }],
  }, {
    id: 'bob', name: 'Bob', type: 'Person',
    traits: [{ id: 't-gruff', name: 'Gruff', groupId: null, order: 0, statChanges: [] }],
  }],
};

async function openTraits(page: Page): Promise<void> {
  await openApp(page);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(world));
  }, WORLD);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'traits' });
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

const BLUEPRINT_ROWS = ['Blueprints', '-Class', '--Plate Armor', '--Knight', '--Royal Guard'];

test('an entity node drags into a world group, and a Blueprints trait dropped on it becomes a link', async ({ page }) => {
  await openTraits(page);
  expect(await tree(page)).toEqual(['Companions', 'Bonds', '-Oathbound', ...BLUEPRINT_ROWS, 'Ash', '-Tamed', 'Bob', '-Gruff']);

  // Onto Bonds, one level in: Ash lands inside Companions, above Bonds.
  await dragOnto(page, 'Ash', 'Bonds', 1);
  expect(await tree(page)).toEqual(['Companions', '-Ash', '--Tamed', 'Bonds', '-Oathbound', ...BLUEPRINT_ROWS, 'Bob', '-Gruff']);

  // Onto Tamed: Ash links Knight, and Knight stays in Class.
  await dragOnto(page, 'Knight', 'Tamed', 1);
  expect(await tree(page)).toEqual(['Companions', '-Ash', '--Knight', '--Tamed', 'Bonds', '-Oathbound', ...BLUEPRINT_ROWS, 'Bob', '-Gruff']);

  const world = await saved(page);
  const ash = world.entities.find((e) => e.id === 'ash')!;
  expect(ash.traitPlacement).toEqual({ groupId: 'g-companions', order: 0 });
  expect(ash.traits?.map((t) => t.id)).toEqual(['t-tamed']);
  expect(ash.traitLinks?.map((l) => l.originalId)).toEqual(['t-knight']);
  expect(world.traits.map((t) => t.id)).toContain('t-knight');
});

test('a Blueprints trait with stat effects links like any other, and a second link is refused with a note', async ({ page }) => {
  await openTraits(page);
  // Plate Armor at the top of the list keeps Tamed clear of the bottom edge, where the list auto-scrolls.
  await editorRow(page, ROOT, 'Plate Armor').first().evaluate((row) => row.scrollIntoView({ block: 'start' }));
  await dragOnto(page, 'Plate Armor', 'Tamed', -1);
  expect(await tree(page)).toEqual(['Companions', 'Bonds', '-Oathbound', ...BLUEPRINT_ROWS, 'Ash', '-Tamed', '-Plate Armor', 'Bob', '-Gruff']);

  // Plate Armor again: Ash already has it.
  await editorRow(page, ROOT, 'Plate Armor').first().evaluate((row) => row.scrollIntoView({ block: 'start' }));
  await dragOnto(page, 'Plate Armor', 'Tamed', -1);
  // dnd-kit's live regions are statuses too, so the note is found by its own wording.
  const note = page.getByRole('status').filter({ hasText: 'already has' });
  await expect(note).toHaveText('Ash already has Plate Armor.Dismiss');
  expect(await tree(page)).toEqual(['Companions', 'Bonds', '-Oathbound', ...BLUEPRINT_ROWS, 'Ash', '-Tamed', '-Plate Armor', 'Bob', '-Gruff']);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(note).toHaveCount(0);
});

test("an entity node never nests inside another entity's node", async ({ page }) => {
  await openTraits(page);
  const before = await tree(page);
  // Onto Tamed: the rows below would hold Bob inside Ash's node, so the drop goes nowhere.
  await dragOnto(page, 'Bob', 'Tamed', 1);
  expect(await tree(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Save', exact: true }), 'the drop should write nothing').toBeDisabled();
});

test('a top-level group dragged onto an entity moves into it with its traits', async ({ page }) => {
  await openTraits(page);
  // Onto Ash's node, one level in: Bonds lands inside it.
  await dragOnto(page, 'Bonds', 'Ash', 1);
  const rows = await tree(page);
  expect(rows).not.toContain('Bonds');
  expect(rows.slice(rows.indexOf('Ash'), rows.indexOf('Bob'))).toEqual(expect.arrayContaining(['-Bonds', '--Oathbound', '-Tamed']));

  const world = await saved(page);
  const ash = world.entities.find((e) => e.id === 'ash')!;
  expect(ash.traitGroups?.map((g) => g.id)).toEqual(['g-bonds']);
  expect(ash.traits?.find((t) => t.id === 't-oath')?.groupId).toBe('g-bonds');
  expect(ash).not.toHaveProperty('traitLinks');
  expect(world.traitGroups.map((g) => g.id)).not.toContain('g-bonds');
});
