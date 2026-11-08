// The mid-game demo screen shared by the capture scripts: a prepared save of a bundled world, so the
// game view shows one fixed turn with no AI call. The save is served in place of the dev-fixture
// modules inside one browser context, so no tracked file changes and Vite's watcher never fires.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const ROOT = new URL('../../', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, ROOT), 'utf8'));

/**
 * The scene file's shape: `location`, `entity`, `opening`, `choices`, and one `action` + `narration` or a `turns` list of them.
 * Optional: `items`, `[name, quantity]` pairs the player carries; `noGlobalStats`, so the Stats tab shows only the player's.
 * `source` is a world file path or a world already built. `openingOnly` saves the opening page alone.
 */
export async function prepareGame(context, scene, source = 'src/defaultworlds/drone.json', { openingOnly = false } = {}) {
  const world = typeof source === 'string' ? readJson(source) : structuredClone(source);
  const location = world.locations.find((item) => item.name === scene.location);
  const entity = world.entities.find((item) => item.name === scene.entity);
  if (!location || !entity || !entity.locations.includes(location.id)) throw new Error('Capture scene does not match the world');
  const itemCopies = (scene.items ?? []).map(([name, quantity]) => {
    const item = world.items?.find((candidate) => candidate.name === name);
    if (!item) throw new Error(`Capture scene item is not in the world: ${name}`);
    return { id: randomUUID(), item: { kind: 'item', itemId: item.id }, where: { kind: 'you' }, quantity, visibility: 'visible' };
  });
  location.backgroundImage ||= world.locations.find((item) => item.backgroundImage)?.backgroundImage;
  // The dev boot starts a fresh game before it loads the save, and a written opening lands over the save.
  for (const item of world.locations) item.openings = [];
  world.worldOverview.openings = [];
  const sceneTurns = scene.turns ?? [{ action: scene.action, narration: scene.narration }];
  const turns = openingOnly ? [] : sceneTurns;
  const base = {
    globalStats: scene.noGlobalStats ? [] : world.stats.map((stat) => ({ ...stat, value: stat.starting ?? stat.value })),
    ...(itemCopies.length && { itemCopies }),
    globalTraits: [], visibleEntities: [{ name: entity.name, revealed: true }], discoveredEntities: [],
    logEntries: [], locationId: location.id, characterData: null, isGameStarted: true,
    timestamp: new Date().toISOString(), worldName: world.worldOverview.name, playerNotes: '', stateVersion: 2,
  };
  // State 0 is the opening; state i is the result of turn i. Each page offers the next turn's action.
  const stateHistory = [
    { ...base, gameplayText: scene.opening, choices: [sceneTurns[0].action], gameTime: 0, previousStateIndex: null },
    ...turns.map((turn, i) => ({
      ...base, gameplayText: turn.narration, gameTime: i === turns.length - 1 ? Math.max(3, turns.length) : i + 1, previousStateIndex: i,
      choices: i === turns.length - 1 ? scene.choices : [turns[i + 1].action],
    })),
  ];
  const state = stateHistory[stateHistory.length - 1];
  const reply = (narration, choices) => ({ role: 'assistant', content: JSON.stringify({
    narration, choices, entities: [entity.name], stat_changes: [], turnId: randomUUID(),
  }) });
  const save = {
    currentState: state, stateHistory, dictionaries: world.dictionaries,
    version: readJson('package.json').version,
    messageHistory: [
      { role: 'user', content: 'START GAME' }, reply(scene.opening, [sceneTurns[0].action]),
      ...turns.flatMap((turn, i) => [{ role: 'user', content: turn.action }, reply(turn.narration, stateHistory[i + 1].choices)]),
    ],
  };
  // Replace only the capture browser's dev-fixture modules; the client and tracked fixtures stay intact.
  for (const [file, data] of [['whiteRoomWorld', world], ['whiteRoomSave', save]]) {
    await context.route(`**/src/lib/devFixtures/${file}.json*`, (route) => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(data)};`,
    }));
  }
  // Background passes get an empty successful reply: a failed call raises the endpoint error dialog over the frame.
  await context.route('**/chat/completions*', (route) => {
    const stream = /"stream"\s*:\s*true/.test(route.request().postData() ?? '');
    const message = { role: 'assistant', content: '{}' };
    return stream
      ? route.fulfill({ contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ choices: [{ index: 0, delta: message, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n` })
      : route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ choices: [{ index: 0, message, finish_reason: 'stop' }] }) });
  });
}

/** Throws when any target is missing, empty or clipped by a scrolling or clipping ancestor. */
export async function assertUnclipped(targets, label) {
  for (const target of targets) {
    if (!(await target.count())) throw new Error(`${label} rejected: missing: ${target}`);
    const problem = await target.first().evaluate((element) => {
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
    if (problem) throw new Error(`${label} rejected: ${problem}`);
  }
}

/** Throws when the game screen clips the scene's text or crowds the side-panel tabs. */
export async function verifyGame(page, scene) {
  if ((await page.getByTestId('action-line').textContent())?.trim() !== scene.action) {
    throw new Error('Gameplay capture rejected: submitted action does not match the scene');
  }
  await assertUnclipped([page.getByTestId('action-line'), page.getByTestId('narration'), page.getByTestId('action-input-wrap'),
    ...scene.choices.map((choice) => page.getByRole('button', { name: choice, exact: true })),
    page.getByRole('tabpanel').filter({ hasText: scene.entity }).getByText(scene.entity, { exact: true })], 'Gameplay capture');
  const tabs = page.getByRole('tab', { name: /^(Entities|Notes|Memory|Logs)/ });
  if (await tabs.count() !== 4) throw new Error('Gameplay capture rejected: missing side-panel tabs');
  // The strip folds the other tabs to icons, so only the selected tab must show its label.
  const badTabs = await tabs.evaluateAll((tabs) => tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true').filter((tab) => {
    const icon = tab.querySelector('svg')?.getBoundingClientRect();
    const label = tab.querySelector('span span');
    if (!icon || !label) return true;
    const range = document.createRange(); range.selectNodeContents(label);
    const lines = [...range.getClientRects()];
    return lines.length !== 1 || icon.right > lines[0].left + 1 || label.scrollWidth > label.clientWidth + 1;
  }).map((tab) => tab.textContent));
  if (badTabs.length) throw new Error(`Gameplay capture rejected: crowded tabs: ${badTabs.join(', ')}`);
}
