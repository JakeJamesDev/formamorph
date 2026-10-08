// The mid-game demo screen shared by the capture scripts: a prepared save of a bundled world, so the
// game view shows one fixed turn with no AI call. The save is served in place of the dev-fixture
// modules inside one browser context, so no tracked file changes and Vite's watcher never fires.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const ROOT = new URL('../../', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, ROOT), 'utf8'));

/** The scene file's shape: `location`, `entity`, `opening`, `action`, `narration`, `choices`. */
export async function prepareGame(context, scene, worldFile = 'src/defaultworlds/drone.json') {
  const world = readJson(worldFile);
  const location = world.locations.find((item) => item.name === scene.location);
  const entity = world.entities.find((item) => item.name === scene.entity);
  if (!location || !entity || !entity.locations.includes(location.id)) throw new Error('Capture scene does not match the world');
  location.backgroundImage ||= world.locations.find((item) => item.backgroundImage)?.backgroundImage;
  const state = {
    playerStats: world.stats.map((stat) => ({ ...stat, value: stat.starting })),
    playerTraits: [], visibleEntities: [{ name: entity.name, revealed: true }], discoveredEntities: [],
    logEntries: [], gameplayText: scene.narration, locationId: location.id, gameTime: 3,
    characterData: null, choices: scene.choices, isGameStarted: true, timestamp: new Date().toISOString(),
    worldName: world.worldOverview.name, playerNotes: '', previousStateIndex: 0, stateVersion: 2,
  };
  const openingState = { ...state, gameplayText: scene.opening, choices: [scene.action], gameTime: 0, previousStateIndex: null };
  const save = {
    currentState: state, stateHistory: [openingState, state], dictionaries: world.dictionaries,
    version: readJson('package.json').version,
    messageHistory: [
      { role: 'user', content: 'START GAME' },
      { role: 'assistant', content: JSON.stringify({
        narration: scene.opening, choices: [scene.action], entities: [entity.name],
        stat_changes: [], turnId: randomUUID(),
      }) },
      { role: 'user', content: scene.action },
      { role: 'assistant', content: JSON.stringify({
        narration: scene.narration, choices: scene.choices, entities: [entity.name],
        stat_changes: [], turnId: randomUUID(),
      }) },
    ],
  };
  // Replace only the capture browser's dev-fixture modules; the client and tracked fixtures stay intact.
  for (const [file, data] of [['whiteRoomWorld', world], ['whiteRoomSave', save]]) {
    await context.route(`**/src/lib/devFixtures/${file}.json*`, (route) => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(data)};`,
    }));
  }
  await context.route('**/chat/completions*', (route) => route.abort());
}

/** Throws when the game screen clips the scene's text or crowds the side-panel tabs. */
export async function verifyGame(page, scene) {
  if ((await page.getByTestId('action-line').textContent())?.trim() !== scene.action) {
    throw new Error('Gameplay capture rejected: submitted action does not match the scene');
  }
  const targets = [page.getByTestId('action-line'), page.getByTestId('narration'), page.getByTestId('action-input-wrap'),
    ...scene.choices.map((choice) => page.getByRole('button', { name: choice, exact: true })),
    page.getByRole('tabpanel').filter({ hasText: scene.entity }).getByText(scene.entity, { exact: true })];
  for (const target of targets) {
    const problem = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
      }
      return rect.width <= 0 || rect.height <= 0 || rect.left < left - 1 || rect.right > right + 1
        || rect.top < top - 1 || rect.bottom > bottom + 1 ? `clipped: ${element.textContent?.slice(0, 90)}` : null;
    });
    if (problem) throw new Error(`Gameplay capture rejected: ${problem}`);
  }
  const tabs = page.getByRole('tab', { name: /^(Entities|Notes|Memory|Logs)/ });
  if (await tabs.count() !== 4) throw new Error('Gameplay capture rejected: missing side-panel tabs');
  const badTabs = await tabs.evaluateAll((tabs) => tabs.filter((tab) => {
    const icon = tab.querySelector('svg')?.getBoundingClientRect();
    const label = tab.querySelector('span');
    if (!icon || !label) return true;
    const range = document.createRange(); range.selectNodeContents(label);
    const lines = [...range.getClientRects()];
    return lines.length !== 1 || icon.right > lines[0].left + 1 || label.scrollWidth > label.clientWidth + 1;
  }).map((tab) => tab.textContent));
  if (badTabs.length) throw new Error(`Gameplay capture rejected: crowded tabs: ${badTabs.join(', ')}`);
}
