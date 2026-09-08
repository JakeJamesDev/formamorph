import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';
import { dragBy, editorGrip, IN_DIALOG, ROW_STEP, rowLabels } from './dragSampling';

const archiveDictionaryNames = Array.from({ length: 8 }, (_, index) => `Archive Volume ${index + 1}`);
const loadedArtwork = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="240"%3E%3Crect width="320" height="240" fill="%236b4f9b"/%3E%3Ccircle cx="160" cy="120" r="64" fill="%23f4d58d"/%3E%3C/svg%3E';

interface PaneFrame {
  t: number;
  heading: string;
  container: { left: number; right: number };
  list: { left: number; right: number };
  details: { left: number; right: number };
  covered: boolean;
  opaque: boolean;
}

declare global {
  interface Window {
    __enterWorldFrames?: PaneFrame[];
  }
}

const startPaneRecorder = (page: Page, duration = 280) => page.evaluate((recordingDuration) => {
  window.__enterWorldFrames = [];
  const started = performance.now();
  const tick = () => {
    const layout = document.querySelector<HTMLElement>('[data-testid="enter-world-library-layout"]');
    const list = layout?.querySelector<HTMLElement>('section[aria-label="Library Additions List"]');
    const details = layout?.querySelector<HTMLElement>('section[aria-label="Addition Details"]');
    if (layout && list && details) {
      const containerRect = layout.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const detailsRect = details.getBoundingClientRect();
      const covered = [0.15, 0.5, 0.85].every((position) => {
        const x = containerRect.left + containerRect.width * position;
        return (x >= listRect.left && x <= listRect.right) || (x >= detailsRect.left && x <= detailsRect.right);
      });
      const transparent = 'rgba(0, 0, 0, 0)';
      window.__enterWorldFrames!.push({
        t: Math.round(performance.now() - started),
        heading: details.querySelector('h3')?.textContent?.trim() ?? '',
        container: { left: containerRect.left, right: containerRect.right },
        list: { left: listRect.left, right: listRect.right },
        details: { left: detailsRect.left, right: detailsRect.right },
        covered,
        opaque: getComputedStyle(list).backgroundColor !== transparent
          && getComputedStyle(details).backgroundColor !== transparent,
      });
    }
    if (performance.now() - started < recordingDuration) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, duration);

const paneFrames = (page: Page) => page.evaluate(() => window.__enterWorldFrames ?? []);

const expectContinuousMotion = (frames: PaneFrame[], heading: string, direction: 'entry' | 'exit') => {
  const content = frames.filter((frame) => frame.heading === heading);
  expect(content.length).toBeGreaterThan(4);
  const traveling = content.filter((frame) => (
    frame.details.left > frame.container.left + 2 && frame.details.left < frame.container.right - 2
  ));
  expect(new Set(traveling.map((frame) => Math.round(frame.details.left))).size).toBeGreaterThanOrEqual(3);
  expect(content.every((frame) => frame.covered && frame.opaque)).toBe(true);
  if (direction === 'entry') {
    expect(content[0].details.left).toBeGreaterThanOrEqual(content[0].container.right - 2);
    expect(content[content.length - 1].details.left).toBeLessThanOrEqual(content[0].container.left + 2);
  } else {
    expect(content[0].details.left).toBeLessThanOrEqual(content[0].container.left + 2);
    expect(content[content.length - 1].details.left).toBeGreaterThanOrEqual(content[0].container.right - 2);
  }
};

const openEnterWorld = async (page: Page, settings: Record<string, unknown> = {}) => {
  await openApp(page, settings);
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });
  const worldId = await page.evaluate(async ({ archiveNames, artwork }) => {
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
      { id: 'atlas', name: 'World Atlas', description: 'Routes from the authored world.', thumbnail: artwork, enabled: true, entries: [] },
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
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('entitiesDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('entities', 'readwrite');
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        transaction.objectStore('entities').put({
          id: 'entry-test-entity',
          name: 'Mara Vale',
          createdAt: new Date(0).toISOString(),
          lastAccessed: new Date(0).toISOString(),
          data: {
            id: 'entry-test-entity',
            name: 'Mara Vale',
            playerDescription: 'A practiced guide whose longer record verifies entity and dictionary navigation in both directions.',
            images: [artwork],
          },
        });
      };
    });
    return id;
  }, { archiveNames: archiveDictionaryNames, artwork: loadedArtwork });
  await page.reload();
  await page.getByRole('heading', { name: 'The Cartographer’s Exceptionally Long Test World' })
    .waitFor({ state: 'visible' });
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

test('container thresholds preserve the library draft and inspected pane through resize', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'one desktop context crosses both measured container thresholds');
  await page.setViewportSize({ width: 1400, height: 900 });
  const workspace = await openEnterWorld(page, {
    FORMAMORPH_theme: 'light',
    FORMAMORPH_themeColor: 'purple',
    FORMAMORPH_fontFamily: 'lexend',
  });
  await workspace.getByRole('button', { name: /Fifth Long Practice Layer/ }).click();
  await workspace.getByRole('radio', { name: 'Alternate Fifth-Level Practice' }).click();
  expect(await page.locator('html').getAttribute('data-theme')).toBe('purple');
  expect(await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Lexend');
  expect(await workspace.evaluate((dialog) => dialog.getBoundingClientRect().width)).toBeGreaterThanOrEqual(72 * 16);
  expect(await workspace.getByRole('button', { name: /Categories/ }).count()).toBe(0);
  await workspace.getByRole('button', { name: 'Library Additions' }).click();

  const layout = workspace.getByTestId('enter-world-library-layout');
  const search = workspace.getByRole('searchbox', { name: 'Search Library Additions' });
  const list = workspace.getByRole('region', { name: 'Library Additions List' });
  const listViewport = list.locator('[data-radix-scroll-area-viewport]');
  await search.fill('Archive');
  await workspace.getByRole('checkbox', { name: 'Enable Archive Volume 2 from World' }).click();
  await listViewport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const heldScroll = await listViewport.evaluate((element) => element.scrollTop);
  await workspace.getByRole('button', { name: 'Inspect Archive Volume 6 from World' }).click();
  await expect(workspace.getByRole('heading', { name: 'Archive Volume 6' })).toBeFocused();
  await workspace.getByRole('button', { name: 'Move Archive Volume 6 Down' }).click();
  const heldPosition = await workspace.getByText(/^Position /).innerText();
  await expect(layout).toHaveAttribute('data-pane-mode', 'split');

  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(workspace.getByRole('button', { name: /Categories/ })).toBeVisible();
  await expect(layout).toHaveAttribute('data-pane-mode', 'split');
  await expect(search).toHaveValue('Archive');
  await expect(workspace.getByRole('checkbox', { name: 'Enable Archive Volume 2 from World' })).toBeChecked();
  await expect(workspace.getByText(heldPosition)).toBeVisible();
  expect(await listViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await page.setViewportSize({ width: 760, height: 900 });
  await expect(layout).toHaveAttribute('data-pane-mode', 'single');
  const details = workspace.getByRole('region', { name: 'Addition Details' });
  await expect(details.getByRole('heading', { name: 'Archive Volume 6' })).toBeVisible();
  await details.getByRole('button', { name: 'Back to Additions' }).click();
  await expect(search).toHaveValue('Archive');
  await expect(workspace.getByRole('button', { name: 'Inspect Archive Volume 6 from World' })).toBeFocused();
  expect(await listViewport.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(Math.min(heldScroll, 1));
  await expect(workspace.getByRole('button', { name: /^(Start game|Continue to Avatar)$/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await workspace.getByRole('button', { name: /Categories/ }).click();
  await workspace.getByRole('button', { name: /Fifth Long Practice Layer/ }).click();
  await expect(workspace.getByRole('radio', { name: 'Alternate Fifth-Level Practice' })).toBeChecked();
});

test('narrow detail entries paint continuously for first, same, and replacement content', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'a phone context exercises the retained overlay panes');
  await page.setViewportSize({ width: 390, height: 844 });
  const workspace = await openEnterWorld(page, { FORMAMORPH_theme: 'dark' });
  const categories = workspace.getByRole('button', { name: /Categories/ });
  await categories.click();
  await workspace.getByRole('button', { name: 'Library Additions' }).click();
  const details = workspace.locator('section[aria-label="Addition Details"]');

  for (const [index, name] of ['Archive Volume 6', 'Archive Volume 6', 'Mara Vale', 'World Atlas'].entries()) {
    await startPaneRecorder(page);
    await workspace.getByRole('button', { name: name === 'Mara Vale' ? `Inspect ${name}` : `Inspect ${name} from World` }).click();
    if (index === 0) {
      for (let frame = 1; frame <= 3; frame += 1) {
        await page.waitForTimeout(45);
        await testInfo.attach(`entry-${index + 1}-${name}-mid-${frame}`, { body: await page.screenshot(), contentType: 'image/png' });
      }
      await page.waitForTimeout(185);
    } else {
      await page.waitForTimeout(80);
      await testInfo.attach(`entry-${index + 1}-${name}-mid`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.waitForTimeout(240);
    }
    expectContinuousMotion(await paneFrames(page), name, 'entry');
    await expect(details.getByRole('heading', { name })).toBeFocused();
    await expect(details.locator('img')).toHaveCount(name === 'Archive Volume 6' ? 0 : 1);
    if (index === 0) await startPaneRecorder(page);
    await details.getByRole('button', { name: 'Back to Additions' }).click();
    await expect(workspace.getByRole('button', { name: name === 'Mara Vale' ? `Inspect ${name}` : `Inspect ${name} from World` })).toBeFocused();
    if (index === 0) {
      for (let frame = 1; frame <= 3; frame += 1) {
        await page.waitForTimeout(45);
        await testInfo.attach(`exit-archive-volume-6-mid-${frame}`, { body: await page.screenshot(), contentType: 'image/png' });
      }
      await page.waitForTimeout(185);
      expectContinuousMotion(await paneFrames(page), name, 'exit');
    } else {
      await page.waitForTimeout(240);
    }
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await workspace.getByRole('button', { name: 'Inspect Mara Vale' }).click();
  await expect(details.getByRole('heading', { name: 'Mara Vale' })).toBeFocused();
  expect(await details.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe('none');
  await details.getByRole('checkbox', { name: 'Include Mara Vale in This Game' }).click();
  await expect(details.getByRole('checkbox', { name: 'Include Mara Vale in This Game' })).toBeChecked();
  await details.getByRole('button', { name: 'Back to Additions' }).click();
  await expect(details).toHaveAttribute('inert', '');
  await expect(workspace.getByRole('region', { name: 'Library Additions List' })).not.toHaveAttribute('inert');
  await expect(workspace.getByRole('button', { name: 'Inspect Mara Vale' })).toBeFocused();
  await workspace.getByRole('button', { name: 'Inspect Mara Vale' }).click();
  await expect(details.getByRole('checkbox', { name: 'Include Mara Vale in This Game' })).toBeChecked();
  await expect(details).not.toHaveAttribute('inert');
  await testInfo.attach('reduced-motion-entity-detail', { body: await page.screenshot(), contentType: 'image/png' });
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
