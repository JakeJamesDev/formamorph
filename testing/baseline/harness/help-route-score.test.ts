import { describe, expect, it } from 'vitest';
import { formatRouteReport, routeReports, routeRows, scoreRoute, type RouteRow } from './help-route-score';

describe('scoreRoute', () => {
  it('hits when the route is the expected surface', () => {
    expect(scoreRoute('settings.display', 'settings.display')).toBe('hit');
  });

  it('misses when the route is another surface', () => {
    expect(scoreRoute('settings.display', 'settings.output')).toBe('miss');
  });

  it('gives no-route when a surface is expected and the section has no route', () => {
    expect(scoreRoute('settings.display', undefined)).toBe('no-route');
  });

  it('hits a question with no single surface when the section has no route', () => {
    expect(scoreRoute(null, undefined)).toBe('hit');
  });

  it('misses a question with no single surface when the section carries a route', () => {
    expect(scoreRoute(null, 'settings.display')).toBe('miss');
  });
});

describe('routeRows', () => {
  const routes: Record<string, string | undefined> = { 'A#one': 'settings.display', 'A#two': undefined };
  const routeOf = (section: string) => routes[section];

  it('reads the route of each keyed section, for task and here questions only', () => {
    const rows = routeRows([
      { id: 'q1', kind: 'task', section: 'A#one', expectSurface: 'settings.display' },
      { id: 'q2', kind: 'here', section: 'A#two', expectSurface: 'settings.output' },
      { id: 'q3', kind: 'followUp', section: 'A#one', expectSurface: undefined },
      { id: 'q4', kind: 'changelog', section: 'Changelog#*', expectSurface: undefined },
    ], routeOf);
    expect(rows).toEqual([
      { id: 'q1', kind: 'task', expectSurface: 'settings.display', route: 'settings.display', verdict: 'hit' },
      { id: 'q2', kind: 'here', expectSurface: 'settings.output', route: undefined, verdict: 'no-route' },
    ]);
  });

  it('refuses a task or here question with no expected surface field', () => {
    expect(() => routeRows([{ id: 'q1', kind: 'task', section: 'A#one', expectSurface: undefined }], routeOf)).toThrow('q1');
  });

  it('refuses a task or here question with no keyed section', () => {
    expect(() => routeRows([{ id: 'q2', kind: 'here', expectSurface: 'settings.output' }], routeOf)).toThrow('q2');
  });
});

describe('routeReports', () => {
  const row = (id: string, kind: 'task' | 'here', expectSurface: string | null, route: string | undefined, verdict: RouteRow['verdict']): RouteRow => ({ id, kind, expectSurface, route, verdict });
  const rows = [
    row('t1', 'task', 'a', 'a', 'hit'),
    row('t2', 'task', 'a', 'b', 'miss'),
    row('t3', 'task', 'a', undefined, 'no-route'),
    row('t4', 'task', null, undefined, 'hit'),
    row('t5', 'task', null, 'a', 'miss'),
    row('h1', 'here', 'a', 'a', 'hit'),
  ];

  it('counts each kind apart, with the questions that expect no surface on their own line', () => {
    const [task, here] = routeReports(rows);
    expect(task).toMatchObject({ kind: 'task', surfaced: { hit: 1, miss: 1, noRoute: 1 }, unsurfaced: { hit: 1, miss: 1 } });
    expect(here).toMatchObject({ kind: 'here', surfaced: { hit: 1, miss: 0, noRoute: 0 }, unsurfaced: { hit: 0, miss: 0 } });
  });

  it('names the misses and the no-routes', () => {
    const [task] = routeReports(rows);
    expect(task.problems.map((p) => p.id)).toEqual(['t2', 't3', 't5']);
  });

  it('prints the table with the counts and each problem by name', () => {
    const text = formatRouteReport(routeReports(rows));
    expect(text).toContain('task');
    expect(text).toMatch(/surfaced\s+hit\s+1\s+miss\s+1\s+no-route\s+1/);
    expect(text).toMatch(/no surface\s+hit\s+1\s+miss\s+1/);
    expect(text).toContain('t2: expected a, route b');
    expect(text).toContain('t3: expected a, no route');
    expect(text).toContain('t5: expected no surface, route a');
  });
});
