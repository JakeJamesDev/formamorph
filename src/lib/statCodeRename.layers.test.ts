/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import type { Entity, GalleryLink, LayeredMediaEntry, MediaList, Script } from '@/types';
import { pickedEdits, planCodeRename, type CodeRenameInput } from './statCodeRename';
import { layerNameReferences } from './codeRenameChains';

const world = (code: string): Script[] => [{ id: 'w', timing: 'after', code }];
const renamed = (root: 'layers' | 'media', from: string, to: string, code: string) =>
  planCodeRename({ root, oldName: from, newName: to, stats: [], otherNames: [], worldScripts: world(code) })?.edits[0]?.scripts.w;

describe('a Layer rename in scripts', () => {
  it('rewrites the Layer key under every media owner’s `layers`, in the dot and the bracket form', () => {
    const code = [
      'entities.Wren.layers.Hat.variant = "Cap";',
      "persona.layers['Hat'].opacity = 0.5;",
      'entities.Guard.instances[0].layers.Hat.tint = null;',
      'location.layers.Hat.opacity = 1;',
      'if (items.Cloak.instances[0].layers?.Hat.variant) {}',
    ].join('\n');
    expect(renamed('layers', 'Hat', 'Helmet', code)).toBe(code.replaceAll('Hat', 'Helmet'));
  });

  it('switches to the bracket form for a name that is no identifier', () => {
    expect(renamed('layers', 'Hat', 'Hat (Front)', 'entities.Wren.layers.Hat.opacity = 1;')).toBe("entities.Wren.layers['Hat (Front)'].opacity = 1;");
  });

  it('leaves other Layers, a bare `layers` variable, and a computed key alone', () => {
    const code = [
      'const layers = {}; layers.Hat = 1;',
      'entities.Wren.layers.Hair.variant = "Hat"; entities.Wren.layers[name].opacity = 1;',
      'entities.Wren.stats.layers.Hat = 1;',
    ].join('\n');
    expect(layerNameReferences(code).map(({ key }) => key.name)).toEqual(['Hair']);
    expect(renamed('layers', 'Hat', 'Helmet', code)).toBeUndefined();
  });

  it('reads a local’s `layers` as a reference whose owner only a run can name (Q41)', () => {
    const code = 'rig.layers.Hat = 1;\n{ const location = pick(); location.layers.Hat.opacity = 1; }\nentities.Wren.items[0].layers.Hat = 1;';
    expect(layerNameReferences(code).map(({ subject, text }) => ({ subject, text }))).toEqual([
      { subject: null, text: 'rig.layers.Hat' },
      { subject: null, text: 'location.layers.Hat' },
      { subject: null, text: 'entities.Wren.items[0].layers.Hat' },
    ]);
  });

  it('offers nothing when no script names the Layer', () => {
    expect(planCodeRename({ root: 'layers', oldName: 'Hat', newName: 'Helmet', stats: [], otherNames: [], worldScripts: world('entities.Wren.image = "Hat";') })).toBeNull();
  });
});

describe('an image rename in Layer scripts', () => {
  it('rewrites a Variant name assigned to or compared with a Layer’s `variant`', () => {
    const code = 'entities.Wren.layers.Hat.variant = "Cap";\nif (location.layers["Sky"].variant === "Cap") {}';
    expect(renamed('media', 'Cap', 'Beret', code)).toBe(code.replaceAll('Cap', 'Beret'));
  });

  it('leaves a `variant` key that is no Layer’s', () => {
    expect(renamed('media', 'Cap', 'Beret', 'entities.Wren.variant = "Cap";')).toBeUndefined();
  });
});

/** Rig A's Hat already renamed to Helmet, as the plan reads the world; Rig B keeps its own Hat. */
const rig = (id: string, layer: string): LayeredMediaEntry => ({ id, name: `Rig ${id}`, kind: 'layered', layers: [{ id: `${id}-hat`, name: layer, variants: [] }] });
const slots = (...ids: string[]): GalleryLink[] => ids.map((mediaId) => ({ mediaId }));
const TWO_RIGS: MediaList = { A: rig('A', 'Helmet'), B: rig('B', 'Hat') };
const cast = (images: Record<string, string[]>) =>
  // Only the fields the planner reads, hence the cast.
  Object.entries(images).map(([name, ids]) => ({ id: name, name, images: slots(...ids) })) as unknown as Entity[];

const planOf = (code: string, extra: Partial<CodeRenameInput> = {}) => planCodeRename({
  root: 'layers', oldName: 'Hat', newName: 'Helmet', stats: [], otherNames: [], worldScripts: world(code), mediaId: 'A', mediaList: TWO_RIGS,
  entities: cast({ Wren: ['A'], Bob: ['B'], Cid: ['A', 'B'], Dee: [], Guard: ['A'] }),
  locations: [{ name: 'Dock', images: slots('A') }],
  items: [{ name: 'Cloak', images: slots('B') }, { name: 'Pin', images: slots('A') }],
  ...extra,
});

describe('a Layer rename when two Layered Images share the Layer name', () => {
  const lines = {
    wren: 'entities.Wren.layers.Hat.variant = "Cap";',
    bob: 'entities.Bob.layers.Hat.variant = "Cap";',
    cid: 'entities.Cid.layers.Hat.opacity = 1;',
    dee: 'entities.Dee.layers.Hat.opacity = 1;',
    guard: 'entities.Guard.instances[0].layers.Hat.opacity = 1;',
    dock: 'locations.Dock.layers.Hat.opacity = 1;',
    cloak: 'items.Cloak.instances[0].layers.Hat.opacity = 1;',
    pin: 'items.Pin.instances[0].layers.Hat.opacity = 1;',
    self: 'self.layers.Hat.opacity = 1;',
    persona: 'persona.layers.Hat.opacity = 1;',
  };
  const code = Object.values(lines).join('\n');

  it('rewrites a named owner only when it links the renamed one alone, and lists run-time owners apart', () => {
    const plan = planOf(code)!;
    const after = plan.edits[0].scripts.w;
    for (const sure of [lines.wren, lines.guard, lines.dock, lines.pin]) expect(after).toContain(sure.replace('Hat', 'Helmet'));
    for (const kept of [lines.bob, lines.dee, lines.cloak, lines.cid, lines.self, lines.persona]) expect(after).toContain(kept);
    expect(plan.references).toBe(4);
    expect(plan.layerBoxes?.flatMap((box) => box.unsure.map(({ text, line }) => ({ text, line })))).toEqual([
      { text: 'entities.Cid.layers.Hat', line: 3 },
      { text: 'self.layers.Hat', line: 9 },
      { text: 'persona.layers.Hat', line: 10 },
    ]);
  });

  it('rewrites a picked reference along with the sure ones, and only that one', () => {
    const plan = planOf(code)!;
    const selfId = plan.layerBoxes![0].unsure.find(({ text }) => text.startsWith('self'))!.id;
    const { edits, references } = pickedEdits(plan.layerBoxes!, new Set([selfId]));
    expect(references).toBe(5);
    expect(edits[0].scripts.w).toContain('self.layers.Helmet.opacity = 1;');
    expect(edits[0].scripts.w).toContain(lines.persona);
    expect(edits[0].scripts.w).toContain(lines.wren.replace('Hat', 'Helmet'));
  });

  it('counts an image a script assigns as one the owner can show', () => {
    const plan = planOf(`${lines.wren}\nentities.Wren.image = "Rig B";`)!;
    expect(plan.references).toBe(0);
    expect(plan.layerBoxes?.[0].unsure.map(({ text }) => text)).toEqual(['entities.Wren.layers.Hat']);
  });

  it('ignores an `image` write on a local that shadows `entities`', () => {
    const scripts: Script[] = [
      { id: 'one', timing: 'after', code: lines.wren },
      { id: 'two', timing: 'after', code: 'const entities = {}; entities.Wren.image = "Rig B";' },
    ];
    expect(planOf('', { worldScripts: scripts })?.references).toBe(1);
  });

  it('lists a named owner the world doesn’t hold, whose slots no edit can read', () => {
    expect(planOf('entities.Ghost.layers.Hat.opacity = 1;')?.layerBoxes?.[0].unsure.map(({ text }) => text)).toEqual(['entities.Ghost.layers.Hat']);
  });

  it('numbers the world script that holds a pick, where the world has several', () => {
    const scripts: Script[] = [{ id: 'one', timing: 'after', code: 'clock.day;' }, { id: 'two', timing: 'after', code: lines.self }];
    expect(planOf('', { worldScripts: scripts })?.layerBoxes?.map(({ id, scriptNumber }) => ({ id, scriptNumber }))).toEqual([{ id: 'two', scriptNumber: 2 }]);
  });

  it('offers nothing when every reference belongs to the other Layered Image', () => {
    expect(planOf(`${lines.bob}\n${lines.cloak}`)).toBeNull();
  });
});

describe('a Layer rename when no other Layered Image has the Layer name', () => {
  it('rewrites every reference, run-time owners included', () => {
    const code = 'entities.Bob.layers.Hat.opacity = 1;\nself.layers.Hat.opacity = 1;\nguard.layers.Hat.opacity = 1;';
    const plan = planOf(code, { mediaList: { A: rig('A', 'Helmet'), B: rig('B', 'Crown') } })!;
    expect(plan.edits[0].scripts.w).toBe(code.replaceAll('Hat', 'Helmet'));
    expect(plan.layerBoxes?.flatMap((box) => box.unsure)).toEqual([]);
  });
});
