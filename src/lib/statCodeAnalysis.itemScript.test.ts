import { describe, expect, it } from 'vitest';
import { codeDiagnostics } from './statCodeAnalysis';
import { ITEM_SCRIPT_SURFACE, scriptSurface, STAT_CODE_SURFACE } from './statCodeSurface';
import { ITEM_SCRIPT_TIMINGS } from './scripts';

const messages = (code: string, surface = scriptSurface(ITEM_SCRIPT_SURFACE, 'gained')) =>
  codeDiagnostics(code, { surface, statNames: [] }).map((finding) => finding.message);

describe('an item script in the editor', () => {
  it.each(ITEM_SCRIPT_TIMINGS)('knows items, an owner’s items and the Item Copy verbs at %s', (timing) => {
    const code = [
      'if (self.event.timing === "gained" && self.event.copy) self.event.copy.equip();',
      'items.Lamp.give(owner, 2);',
      'for (const copy of persona.items) if (copy.item === self.name) { copy.setUses(3); copy.use(); }',
    ].join('\n');
    expect(messages(code, scriptSurface(ITEM_SCRIPT_SURFACE, timing))).toEqual([]);
  });

  it('underlines a write to the item’s own entry', () => {
    expect(messages('self.name = "x";')).not.toEqual([]);
  });

  it('keeps a stat box’s self a stat', () => {
    expect(codeDiagnostics('return self.value;', { surface: STAT_CODE_SURFACE, statNames: [] })).toEqual([]);
  });
});
