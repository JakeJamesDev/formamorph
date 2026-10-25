import { describe, it, expect } from 'vitest';
import type { ToolParam } from '@/types';
import { codeCompletions, codeDiagnostics, type SurfaceAnalysisOptions } from '@/lib/statCodeAnalysis';
import { WORLD_SCRIPT_SURFACE } from '@/lib/statCodeSurface';
import { runToolScript } from './toolScript';
import { sampleToolSnapshot } from './sampleToolSnapshot';
import { toolScriptSurface } from './toolScriptSurface';

const params: ToolParam[] = [
  { name: 'name', type: 'string', description: 'Who to find.', required: true, options: [] },
  { name: 'mood', type: 'enum', description: '', required: false, options: ['calm', 'angry'] },
  { name: 'place-name', type: 'number', description: '', required: true, options: [] },
];
const surface = toolScriptSurface(params);
const named: SurfaceAnalysisOptions = {
  surface, statNames: ['Health'], entities: [{ id: 'mara', name: 'Mara', traits: [], persona: false, stats: [] }], locations: ['Dock'],
};

function labelsAt(doc: string, options: SurfaceAnalysisOptions = { surface }) {
  const pos = doc.indexOf('|');
  return (codeCompletions(doc.replace('|', ''), pos, options)?.options ?? []).map((option) => option.label);
}
const messages = (code: string) => codeDiagnostics(code, { surface }).map((d) => d.message);

describe('the Tool script surface matches the sandbox', () => {
  const snapshot = sampleToolSnapshot();

  it('lists every global the script can reach, and each is really there', async () => {
    const globals = surface.globals.map((g) => g.name);
    expect(globals).toEqual([
      'args', 'stats', 'clock', 'turn', 'locations', 'location', 'memories', 'notes', 'placeholders', 'traits', 'entities', 'persona', 'dictionaries', 'console',
    ]);
    const probe = `return [${globals.map((g) => `typeof ${g}`).join(', ')}];`;
    const result = await runToolScript(probe, { name: 'Wren' }, snapshot);
    expect(JSON.parse((result as { text: string }).text)).not.toContain('undefined');
  });

  it('leaves out every name a world script has that the Tool surface lacks, and the sandbox lacks each too', async () => {
    const absent = WORLD_SCRIPT_SURFACE.globals.map((g) => g.name).filter((name) => !surface.globals.some((g) => g.name === name));
    expect(absent.sort()).toEqual(['discover', 'owner', 'self']);
    const probe = `return [${[...absent, 'player', 'world', 'scene'].map((g) => `typeof ${g}`).join(', ')}];`;
    const result = await runToolScript(probe, {}, snapshot);
    expect(JSON.parse((result as { text: string }).text)).toEqual(['undefined', 'undefined', 'undefined', 'undefined', 'undefined', 'undefined']);
  });
});

describe('no verb on the surface', () => {
  it('offers the fields of each world value and none of its calls', () => {
    expect(labelsAt('return location.|')).toEqual(['id', 'name', 'description', 'summary', 'starting', 'present', 'parent', 'children', 'exits']);
    expect(labelsAt('return clock.|')).toEqual(['day', 'daypart', 'hour', 'minute', 'deltaHours', 'elapsedHours', 'previous']);
    expect(labelsAt('return memories.|')).toEqual([]);
    expect(labelsAt('return entities.Mara.|', named)).not.toEqual(expect.arrayContaining(['move']));
    expect(labelsAt('return entities.Mara.|', named)).toEqual(expect.arrayContaining(['location', 'following', 'stats']));
    expect(labelsAt('return entities.Mara.|', named).filter((label) => ['move', 'follow', 'unfollow', 'diary'].includes(label))).toEqual([]);
  });

  it('keeps a built-in’s calls', () => {
    expect(labelsAt('return Math.|')).toContain('floor');
  });
});

describe('args', () => {
  it('offers each parameter with its type', () => {
    expect(labelsAt('return args.|')).toEqual(['name', 'mood', 'place-name']);
    const mood = surface.members.get('args')!.find((m) => m.name === 'mood')!;
    expect(mood.detail).toBe('"calm" | "angry"');
    expect(mood.info).toBe('What the AI passed. Absent when the AI leaves it out.');
    expect(surface.members.get('args')!.find((m) => m.name === 'place-name')!.detail).toBe('number');
  });

  it('follows the parameters as they change', () => {
    expect(toolScriptSurface([]).members.get('args')).toEqual([]);
    expect(toolScriptSurface([{ ...params[0], name: '' }]).members.get('args')).toEqual([]);
  });
});

describe('diagnostics read the surface', () => {
  it('marks the retired globals unknown', () => {
    expect(messages('return world.entities;')).toEqual(['“world.entities” isn’t available in a Tool script. Use “entities”.']);
    expect(messages('return scene.present;')).toEqual(['“scene.present” isn’t available in a Tool script. Use “location.present”.']);
    expect(messages('return world;')).toEqual(['“world” isn’t available in a Tool script.']);
  });

  it('accepts a script that reads the script surface and warns when it returns nothing', () => {
    expect(messages('return Object.values(entities).filter((e) => e.name === args.name).map((e) => e.location);')).toEqual([]);
    expect(messages('const x = notes;')).toEqual(['This script never returns, so the Tool sends its empty result.']);
  });
});
