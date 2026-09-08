import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';
import { dragBy, editorGrip, IN_DIALOG, ROW_STEP, rowLabels } from './dragSampling';

const archiveDictionaryNames = Array.from({ length: 8 }, (_, index) => `Archive Volume ${index + 1}`);

const openEnterWorld = async (page: Page) => {
  await openApp(page);
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });
  const worldId = await page.evaluate(async (archiveNames) => {
    interface DevRouter {
      listWorlds(): Promise<{ id: string; name: string }[]>;
      getWorld(id: string): Promise<unknown>;
      putWorld(world: unknown): Promise<string>;
    }
    interface SeedWorld {
      id?: string;
      worldOverview?: Record<string, unknown>;
      traitGroups?: unknown[];
      traits?: unknown[];
      dictionaries?: unknown[];
    }
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    const [firstWorld] = await dev.listWorlds();
    const world = await dev.getWorld(firstWorld.id) as SeedWorld;
    const id = firstWorld.id;
    const names = [
      'First Long Ancestry Layer',
      'Second Long Cultural Layer',
      'Third Long Community Layer',
      'Fourth Long Vocation Layer',
      'Fifth Long Practice Layer',
    ];
    world.id = id;
    world.worldOverview = {
      ...world.worldOverview,
      name: 'The Cartographer’s Exceptionally Long Test World',
    };
    world.traitGroups = names.map((name, index) => ({
      id: `deep-group-${index}`,
      name,
      parentId: index === 0 ? null : `deep-group-${index - 1}`,
      order: 0,
      exclusive: index === names.length - 1,
      playerDescription: 'A deliberately long player description that must wrap without widening the workspace or hiding its stable finish action.',
    }));
    world.traits = names.flatMap((name, index) => {
      const traits = [{
        id: `deep-trait-${index}`,
        name: `${name} Choice`,
        groupId: `deep-group-${index}`,
        order: 0,
        statChanges: [],
        playerDescription: 'This deliberately long choice description checks wrapping in the real Enter World content pane.',
      }];
      if (index === names.length - 1) {
        traits.push({
          id: 'deep-trait-alternate',
          name: 'Alternate Fifth-Level Practice',
          groupId: `deep-group-${index}`,
          order: 1,
          statChanges: [],
          playerDescription: 'A second radio choice proves one activation and draft retention after navigation.',
        });
      }
      return traits;
    });
    world.dictionaries = [
      { id: 'atlas', name: 'World Atlas', description: 'Routes from the authored world.', enabled: true, entries: [] },
      { id: 'hidden', name: 'Hidden Notes', description: 'A disabled book that retains its slot.', enabled: false, entries: [] },
      { id: 'third', name: 'Third Atlas', description: 'Another visible result for filtered ordering.', enabled: true, entries: [] },
      { id: 'last', name: 'Last Notes', description: 'The final complete-order boundary.', enabled: false, entries: [] },
      ...archiveNames.map((name, index) => ({
        id: `archive-${index + 1}`,
        name,
        description: 'A long archive description fills the detail viewport with realistic reading content. It preserves the complete record while the compact row keeps every action reachable. The repeated volumes also make the additions list overflow at both supported phone widths.',
        enabled: index % 2 === 0,
        entries: [],
      })),
    ];
    await dev.putWorld(world);
    return id;
  }, archiveDictionaryNames);
  await page.evaluate((id) => {
    window.location.hash = `#dev?modal=enterWorld&tab=${id}`;
  }, worldId);
  const introduction = page.getByRole('dialog', { name: 'Introduction' });
  const workspace = page.getByRole('dialog', { name: /^Enter / });
  await expect(introduction.or(workspace)).toBeVisible();
  if (await introduction.isVisible()) {
    await introduction.getByRole('button', { name: 'Close' }).click();
  }
  await expect(workspace).toBeVisible();
  return workspace;
};

test('filtered dictionary drag retains hidden slots and the draft enters the game', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'desktop exercises the existing split list and details boundary');
  await page.setViewportSize({ width: 1280, height: 800 });
  const workspace = await openEnterWorld(page);
  await workspace.getByRole('button', { name: 'Library Additions' }).click();

  const search = workspace.getByRole('searchbox', { name: 'Search Library Additions' });
  await search.fill('Atlas');
  expect(await rowLabels(page, IN_DIALOG)).toEqual(['World Atlas', 'Third Atlas']);

  await dragBy(page, editorGrip(page, IN_DIALOG, 'Third Atlas'), { dy: -ROW_STEP });
  expect(await rowLabels(page, IN_DIALOG)).toEqual(['Third Atlas', 'World Atlas']);

  await search.fill('');
  expect(await rowLabels(page, IN_DIALOG)).toEqual([
    'Third Atlas', 'Hidden Notes', 'World Atlas', 'Last Notes', ...archiveDictionaryNames,
  ]);
  await workspace.getByRole('button', { name: 'Inspect Third Atlas from World' }).click();
  const details = workspace.getByRole('region', { name: 'Addition Details' });
  await expect(details.getByText('Position 1 of 12')).toBeVisible();
  await expect(details.getByRole('button', { name: 'Move Third Atlas Up' })).toBeDisabled();
  await expect(workspace.getByRole('checkbox', { name: 'Enable Hidden Notes from World' })).not.toBeChecked();

  await workspace.getByRole('button', { name: 'Start game' }).click();
  await expect(workspace).toBeHidden();
});

for (const width of [360, 390]) {
  test(`phone Categories stays bounded and accessible at ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the disclosure only renders below the desktop breakpoint');
    await page.setViewportSize({ width, height: 800 });
    const workspace = await openEnterWorld(page);
    const disclosure = workspace.getByRole('button', { name: /^Categories/ });
    const panel = workspace.locator('#setup-category-tree');
    const finish = workspace.getByRole('button', { name: /^(Start game|Continue to Avatar)$/ });

    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(panel).toHaveAttribute('inert', '');
    await expect(panel).toBeHidden();
    await expect(finish).toBeVisible();

    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toHaveAttribute('aria-hidden', 'false');
    await expect(panel).not.toHaveAttribute('inert', '');
    await expect(panel).toBeVisible();
    const expandedPanel = await panel.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      limit: window.innerHeight * 0.45 + 1,
      transitionDuration: getComputedStyle(element).transitionDuration,
    }));
    expect(expandedPanel.transitionDuration).toBe('0.15s');
    expect(expandedPanel.height).toBeLessThanOrEqual(expandedPanel.limit);
    const deepestCategory = workspace.getByRole('button', { name: /Fifth Long Practice Layer/ });
    expect((await deepestCategory.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await panel.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe('none');

    await deepestCategory.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(disclosure).toBeFocused();
    await workspace.getByRole('radio', { name: 'Alternate Fifth-Level Practice' }).click();
    await disclosure.click();
    await expect(workspace.getByLabel('1 of 2 selected')).toHaveText('1/2');
    await workspace.getByRole('button', { name: 'Library Additions' }).click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(panel).toBeHidden();
    await expect(disclosure).toBeFocused();
    await expect(workspace.getByRole('heading', { name: 'Library Additions' })).toBeVisible();
    await expect(finish).toBeVisible();
    const list = workspace.locator('section[aria-label="Library Additions List"]');
    const listViewport = list.locator('[data-radix-scroll-area-viewport]');
    expect(await listViewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

    const inspect = workspace.getByRole('button', { name: 'Inspect Archive Volume 6 from World' });
    await inspect.scrollIntoViewIfNeeded();
    const listScroll = await listViewport.evaluate((element) => element.scrollTop);
    expect(listScroll).toBeGreaterThan(0);
    await inspect.click();

    await expect(list).toHaveAttribute('aria-hidden', 'true');
    await expect(list).toHaveAttribute('inert', '');
    const details = workspace.getByRole('region', { name: 'Addition Details' });
    await expect(details.getByRole('heading', { name: 'Archive Volume 6' })).toBeFocused();
    const detailsViewport = details.locator('[data-radix-scroll-area-viewport]');
    expect(await detailsViewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await detailsViewport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    expect(await detailsViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    await details.getByRole('button', { name: 'Back to Additions' }).click();
    await expect(list).toHaveAttribute('aria-hidden', 'false');
    await expect(list).not.toHaveAttribute('inert', '');
    await expect(inspect).toBeFocused();
    expect(await listViewport.evaluate((element) => element.scrollTop)).toBe(listScroll);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
