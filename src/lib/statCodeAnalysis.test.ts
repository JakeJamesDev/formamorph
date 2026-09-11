import { describe, it, expect } from 'vitest';
import { statCodeCompletions, statCodeDiagnostics, summarizeProblems } from './statCodeAnalysis';
import { BUILT_IN_TEMPLATES } from './statCodeTemplates';
import { PLACEHOLDER_ENTRY_FIELDS } from './statCodeSurface';
import { phValues } from '@/test/placeholderValues';
import { encodePlaceholderToken } from './placeholders';
import type { Placeholder } from '@/types';

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

  it('warns when the code neither returns nor touches its own stat', () => {
    const [problem] = statCodeDiagnostics('const doubled = stats[0].value * 2;');
    expect(problem.severity).toBe('warning');
    expect(problem.message).toMatch(/return/i);
    expect(problem.message).toContain('self.value');
  });

  it('still warns when the code only reads its own stat', () => {
    expect(messages('const seen = self.value;')).toContainEqual(expect.stringContaining('self.value'));
  });

  it('accepts code that writes self.value and never returns', () => {
    expect(statCodeDiagnostics('self.value = self.previous.value + self.requested.value / 2;')).toEqual([]);
  });

  it('accepts code that only writes its own bounds', () => {
    for (const code of ['self.min = 5;', 'self.max = stats.length * 10;', 'self.regen -= 1;']) {
      expect(statCodeDiagnostics(code), code).toEqual([]);
    }
  });

  it('names every writable field when a write misses them all', () => {
    const [problem] = statCodeDiagnostics('self.name = "x";');
    for (const field of ['self.value', 'self.min', 'self.max', 'self.regen']) expect(problem.message).toContain(field);
  });

  it('accepts a write through the currentStatId lookup, which reaches the same entry as self', () => {
    expect(statCodeDiagnostics('const me = stats.find(s => s.id === currentStatId);\nme.value = 5;')).toEqual([]);
    expect(statCodeDiagnostics('stats.find(s => s.id === currentStatId).value = 5;')).toEqual([]);
  });

  it('flags a write to a field self does not have, and names the one it was reaching for', () => {
    const [problem] = statCodeDiagnostics('self.vlaue = 3;');
    expect(problem.severity).toBe('error');
    expect(problem.message).toContain('vlaue');
    expect(problem.message).toContain('“value”');
    // Pointed at the field, not the whole statement.
    expect('self.vlaue = 3;'.slice(problem.from, problem.to)).toBe('vlaue');
  });

  it('flags every way of writing an unknown field, not only plain assignment', () => {
    for (const code of ['self.count += 1;', 'self.count++;', '++self.count;']) {
      expect(messages(code), code).toContainEqual(expect.stringContaining('count'));
    }
  });

  it('flags a write to a field self has but code cannot set', () => {
    for (const [code, field] of [['self.name = "x";', 'name'], ['self.previous.value = 1;', 'previous']] as const) {
      const [problem] = statCodeDiagnostics(code);
      expect(problem?.severity, code).toBe('error');
      expect(problem?.message, code).toContain(`self.${field}`);
      expect(problem?.message, code).toContain('self.value');
    }
  });

  it('warns about a write to another stat’s entry, which the host ignores', () => {
    for (const code of [
      'stats[0].value = 1;\nreturn 2;',
      'stats.find(s => s.name === "Health").value = 1;\nreturn 2;',
      'const hp = stats.find(s => s.name === "Health");\nhp.value -= 1;\nreturn 2;',
      'const other = stats.find(s => s.id !== currentStatId);\nother.value = 1;\nreturn 2;',
    ]) {
      const problems = statCodeDiagnostics(code);
      expect(problems, code).toHaveLength(1);
      expect(problems[0].severity, code).toBe('warning');
      expect(problems[0].message, code).toMatch(/another stat/i);
    }
  });

  it('keeps quiet about reads, which are always allowed', () => {
    expect(statCodeDiagnostics('const hp = stats.find(s => s.name === "Health");\nreturn hp.value + self.regenApplied;')).toEqual([]);
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

describe('summarizeProblems', () => {
  const at = (severity: 'error' | 'warning') => ({ from: 0, to: 1, severity, message: '' });

  it('says nothing when the reader found nothing, so a clean run stays clean', () => {
    expect(summarizeProblems([])).toBeNull();
  });

  it('counts the two severities apart', () => {
    expect(summarizeProblems([at('error'), at('warning')])).toBe('1 error, 1 warning in this code');
  });

  it('names only the severity that occurred', () => {
    expect(summarizeProblems([at('warning')])).toBe('1 warning in this code');
    expect(summarizeProblems([at('error'), at('error')])).toBe('2 errors in this code');
  });

  // The line rides beside "Result: 42", where a successful run is exactly what makes it worth saying.
  it('reports on code that runs perfectly well but never returns', () => {
    expect(summarizeProblems(statCodeDiagnostics('const doubled = stats[0].value * 2;')))
      .toBe('1 warning in this code');
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

  it('offers self among the globals', () => {
    expect(labels('return se|')).toContain('self');
  });

  it('offers the stat fields after a dot', () => {
    const offered = labels('const me = stats.find(s => s.id === currentStatId);\nreturn me.|');
    expect(offered).toEqual([
      'id', 'name', 'type', 'description', 'min', 'max', 'value', 'regen', 'previous', 'requested', 'regenApplied',
    ]);
  });

  it('offers the stat fields after self, and after a name that holds self', () => {
    expect(labels('return self.|')).toContain('requested');
    expect(labels('const me = self;\nreturn me.|')).toContain('previous');
  });

  it('offers value and max after a turn input, and nothing a stat has', () => {
    for (const doc of ['return self.previous.|', 'return self.requested.|', 'return stats[0].requested.|']) {
      expect(labels(doc), doc).toEqual(['value', 'max']);
    }
  });

  it('says nothing after previous on something that is not a stat', () => {
    expect(labels('const other = { previous: 1 };\nreturn other.previous.|')).toEqual([]);
  });

  it('offers the stat fields off the find call itself, without a variable in between', () => {
    expect(labels('return stats.find(s => s.id === currentStatId).|')).toContain('value');
    expect(labels('return stats.find(s => s.id === currentStatId)?.|')).toContain('regen');
    expect(labels('return stats[0].|')).toContain('max');
  });

  // A list offered after an expression nothing can name reads as the editor claiming `other.value` and
  // `Math.regen` exist, which is worse than offering nothing at all.
  it('says nothing after an expression it cannot type', () => {
    expect(labels('const other = 5;\nreturn other.|')).toEqual([]);
    expect(labels('const me = stats[0];\nreturn me.name.|')).toEqual([]);
    expect(labels('return "text".|')).toEqual([]);
    // `filter` hands back another array, so the chain is no more a stat than `stats` itself is.
    expect(labels('return stats.filter(s => s.value > 0).|')).toEqual([]);
  });

  it('still names a stat behind the operators an expression is written with', () => {
    const doc = 'const me = stats.find(s => s.id === currentStatId);\nif (!me.|) return 0;';
    expect(labels(doc)).toContain('value');
  });

  it('offers each built-in’s own members, and never a stat field among them', () => {
    for (const [builtin, expected] of [
      ['Math', 'round'], ['JSON', 'stringify'], ['Object', 'keys'], ['Number', 'isFinite'],
      ['Array', 'isArray'], ['String', 'fromCharCode'], ['Date', 'now'],
    ] as const) {
      const offered = labels(`return ${builtin}.|`);
      expect(offered, builtin).toContain(expected);
      expect(offered, builtin).not.toContain('regen');
      expect(offered, builtin).not.toContain('value');
    }
    // Boolean has no static members worth offering; what matters is that silence is what it gets.
    expect(labels('return Boolean.|')).toEqual([]);
  });

  it('completes a half-typed built-in member rather than starting the list over', () => {
    const result = completeAt('return Math.ro|');
    expect(result?.options.map(option => option.label)).toContain('round');
    expect(result?.from).toBe('return Math.'.length);
    expect(result?.to).toBe('return Math.ro'.length);
  });

  it('offers array members after stats, which is not itself a stat', () => {
    const offered = labels('return stats.|');
    expect(offered).toEqual(['find', 'filter', 'map', 'some', 'every', 'reduce', 'at', 'length']);
  });

  // The info string is what the popup's description card reads out, and it is the only place the editor
  // gets to explain the sandbox as the author types.
  it('explains every member it offers', () => {
    for (const doc of ['return Math.|', 'return stats.|', 'return stats[0].|', 'return self.previous.|', 'return self.requested.|']) {
      const options = completeAt(doc)?.options ?? [];
      expect(options.length, doc).toBeGreaterThan(0);
      for (const option of options) expect(option.info, `${doc} ${option.label}`).toBeTruthy();
    }
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

describe('placeholders in stat code', () => {
  const ph = (id: string, name: string, over: Partial<Placeholder> = {}): Placeholder => ({
    id, name, values: phValues(['a', 'b']), ...over,
  });
  const world = [ph('mood', 'Mood'), ph('eyes', 'Eye Color')];

  it('says nothing about names the world has, by dot or by bracket', () => {
    expect(messages('return placeholders.Mood.value.length + placeholders["Eye Color"].values.length;', { placeholders: { list: world } }))
      .toEqual([]);
  });

  it('flags a name no placeholder has, and names the one it was reaching for', () => {
    const [problem] = statCodeDiagnostics('return placeholders.Mod.value.length;', { placeholders: { list: world } });
    expect(problem.severity).toBe('error');
    expect(problem.message).toBe('No placeholder is named “Mod”. Did you mean “Mood”?');
  });

  it('flags an unknown name in bracket syntax', () => {
    expect(messages('return placeholders["Eye Colour"].value.length;', { placeholders: { list: world } }))
      .toEqual(['No placeholder is named “Eye Colour”. Did you mean “Eye Color”?']);
  });

  it('flags every name when the world has no placeholders', () => {
    expect(messages('return placeholders.Mood.value.length;', { placeholders: { list: [] } }))
      .toEqual(['No placeholder is named “Mood”.']);
  });

  it('keeps quiet without a world to check against, and about a name computed at run time', () => {
    expect(messages('return placeholders.Mood.value.length;')).toEqual([]);
    expect(messages('const key = "Mood";\nreturn placeholders[key].value.length;', { placeholders: { list: [] } })).toEqual([]);
  });

  it('warns on a shared name and names the placeholder that wins', () => {
    // An owned placeholder is always a chip value of its owner.
    const molly = ph('molly', 'Molly', { values: [{ id: 'v:m2', text: encodePlaceholderToken({ id: 'm2', mode: 'world', placementId: 'p1' }) }] });
    const shared = [ph('m1', 'Mood'), molly, ph('m2', 'Mood', { ownerId: 'molly' })];
    expect(messages('return placeholders.Mood.value.length;', { placeholders: { list: shared } }))
      .toEqual(['2 placeholders are named “Mood”. This reads “Molly › Mood”, the last one authored.']);
  });

  it('names an entity’s own placeholder by its entity when it wins a shared name', () => {
    const list = [ph('m1', 'Mood'), ph('m2', 'Mood')];
    const owners = new Map([['m2', { kind: 'entity' as const, id: 'ent-bo', name: 'Bo' }]]);
    expect(messages('return placeholders.Mood.value.length;', { placeholders: { list, owners } }))
      .toEqual(['2 placeholders are named “Mood”. This reads “Bo › Mood”, the last one authored.']);
  });

  it('offers the names after placeholders., leaving out any a dot cannot reach', () => {
    expect(labels('return placeholders.|', { placeholders: { list: world } })).toEqual(['Mood']);
  });

  it('offers every name inside placeholders[""], and no stat name', () => {
    expect(labels('return placeholders["|"];', { placeholders: { list: world }, statNames: ['Health'] })).toEqual(['Mood', 'Eye Color']);
  });

  it('offers the entry members after a placeholder, by dot or by bracket', () => {
    const members = PLACEHOLDER_ENTRY_FIELDS.map(entry => entry.name);
    expect(labels('return placeholders.Mood.|', { placeholders: { list: world } })).toEqual(members);
    expect(labels('return placeholders["Eye Color"].|', { placeholders: { list: world } })).toEqual(members);
  });

  it('offers placeholders among the globals', () => {
    expect(labels('return pla|')).toContain('placeholders');
  });
});
