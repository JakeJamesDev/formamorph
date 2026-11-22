import { describe, expect, it } from 'vitest';
import { codeDiagnostics } from './statCodeAnalysis';
import { scriptSurface, SCRIPT_SURFACES } from './statCodeSurface';

const surface = scriptSurface(SCRIPT_SURFACES.world, 'start');
const check = (code: string, openingNames?: readonly string[]) => codeDiagnostics(code, { surface, openingNames });

describe('code analysis of Opening names', () => {
  it('flags a comparison against a name no Opening has', () => {
    const [problem, ...rest] = check('if (opening.name === "typo") { return 1; }', ['ambush', 'quiet']);
    expect(rest).toEqual([]);
    expect(problem).toMatchObject({ severity: 'warning', message: 'No Opening is named “typo”.' });
  });

  it('stays quiet for a name some Opening has, whoever owns it', () => {
    expect(check('if (opening.name === "ambush" || "quiet" === opening.name) {}', ['ambush', 'quiet'])).toEqual([]);
  });

  it('flags the old name once a rename or a cleared name leaves no Opening with it', () => {
    expect(check('if (opening.name === "ambush") {}', ['quiet']).map((d) => d.message)).toEqual(['No Opening is named “ambush”.']);
    expect(check('if (opening.name === "ambush") {}', []).map((d) => d.message)).toEqual(['No Opening is named “ambush”.']);
  });

  it('offers the near name as a fix that keeps the author’s quote', () => {
    const [problem] = check("if (opening.name === 'ambsh') {}", ['ambush']);
    expect(problem.message).toBe('No Opening is named “ambsh”. Did you mean “ambush”?');
    expect(problem.fixes?.[0]).toMatchObject({ insert: "'ambush'" });
  });

  it('flags a switch case', () => {
    expect(check('switch (opening.name) { case "typo": break; }', ['ambush']).map((d) => d.message)).toEqual(['No Opening is named “typo”.']);
  });

  it('checks nothing where the host passes no Opening names', () => {
    expect(check('if (opening.name === "typo") {}')).toEqual([]);
  });

  it('checks nothing where the code declares its own `opening`', () => {
    expect(check('const opening = { name: "x" }; if (opening.name === "typo") {}', ['ambush'])).toEqual([]);
  });

  it('leaves a comparison with another member or a variable', () => {
    expect(check('const wanted = "x"; if (opening.kind === "typo" || opening.name === wanted) {}', ['ambush'])).toEqual([]);
  });
});
