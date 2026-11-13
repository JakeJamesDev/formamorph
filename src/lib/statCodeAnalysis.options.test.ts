/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engines loading through their filesystem paths.)
 */
import { describe, expect, it } from 'vitest';
import { codeDiagnostics, type SurfaceAnalysisOptions } from './statCodeAnalysis';
import { scriptSurface, WORLD_SCRIPT_SURFACE } from './statCodeSurface';

const box: SurfaceAnalysisOptions = { surface: scriptSurface(WORLD_SCRIPT_SURFACE, 'after'), optionNames: ['Reply Length', 'Lit'] };
const messages = (code: string, options: SurfaceAnalysisOptions = box) => codeDiagnostics(code, options).map((d) => d.message);

describe('World Option names in scripts', () => {
  it('reads options as a known global', () => {
    expect(messages('options.Lit = true;')).toEqual([]);
    expect(messages('options["Reply Length"] = "Short";')).toEqual([]);
  });

  it('flags a name no World Option has, with the near one', () => {
    expect(messages('options.Lif = true;')).toEqual(['No World Option is named “Lif”. Did you mean “Lit”?']);
    expect(messages('options["Nothing Like It"] = 1;')).toEqual(['No World Option is named “Nothing Like It”.']);
  });

  it('flags a name two Options share', () => {
    expect(messages('options.Lit = true;', { ...box, optionNames: ['Lit', 'Lit'] }))
      .toEqual(['2 World Options are named “Lit”. This reads the last one authored.']);
  });

  it('checks nothing without the names, or when the code declares its own options', () => {
    expect(messages('options.Lif = true;', { surface: box.surface })).toEqual([]);
    expect(messages('const options = {}; options.Lif = true;')).toEqual([]);
  });
});
