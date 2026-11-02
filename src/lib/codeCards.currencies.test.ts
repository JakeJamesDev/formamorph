import { describe, expect, it } from 'vitest';
import { codeCard } from './codeCards';
import { codeCompletions, codeDiagnostics } from './statCodeAnalysis';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { buildVariableTree, readOnlyTree, timingGlobalsOf } from './statCodeVariableTree';
import { toolScriptSurface } from './tools/toolScriptSurface';

const options = { surface: STAT_CODE_SURFACE };

describe('currencies in the editor', () => {
  it('shows a hover card on the global that links the Scripts Reference', () => {
    const code = 'return currencies.Coin.balance(persona);';
    const card = codeCard(code, code.indexOf('currencies') + 2, options);
    expect(card?.signature).toMatchObject({ kind: 'global', path: 'currencies', type: 'object' });
    expect(card?.links).toEqual([{ id: 'guide', target: { page: 'Scripts-Reference', anchor: 'currencies' } }]);
  });

  const tool = toolScriptSurface([]);
  const named = { currencies: [{ id: 'coin', name: 'Coin' }] };

  it('completes currencies as a global in a script and in a user Tool', () => {
    const labels = (surface: typeof STAT_CODE_SURFACE) => (codeCompletions('return cur', 10, { surface })?.options ?? []).map((entry) => entry.label);
    expect(labels(STAT_CODE_SURFACE)).toContain('currencies');
    expect(labels(tool)).toContain('currencies');
  });

  it('says on the user Tool’s card that the Tool can’t pay, and on a script’s nothing of the kind', () => {
    const code = 'return currencies.Coin.balance(persona);';
    const info = (surface: typeof STAT_CODE_SURFACE) => surface.globals.find((entry) => entry.name === 'currencies')?.info;
    const card = codeCard(code, code.indexOf('currencies') + 2, { surface: tool });
    expect(card?.signature).toMatchObject({ kind: 'global', path: 'currencies' });
    expect(card?.links).toEqual([{ id: 'guide', target: { page: 'Scripts-Reference', anchor: 'currencies' } }]);
    expect(info(tool)).toContain('A Tool can’t pay');
    expect(info(STAT_CODE_SURFACE)).toContain('currencies.Gold.pay');
  });

  it('marks a pay in a user Tool as unavailable, and neither a balance nor a script’s pay', () => {
    const messages = (code: string, surface: typeof STAT_CODE_SURFACE) => codeDiagnostics(code, { surface }).map((d) => d.message);
    const pay = 'return currencies.Coin.pay(persona, null, 5);';
    expect(messages(pay, tool)).toEqual(['“pay” isn’t available in a Tool script.']);
    expect(messages('return currencies["Two Words"].pay(persona, null, 5);', tool)).toEqual(['“pay” isn’t available in a Tool script.']);
    expect(messages('return currencies.Coin.balance(persona);', tool)).toEqual([]);
    expect(messages(pay, STAT_CODE_SURFACE).join()).not.toContain('isn’t available');
  });

  it('lists balance and no pay in a user Tool’s Variable menu', () => {
    const tree = readOnlyTree(buildVariableTree(named, undefined, 'stat', timingGlobalsOf(tool)));
    const list = tree.find((node) => node.kind === 'names' && node.label === 'Currencies');
    const labels = list?.kind === 'names' ? list.rows[0].children.map((node) => (node.kind === 'field' ? node.label : '')) : [];
    expect(labels).toContain('balance');
    expect(labels).not.toContain('pay');
  });
});
