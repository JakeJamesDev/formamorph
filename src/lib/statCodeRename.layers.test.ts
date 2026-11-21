/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import type { Script } from '@/types';
import { planCodeRename } from './statCodeRename';
import { layerNameKeys } from './codeRenameChains';

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

  it('leaves other Layers, a local variable’s `layers`, and a computed key alone', () => {
    const code = [
      'const layers = {}; layers.Hat = 1; rig.layers.Hat = 1;',
      'entities.Wren.layers.Hair.variant = "Hat"; entities.Wren.layers[name].opacity = 1;',
      '{ const location = pick(); location.layers.Hat.opacity = 1; }',
    ].join('\n');
    expect(layerNameKeys(code).map((key) => key.name)).toEqual(['Hair']);
    expect(renamed('layers', 'Hat', 'Helmet', code)).toBeUndefined();
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
