import { describe, it, expect } from 'vitest';
import { migrateStatCodeRoutes } from './statCodeRoutes';
import type { PlaceholderOwners } from './placeholderHomes';
import type { PlaceholderPathSource } from './statCodePaths';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

const ph = (id: string, name: string, values: readonly string[] = ['x'], over: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values: phValues(values), ...over });

/** A value that is exactly one chip of `id`, which nests that placeholder under the one holding it. */
const chip = (id: string) => `{{ph:${id}:world:p-${id}}}`;

const NONE: PlaceholderPathSource = { list: [] };

describe('migrateStatCodeRoutes: flat clock and currentStatId', () => {
  const rewrite = (code: string) => migrateStatCodeRoutes(code, NONE);

  it('rewrites each flat clock name to its clock path', () => {
    expect(rewrite('return deltaHours + elapsedHours + day;'))
      .toBe('return clock.deltaHours + clock.elapsedHours + clock.day;');
    expect(rewrite("if (daypart === 'night' && startDaypart !== daypart) return startDay;"))
      .toBe("if (clock.daypart === 'night' && clock.previous.daypart !== clock.daypart) return clock.previous.day;");
  });

  it('rewrites currentStatId to self.id', () => {
    expect(rewrite('log(currentStatId);')).toBe('log(self.id);');
  });

  it('spells a shorthand property out, so the object keeps its key', () => {
    expect(rewrite('const at = { day, daypart };')).toBe('const at = { day: clock.day, daypart: clock.daypart };');
  });

  it('rewrites inside a template interpolation', () => {
    expect(rewrite('console.log(`${deltaHours}h`);')).toBe('console.log(`${clock.deltaHours}h`);');
  });

  it('leaves members, keys and strings that only share the name', () => {
    const code = "const o = { day: 1 }; return o.day + stats['day'].value + 'deltaHours'.length;";
    expect(rewrite(code)).toBe(code);
  });

  it('leaves a name the author declared, everywhere in the code', () => {
    const code = 'const day = 3;\nreturn day + deltaHours;';
    expect(rewrite(code)).toBe('const day = 3;\nreturn day + clock.deltaHours;');
    expect(rewrite('const f = (elapsedHours) => elapsedHours; return f(2);')).toBe('const f = (elapsedHours) => elapsedHours; return f(2);');
  });

  it('leaves the clock names where the author declared clock, and currentStatId where they declared self', () => {
    const code = 'const clock = 1; const self = 2; return day + clock + currentStatId;';
    expect(rewrite(code)).toBe(code);
  });

  it('changes nothing on a second run', () => {
    const once = rewrite('return { day } && startDay + currentStatId.length + deltaHours;');
    expect(rewrite(once)).toBe(once);
  });
});

describe('migrateStatCodeRoutes: placeholder routes', () => {
  // The world holds Mood, and Hair › Shade. Molly owns Eyes › Tint; the Weather book owns Sky.
  const mood = ph('mood', 'Mood');
  const hair = ph('hair', 'Hair', [chip('shade')]);
  const shade = ph('shade', 'Shade', ['ash'], { ownerId: 'hair' });
  const eyes = ph('eyes', 'Eyes', [chip('tint')]);
  const tint = ph('tint', 'Tint', ['blue'], { ownerId: 'eyes' });
  const oldEye = ph('old-eye', 'Eye Color');
  const sky = ph('sky', 'Sky');
  const owners: PlaceholderOwners = new Map([
    ['eyes', { kind: 'entity', id: 'molly', name: 'Molly' }],
    ['tint', { kind: 'entity', id: 'molly', name: 'Molly' }],
    ['old-eye', { kind: 'entity', id: 'old', name: 'Old Molly' }],
    ['sky', { kind: 'dictionary', id: 'weather', name: 'Weather' }],
  ]);
  const source: PlaceholderPathSource = { list: [mood, hair, shade, eyes, tint, oldEye, sky], owners };
  const rewrite = (code: string) => migrateStatCodeRoutes(code, source);

  it('moves an owner path onto its owner entry', () => {
    expect(rewrite("placeholders.Molly.Eyes.pin('green');")).toBe("entities.Molly.placeholders.Eyes.pin('green');");
    expect(rewrite('return placeholders.Weather.Sky.text;')).toBe('return dictionaries.Weather.placeholders.Sky.text;');
    expect(rewrite("placeholders['Old Molly']['Eye Color'].value"))
      .toBe("entities['Old Molly'].placeholders['Eye Color'].value");
  });

  it('gives an owned bare name its owner path', () => {
    expect(rewrite('placeholders.Eyes.value')).toBe('entities.Molly.placeholders.Eyes.value');
    expect(rewrite('placeholders.Tint.value')).toBe('entities.Molly.placeholders.Eyes.Tint.value');
    expect(rewrite("placeholders['Eye Color'].value")).toBe("entities[\"Old Molly\"].placeholders['Eye Color'].value");
  });

  it('gives a nested world row its full path', () => {
    expect(rewrite("placeholders.Shade.pin('ash');")).toBe("placeholders.Hair.Shade.pin('ash');");
  });

  it('leaves the world’s own rows and their paths', () => {
    const code = "placeholders.Mood.pin('calm'); placeholders.Hair.Shade.value; placeholders.Nope.value;";
    expect(rewrite(code)).toBe(code);
  });

  it('keeps a world row that shares a bare name with an owned one on the world row', () => {
    const own = ph('own-eyes', 'Eyes');
    const shared: PlaceholderPathSource = { list: [own, eyes], owners };
    expect(migrateStatCodeRoutes('placeholders.Eyes.value', shared)).toBe('placeholders.Eyes.value');
  });

  it('leaves code that declares placeholders itself', () => {
    const code = 'const placeholders = {}; return placeholders.Molly.Eyes;';
    expect(rewrite(code)).toBe(code);
  });

  it('changes nothing on a second run', () => {
    const once = rewrite('placeholders.Molly.Eyes.value + placeholders.Tint.value + placeholders.Shade.value + day');
    expect(once).toBe('entities.Molly.placeholders.Eyes.value + entities.Molly.placeholders.Eyes.Tint.value'
      + ' + placeholders.Hair.Shade.value + clock.day');
    expect(rewrite(once)).toBe(once);
  });
});
