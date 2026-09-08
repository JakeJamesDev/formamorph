import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';

const openEnterWorld = async (page: Page) => {
  await openApp(page);
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });
  const worldId = await page.evaluate(async () => {
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
    await dev.putWorld(world);
    return id;
  });
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
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
