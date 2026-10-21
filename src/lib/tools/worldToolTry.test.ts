/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool, ToolScriptHandler } from '@/types';
import { type StatCodeWorld } from '@/lib/statCodeTestRun';
import { tryWorldToolScript } from './worldToolTry';

const world: StatCodeWorld = {
  stats: [{ id: 'luck', name: 'Luck', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] }],
  statGroups: [], traits: [], traitGroups: [], entities: [{ id: 'e-tor', name: 'Tor' }], entityGroups: [], placeholders: [],
  placeholderGroups: [], dictionaries: [],
  locations: [{ id: 'loc-gate', name: 'North Gate' }, { id: 'loc-inn', name: 'Inn', isStarting: true }],
};

const tool = (handler: Partial<ToolScriptHandler>, params: Tool['params'] = []): Tool => ({
  id: 'tool-1', name: 'travel', description: 'Moves the scene', params, emptyResult: '{}', offeredTo: [],
  handler: { kind: 'script', code: '', ...handler },
});
const where: Tool['params'] = [{ name: 'place', type: 'string', description: '', required: true, options: [] }];

describe('tryWorldToolScript', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('answers an After the AI Tool with its Reply and lists each staged write', async () => {
    const result = await tryWorldToolScript(
      tool({ timing: 'after', reply: 'Off you go.', code: 'location.move(args.place); clock.advance(30); stats.Luck.value = 9;' }, where),
      '{"place":"North Gate"}', world,
    );
    expect(result.failure).toBeUndefined();
    expect(result.text).toBe('Off you go.');
    expect(result.writes).toEqual(['stats.Luck.value = 9', 'location.move: North Gate', 'clock.advance: 30 minutes']);
  });

  it('answers “Done.” for a trigger with a blank Reply, whatever the script returns', async () => {
    const result = await tryWorldToolScript(tool({ timing: 'output', reply: '  ', code: 'return "ignored";' }), '{}', world);
    expect(result.text).toBe('Done.');
  });

  it('answers an On Call Tool with the value its script returns', async () => {
    const result = await tryWorldToolScript(tool({ code: 'return "At " + args.place;' }, where), '{"place":"Inn"}', world);
    expect(result.text).toBe('At Inn');
  });

  it('answers the empty result when an On Call script returns nothing', async () => {
    const result = await tryWorldToolScript(tool({ code: 'memories.add("Noted.");' }), '{}', world);
    expect(result.text).toBe('{}');
    expect(result.writes).toEqual(['memories.add: Noted.']);
  });

  it('rejects arguments that miss the parameters, as the AI would be told', async () => {
    const result = await tryWorldToolScript(tool({ timing: 'after', code: 'location.move(args.place);' }, where), '{}', world);
    expect(result.failure).toBe('arguments');
    expect(JSON.parse(result.text).error).toMatch(/place/);
    expect(result.writes).toEqual([]);
  });

  it('reports a script that throws as a script failure with no writes', async () => {
    const result = await tryWorldToolScript(tool({ timing: 'after', code: 'clock.advance(5); location.move("Moon");' }), '{}', world);
    expect(result.failure).toBe('script');
    expect(JSON.parse(result.text).error).toMatch(/Moon/);
    expect(result.writes).toEqual([]);
  });

  it('warns on a diary target the authored world lacks without failing the run', async () => {
    const result = await tryWorldToolScript(tool({ timing: 'after', code: 'entities.Stranger.diary("Hello.");' }), '{}', world);
    expect(result.failure).toBeUndefined();
    expect(result.warnings).toEqual(['Diary target “Stranger” may be discovered in play.']);
  });

  it('rewrites the sample sentence of a During AI Output Tool', async () => {
    const result = await tryWorldToolScript(
      tool({ timing: 'output', code: 'narration.sentence = narration.sentence.toUpperCase();' }), '{}', world, { sentence: 'The gate creaks.' },
    );
    expect(result.sentence).toBe('THE GATE CREAKS.');
  });
});
