import { describe, expect, it } from 'vitest';
import { codeCard } from './codeCards';
import { codeCompletions } from './statCodeAnalysis';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { toolScriptSurface } from './tools/toolScriptSurface';

const options = { surface: STAT_CODE_SURFACE };

describe('currencies in the editor', () => {
  it('shows a hover card on the global that links the Scripts Reference', () => {
    const code = 'return currencies.Coin.balance(persona);';
    const card = codeCard(code, code.indexOf('currencies') + 2, options);
    expect(card?.signature).toMatchObject({ kind: 'global', path: 'currencies', type: 'object' });
    expect(card?.links).toEqual([{ id: 'guide', target: { page: 'Scripts-Reference', anchor: 'currencies' } }]);
  });

  it('completes currencies as a global in a script, and not in a user Tool', () => {
    const labels = (surface: typeof STAT_CODE_SURFACE) => (codeCompletions('return cur', 10, { surface })?.options ?? []).map((entry) => entry.label);
    expect(labels(STAT_CODE_SURFACE)).toContain('currencies');
    expect(labels(toolScriptSurface([]))).not.toContain('currencies');
  });
});
