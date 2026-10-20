/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTestCode, type StatCodeWorld } from './statCodeTestRun';
import { editorPromptRun } from './editorScriptPrompts';
import type { Stat, Trait } from '@/types';

const health: Stat = { id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const brave: Trait = { id: 'b', name: 'Brave', statChanges: [], groupId: 'g' };
const calm: Trait = { id: 'c', name: 'Calm', statChanges: [] };
const world: StatCodeWorld = {
  // Calm sits first in the list but after Brave in the tree, whose group holds Brave and sits first.
  stats: [health], statGroups: [], traits: [calm, brave], traitGroups: [{ id: 'g', name: 'Mood', parentId: null }],
  entities: [], entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [],
};

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('the clock Test Code hands each timing', () => {
  // Play gives every timing but After the AI the turn's start, with no hours behind it on the opening turn.
  it.each([
    ['before', 0], ['start', 0], ['output', 0], ['switch', 0], ['after', 1],
  ] as const)('reads %s with a delta of %i hours', async (timing, hours) => {
    const report = await runTestCode('stats.Health.value = clock.deltaHours + clock.elapsedHours;', timing, { kind: 'world' }, world, { sentence: 'A bell rings.' });
    expect(report.writes).toEqual([`stats.Health.value = ${hours * 2}`]);
  });
});

describe('Test Code on a During AI Output script', () => {
  it('rewrites the sample sentence and reports it, with the stubs read from it', async () => {
    const code = 'narration.sentence = narration.sentence.replace("door", "gate") + ` ${narration.index}/${narration.sent.length}/${narration.buffered.length}/${narration.full.length}`;';
    const report = await runTestCode(code, 'output', { kind: 'world' }, world, { sentence: 'The door opens.' });
    expect(report.error).toBeNull();
    expect(report.sentence).toBe('The gate opens. 0/0/0/15');
  });

  it('reports the sentence unchanged when the code leaves it alone', async () => {
    const report = await runTestCode('stats.Health.value = 10;', 'output', { kind: 'world' }, world, { sentence: 'A bell rings.' });
    expect(report.sentence).toBe('A bell rings.');
    expect(report.writes).toEqual(['stats.Health.value = 10']);
  });

  it('gives no sentence outside During AI Output', async () => {
    const report = await runTestCode('stats.Health.value = 10;', 'after', { kind: 'world' }, world, { sentence: 'A bell rings.' });
    expect(report.sentence).toBeUndefined();
  });
});

describe('Test Code on a When a Trait Switches script', () => {
  it('fires a stat or world script on the world’s first trait in tree order, switched on', async () => {
    const report = await runTestCode(
      'stats.Health.value = trait.name === "Brave" && trait.enabled && trait.owner === "" ? 70 : 10;', 'switch', { kind: 'world' }, world,
    );
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['stats.Health.value = 70']);
  });

  it('fires a trait’s own script on its own switch', async () => {
    const report = await runTestCode(
      'stats.Health.value = trait.name === self.name && trait.name === "Calm" ? 70 : 10;', 'switch',
      { kind: 'trait', trait: { id: 'c', name: 'Calm' }, entityId: null }, world,
    );
    expect(report.writes).toEqual(['stats.Health.value = 70']);
  });

  it('fires on a blank trait in a world with none', async () => {
    const bare = { ...world, traits: [], traitGroups: [] };
    const report = await runTestCode('stats.Health.value = trait.name === "" ? 70 : 10;', 'switch', { kind: 'world' }, bare);
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['stats.Health.value = 70']);
  });
});

describe('Test Code with a prompt', () => {
  it('waits on the run’s choice row and completes with the pick', async () => {
    const prompts = editorPromptRun();
    const running = runTestCode('if (player.confirm("Drink?")) stats.Health.value = 80;', 'after', { kind: 'world' }, world, { prompts: prompts.host });
    await vi.waitFor(() => expect(prompts.store.pending()).toHaveLength(1));
    prompts.store.answer(prompts.store.pending()[0].id, true);
    const report = await running;
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['stats.Health.value = 80']);
  });

  it('fails as canceled when the run closes, and keeps no write', async () => {
    const prompts = editorPromptRun();
    const running = runTestCode('stats.Health.value = 5; player.confirm("Drink?");', 'after', { kind: 'world' }, world, { prompts: prompts.host });
    await vi.waitFor(() => expect(prompts.store.pending()).toHaveLength(1));
    prompts.close();
    const report = await running;
    expect(report.error).toMatch(/closed the prompt/);
    expect(report.writes).toEqual([]);
  });
});
