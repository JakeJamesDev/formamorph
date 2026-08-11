import { describe, it, expect } from 'vitest';
import { statCodeCompletions, statCodeDiagnostics } from './statCodeAnalysis';
import { BUILT_IN_TEMPLATES } from './statCodeTemplates';

/** Completions for a caret written as `|` in the doc, so each case reads as the thing being typed. */
function completeAt(doc: string, options?: Parameters<typeof statCodeCompletions>[2]) {
  const pos = doc.indexOf('|');
  expect(pos, 'every completion case marks its caret with |').toBeGreaterThanOrEqual(0);
  return statCodeCompletions(doc.replace('|', ''), pos, options);
}

const labels = (doc: string, options?: Parameters<typeof statCodeCompletions>[2]) =>
  (completeAt(doc, options)?.options ?? []).map(option => option.label);

const messages = (code: string, options?: Parameters<typeof statCodeDiagnostics>[1]) =>
  statCodeDiagnostics(code, options).map(diagnostic => diagnostic.message);

describe('statCodeDiagnostics', () => {
  it('says nothing about code that runs', () => {
    expect(statCodeDiagnostics(`const health = stats.find(s => s.name === 'Health')?.value ?? 0;
const me = stats.find(s => s.id === currentStatId);
return Math.min(me?.max ?? 100, health + deltaHours);`)).toEqual([]);
  });

  it('underlines syntax the grammar cannot read', () => {
    const [problem] = statCodeDiagnostics('return (1 + ;');
    expect(problem.severity).toBe('error');
    expect(problem.message).toMatch(/syntax error/i);
    // Pointed at the offending text rather than at the whole document.
    expect(problem.to - problem.from).toBeLessThanOrEqual(2);
  });

  it('reports each unreadable spot once, not once per nested node', () => {
    expect(messages('return (1 + ;')).toHaveLength(1);
  });

  it('flags a name the sandbox never provides', () => {
    const [problem] = statCodeDiagnostics('return window.innerWidth;');
    expect(problem.severity).toBe('error');
    expect(problem.message).toContain('window');
  });

  it('names the variable the author probably meant', () => {
    expect(messages('return elapsedHrs;')[0]).toContain('elapsedHours');
    expect(messages('return stat.length;')[0]).toContain('stats');
  });

  it('leaves a genuinely unrecognizable name unguessed rather than pointing somewhere wrong', () => {
    const [problem] = statCodeDiagnostics('return zqxwv;');
    expect(problem.message).toContain('zqxwv');
    expect(problem.message).not.toMatch(/did you mean/i);
  });

  it('accepts every name the author declared, including destructured and looped ones', () => {
    expect(statCodeDiagnostics(`const { min, max } = stats[0];
let total = 0;
for (const entry of stats) total += entry.value;
function scale(amount) { return amount * 2; }
return scale(total) + min + max;`)).toEqual([]);
  });

  it('warns when the code can never hand a number back', () => {
    const [problem] = statCodeDiagnostics('const doubled = stats[0].value * 2;');
    expect(problem.severity).toBe('warning');
    expect(problem.message).toMatch(/return/i);
  });

  it('keeps quiet about a missing return while the code is still unreadable', () => {
    expect(messages('const a = (')).not.toContainEqual(expect.stringMatching(/never returns/i));
  });

  it('has nothing to say about empty code, which keeps the manual value', () => {
    expect(statCodeDiagnostics('   \n  ')).toEqual([]);
  });

  it('leaves template slots alone instead of covering a template in errors', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      expect(statCodeDiagnostics(template.code, { slots: true }), template.name).toEqual([]);
    }
  });

  it('still reads a slot-carrying template for names outside its slots', () => {
    expect(messages('return {{a:number=1}} + elapsedHrs;', { slots: true })[0]).toContain('elapsedHours');
  });

  it('treats the same slot syntax as real code where slots do not exist', () => {
    expect(messages('return {{a:number=1}};')).not.toEqual([]);
  });
});

describe('statCodeCompletions', () => {
  it('offers the sandbox globals at the top level', () => {
    const offered = labels('return el|');
    expect(offered).toContain('elapsedHours');
    expect(offered).toContain('stats');
    expect(offered).toContain('currentStatId');
  });

  it('replaces the word already typed rather than doubling it', () => {
    const result = completeAt('return el|');
    expect(result?.from).toBe('return '.length);
    expect(result?.to).toBe('return el'.length);
  });

  it('offers only what the sandbox has — not the page globals a browser would', () => {
    const offered = labels('return |');
    expect(offered).toContain('Math');
    expect(offered).not.toContain('window');
    expect(offered).not.toContain('fetch');
    expect(offered).not.toContain('localStorage');
  });

  it('offers the stat fields after a dot', () => {
    const offered = labels('const me = stats.find(s => s.id === currentStatId);\nreturn me.|');
    expect(offered).toEqual(['id', 'name', 'type', 'description', 'min', 'max', 'value', 'regen']);
  });

  it('leads with the fields when the object came out of stats, and defers when it did not', () => {
    const known = completeAt('const me = stats.find(s => s.id === currentStatId);\nreturn me.|');
    const unknown = completeAt('const other = 5;\nreturn other.|');
    expect(known?.options[0].boost).toBeGreaterThan(0);
    expect(unknown?.options[0].boost).toBeLessThan(0);
  });

  it('offers the world’s stat names inside a string, where a typo fails silently', () => {
    const offered = labels(`return stats.find(s => s.name === '|')?.value;`, {
      statNames: ['Health', 'Stamina'],
    });
    expect(offered).toEqual(['Health', 'Stamina']);
  });

  it('replaces the whole literal, so a half-typed name is not doubled inside the quotes', () => {
    const doc = `return stats.find(s => s.name === 'Heal|th')?.value;`;
    const result = completeAt(doc, { statNames: ['Health'] });
    const code = doc.replace('|', '');
    expect(code.slice(result!.from, result!.to)).toBe('Health');
  });

  it('offers the author’s own declarations alongside the sandbox’s', () => {
    const offered = labels('const hungerRate = 2;\nreturn hunger|');
    expect(offered).toContain('hungerRate');
  });

  it('offers a template’s declared slots after {{, so a second reference matches the first', () => {
    const offered = labels('const rate = {{ratePerHour:number=1}};\nreturn rate * {{|', { slots: true });
    expect(offered).toEqual(['ratePerHour']);
  });

  it('does not complete sandbox names inside a slot, which is template syntax', () => {
    expect(completeAt('return {{rate:num|ber=1}};', { slots: true })).toBeNull();
  });

  it('does not offer the slot being named back to itself', () => {
    expect(labels('return {{ratePer|}};', { slots: true })).toEqual([]);
  });

  it('offers nothing for stat names the world does not have', () => {
    expect(labels(`return stats.find(s => s.name === '|');`)).toEqual([]);
  });
});
