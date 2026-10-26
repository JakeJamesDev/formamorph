/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import type { ToolParam } from '@/types';
import { codeCompletions, codeDiagnostics } from '@/lib/statCodeAnalysis';
import { type StatCodeWorld } from '@/lib/statCodeTestRun';
import { variableTreeLeaves } from '@/lib/statCodeVariableTree';
import { tryWorldToolScript } from './worldToolTry';
import { worldToolArgsNodes, worldToolSurface } from './worldToolSurface';

const params: ToolParam[] = [
  { name: 'place', type: 'string', description: 'Where to go.', required: true, options: [] },
  { name: 'mood', type: 'enum', description: '', required: false, options: ['calm', 'angry'] },
  { name: 'place-name', type: 'number', description: '', required: false, options: [] },
];

const world: StatCodeWorld = {
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [],
  dictionaries: [], locations: [{ id: 'loc-inn', name: 'Inn', isStarting: true }],
};

const messages = (code: string, timing: 'call' | 'output' | 'after' = 'after') =>
  codeDiagnostics(code, { surface: worldToolSurface(params, timing) }).map((d) => d.message);

describe('the World Tool script surface', () => {
  it('lists every global a run really holds, args and the write surface included', async () => {
    const surface = worldToolSurface(params, 'after');
    const globals = surface.globals.map((entry) => entry.name);
    expect(globals).toEqual(expect.arrayContaining(['args', 'location', 'clock', 'discover', 'memories', 'entities', 'stats', 'player']));
    expect(globals).not.toContain('diary');
    // `player` exists in a run whose code names it, so its probe names a call.
    const held = globals.filter((name) => name !== 'player');
    const probe = `return [${held.map((name) => `typeof ${name}`).join(', ')}, typeof player.tell].join(' ');`;
    const result = await tryWorldToolScript(
      { id: 't', name: 't', description: '', params, emptyResult: '{}', offeredTo: [], handler: { kind: 'script', timing: 'call', code: probe } },
      '{"place":"Inn"}', world,
    );
    expect(result.failure).toBeUndefined();
    expect(result.text.split(' ')).toHaveLength(globals.length);
    expect(result.text).not.toContain('undefined');
  });

  it('types args from the parameters, the optional ones noted', () => {
    const args = worldToolSurface(params, 'after').members.get('args')!;
    expect(args.map((entry) => [entry.name, entry.detail])).toEqual([['place', 'string'], ['mood', '"calm" | "angry"'], ['place-name', 'number']]);
    expect(args[1].info).toMatch(/Absent when the AI leaves it out/);
  });

  it('offers a parameter after args and flags a misspelled one', () => {
    const doc = 'return args.|';
    const options = codeCompletions(doc.replace('|', ''), doc.indexOf('|'), { surface: worldToolSurface(params, 'after') })?.options ?? [];
    expect(options.map((option) => option.label)).toEqual(['place', 'mood', 'place-name']);
    expect(messages('return argz.place;')).toEqual(['“argz” isn’t available in a World Tool script. Did you mean “args”?']);
  });

  it('accepts every write a World Tool can make', () => {
    expect(messages('location.move(args.place); clock.advance(5); discover("Tor"); memories.add("x"); memories.pin("y"); entities.Tor.diary("z");')).toEqual([]);
  });

  it('lists a turn.choices write as read-only at every timing, an After the AI Tool included', () => {
    for (const timing of ['call', 'output', 'after'] as const) {
      expect(messages('turn.choices = []; return 1;', timing), timing).toEqual(['turn.choices is read-only.']);
      expect(worldToolSurface(params, timing).members.get('turn')?.find((entry) => entry.name === 'choices')?.access, timing).toBe('readOnly');
    }
  });

  it('gives a During AI Output Tool narration and no player, and the other timings the reverse', () => {
    const names = (timing: 'call' | 'output' | 'after') => worldToolSurface(params, timing).globals.map((entry) => entry.name);
    expect(names('output')).toContain('narration');
    expect(names('output')).not.toContain('player');
    expect(names('after')).toContain('player');
    expect(names('call')).not.toContain('narration');
  });

  it('shows no stat as self or owner, since a Tool belongs to no stat', () => {
    const globals = worldToolSurface(params, 'after').globals;
    expect(globals.find((entry) => entry.name === 'self')?.info).toMatch(/Empty/);
  });
});

describe('the Arguments group of the Variable menu', () => {
  it('inserts each parameter as a path off args', () => {
    const [group] = worldToolArgsNodes(params);
    expect(group).toMatchObject({ kind: 'group', label: 'Arguments' });
    expect(variableTreeLeaves([group]).map((leaf) => leaf.insert)).toEqual(['args.place', 'args.mood', 'args["place-name"]']);
  });

  it('says so when the Tool has no parameters', () => {
    expect(worldToolArgsNodes([])).toEqual([
      { kind: 'group', label: 'Arguments', info: expect.any(String), children: [{ kind: 'empty', message: 'No parameters in this Tool' }] },
    ]);
  });
});
