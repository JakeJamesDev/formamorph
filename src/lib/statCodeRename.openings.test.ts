/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import type { Opening, Script } from '@/types';
import { openingNameReferences, openingNamesOf, openingRenameScope } from './openingNameCode';
import { pickedEdits, planCodeRename, type OpeningRenameScope } from './statCodeRename';

const WORLD: OpeningRenameScope = { ownerNames: null, shared: false };
const AKI: OpeningRenameScope = { ownerNames: ['Aki'], shared: true };

const plan = (from: string, to: string, code: string, opening: OpeningRenameScope = WORLD) =>
  planCodeRename({
    root: 'openings', oldName: from, newName: to, stats: [], otherNames: [], opening,
    worldScripts: [{ id: 'w', timing: 'after', code } satisfies Script],
  });
const renamed = (from: string, to: string, code: string, opening?: OpeningRenameScope) => plan(from, to, code, opening)?.edits[0]?.scripts.w;
/** The code after the author checks every pick too. */
const everything = (from: string, to: string, code: string, opening: OpeningRenameScope) => {
  const found = plan(from, to, code, opening);
  const ids = new Set((found?.pickBoxes ?? []).flatMap((box) => box.unsure.map((pick) => pick.id)));
  return pickedEdits(found?.pickBoxes ?? [], ids).edits[0]?.scripts.w;
};

describe('an Opening rename in scripts', () => {
  it('rewrites `opening.name === "ambush"` when no other owner has that name', () => {
    expect(renamed('ambush', 'raid', 'if (opening.name === "ambush") { stats.Fear = 5; }')).toBe('if (opening.name === "raid") { stats.Fear = 5; }');
  });

  it('reads either operand order, all four equality operators, and a switch case', () => {
    const code = [
      "if ('ambush' == opening.name) {}",
      'if (opening?.name !== "ambush") {}',
      'if (opening["name"] != "ambush") {}',
      'switch (opening.name) { case "ambush": break; case "quiet": break; }',
    ].join('\n');
    expect(renamed('ambush', 'raid', code)).toBe(code.replaceAll('ambush', 'raid'));
  });

  it('rewrites only the literal, so the quote the author used survives', () => {
    expect(renamed('ambush', 'raid', "x = opening.name === 'ambush';")).toBe("x = opening.name === 'raid';");
  });

  it('leaves a comparison of another name, another member, or a variable alone', () => {
    const code = 'if (opening.name === "quiet" || opening.kind === "ambush" || turn.action === "ambush" || opening.name === wanted) {}';
    expect(plan('ambush', 'raid', code)).toBeNull();
  });

  it('leaves code that declares its own `opening`', () => {
    expect(plan('ambush', 'raid', 'const opening = { name: "x" }; if (opening.name === "ambush") {}')).toBeNull();
  });

  it('offers nothing for a cleared name, and the code stays as written', () => {
    expect(plan('ambush', '', 'if (opening.name === "ambush") {}')).toBeNull();
    expect(plan('ambush', '  ', 'if (opening.name === "ambush") {}')).toBeNull();
  });

  it('offers nothing without the owner, or when no script names the Opening', () => {
    expect(planCodeRename({ root: 'openings', oldName: 'ambush', newName: 'raid', stats: [], otherNames: [], worldScripts: [{ id: 'w', timing: 'after', code: 'opening.name === "ambush"' }] })).toBeNull();
    expect(plan('ambush', 'raid', 'if (opening.name === "quiet") {}')).toBeNull();
  });
});

describe('an Opening rename scoped by owner (Q3, Q13)', () => {
  const both = [
    'if (opening.owner.name === "Aki" && opening.name === "ambush") { a(); }',
    'if (opening.owner.name === "Bex" && opening.name === "ambush") { b(); }',
  ].join('\n');

  it('rewrites the comparison guarded by this owner and leaves the other owner’s', () => {
    expect(renamed('ambush', 'raid', both, AKI)).toBe(both.replace('Aki" && opening.name === "ambush', 'Aki" && opening.name === "raid'));
  });

  it('reads the guard from an enclosing if, a ternary, and either operand order', () => {
    const code = [
      'if ("Bex" === opening.owner.name) { if (opening.name === "ambush") { b(); } }',
      'const x = opening.owner.name == "Aki" ? (opening.name === "ambush") : 0;',
    ].join('\n');
    expect(renamed('ambush', 'raid', code, AKI)).toBe([
      'if ("Bex" === opening.owner.name) { if (opening.name === "ambush") { b(); } }',
      'const x = opening.owner.name == "Aki" ? (opening.name === "raid") : 0;',
    ].join('\n'));
  });

  it('matches the owner by its name or its code name', () => {
    const scope: OpeningRenameScope = { ownerNames: ['Aki {{Last}}', 'Aki'], shared: true };
    const code = 'opening.owner.name === "Aki" && opening.name === "ambush";';
    expect(renamed('ambush', 'raid', code, scope)).toBe(code.replace('"ambush"', '"raid"'));
  });

  it('reads a null owner as the world’s own Openings', () => {
    const code = 'if (!opening.owner && opening.name === "ambush") {}\nif (opening.owner === null && opening.name === "ambush") {}';
    expect(renamed('ambush', 'raid', code, { ownerNames: null, shared: true })).toBe(code.replaceAll('"ambush"', '"raid"'));
    expect(plan('ambush', 'raid', code, AKI)).toBeNull();
  });

  it('leaves an unguarded comparison to the author’s pick while another owner holds the name', () => {
    const code = 'if (opening.name === "ambush") {}';
    const found = plan('ambush', 'raid', code, AKI);
    expect(found?.references).toBe(0);
    expect(found?.pickBoxes?.[0].unsure).toHaveLength(1);
    expect(everything('ambush', 'raid', code, AKI)).toBe('if (opening.name === "raid") {}');
  });

  it('leaves a guard it cannot read to an owner to the author’s pick', () => {
    const code = 'if (opening.owner === entities.Aki && opening.name === "ambush") {}\nif (opening.owner.name !== "Bex" && opening.name === "ambush") {}';
    const found = plan('ambush', 'raid', code, { ownerNames: ['Aki'], shared: false });
    expect(found?.references).toBe(0);
    expect(found?.pickBoxes?.[0].unsure).toHaveLength(2);
  });

  it('rewrites a guarded comparison outright even where another owner holds the name', () => {
    expect(plan('ambush', 'raid', 'opening.owner.name === "Aki" && opening.name === "ambush";', AKI)?.references).toBe(1);
  });
});

describe('the scope an Opening rename reads from the world', () => {
  const opening = (id: string, name?: string): Opening => ({ id, kind: 'action', text: '', ...(name && { name }) }) as Opening;
  const world = {
    worldOpenings: [opening('w1', 'ambush')],
    entities: [{ id: 'aki', name: 'Aki', openings: [opening('a1', 'ambush'), opening('a2')] }, { id: 'bex', name: 'Bex', openings: [opening('b1', 'quiet')] }],
    locations: [{ id: 'inn', name: 'Inn', openings: [opening('i1', 'quiet')] }],
  };

  it('is shared while another owner keeps the old name', () => {
    expect(openingRenameScope(world, { kind: 'entity', id: 'aki' }, 'ambush', [])).toEqual({ ownerNames: ['Aki'], shared: true });
    expect(openingRenameScope(world, { kind: 'world' }, 'ambush', [])).toEqual({ ownerNames: null, shared: true });
  });

  it('is shared across owner kinds, and not once this owner is the only holder', () => {
    expect(openingRenameScope(world, { kind: 'entity', id: 'bex' }, 'quiet', [])?.shared).toBe(true);
    expect(openingRenameScope(world, { kind: 'location', id: 'inn' }, 'quiet', [])?.shared).toBe(true);
    expect(openingRenameScope({ ...world, worldOpenings: [] }, { kind: 'entity', id: 'aki' }, 'ambush', [])?.shared).toBe(false);
  });

  it('is null for an owner the world does not hold', () => {
    expect(openingRenameScope(world, { kind: 'entity', id: 'gone' }, 'ambush', [])).toBeNull();
  });

  it('lists every name any owner carries, unnamed rows left out', () => {
    expect(openingNamesOf(world)).toEqual(['ambush', 'ambush', 'quiet', 'quiet']);
  });
});

describe('reading Opening names from code', () => {
  it('reports each literal with the owner the code ties it to', () => {
    const code = 'opening.name === "a";\nopening.owner.name === "Aki" && opening.name === "b";\n!opening.owner && opening.name === "c";\nopening.owner && opening.name === "d";';
    expect(openingNameReferences(code).map(({ key, guard }) => [key.name, guard.kind])).toEqual([
      ['a', 'none'], ['b', 'owner'], ['c', 'world'], ['d', 'unknown'],
    ]);
  });
});
