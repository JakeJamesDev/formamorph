// The route-accuracy score of the keyed questions: does the keyed section's route name the surface the question is about.
// No model runs; `help-route-probe.cli.ts` prints the report.

/** `hit` the route is the expected surface; `miss` it is another one, or the question expects none and a route exists; `no-route` a surface is expected and the section has no route. */
export type RouteVerdict = 'hit' | 'miss' | 'no-route';

/** The expected surface is `null` for a question with no single surface: the right answer is no route. */
export function scoreRoute(expectSurface: string | null, route: string | undefined): RouteVerdict {
  if (expectSurface === null) return route === undefined ? 'hit' : 'miss';
  if (route === undefined) return 'no-route';
  return route === expectSurface ? 'hit' : 'miss';
}

export const ROUTE_KINDS = ['task', 'here'] as const;
export type RouteKind = (typeof ROUTE_KINDS)[number];

/** One scored question. */
export interface RouteRow {
  id: string;
  kind: RouteKind;
  expectSurface: string | null;
  route: string | undefined;
  verdict: RouteVerdict;
}

/** What `routeRows` reads of a question: its keyed section and its authored `expectSurface`. */
export interface RouteInput {
  id: string;
  kind: string;
  section?: string;
  expectSurface?: string | null;
}

/** Scores the task and here questions. A question of either kind with no expected-surface field is an error. */
export function routeRows(cases: readonly RouteInput[], routeOf: (section: string) => string | undefined): RouteRow[] {
  return cases.flatMap((c): RouteRow[] => {
    const kind = ROUTE_KINDS.find((k) => k === c.kind);
    if (!kind) return [];
    if (c.expectSurface === undefined || c.section === undefined) throw new Error(`${c.id} has no expected surface or keyed section`);
    const route = routeOf(c.section);
    return [{ id: c.id, kind, expectSurface: c.expectSurface, route, verdict: scoreRoute(c.expectSurface, route) }];
  });
}

export interface RouteTally { hit: number; miss: number; noRoute: number }

/** The counts of one kind. `surfaced` holds the questions that expect a surface; `unsurfaced` holds the ones that expect none. */
export interface RouteReport {
  kind: RouteKind;
  surfaced: RouteTally;
  unsurfaced: RouteTally;
  /** The misses and the no-routes, in question order. */
  problems: RouteRow[];
}

const tally = (rows: readonly RouteRow[]): RouteTally => ({
  hit: rows.filter((r) => r.verdict === 'hit').length,
  miss: rows.filter((r) => r.verdict === 'miss').length,
  noRoute: rows.filter((r) => r.verdict === 'no-route').length,
});

/** One report per kind. */
export function routeReports(rows: readonly RouteRow[]): RouteReport[] {
  return ROUTE_KINDS.map((kind) => {
    const own = rows.filter((r) => r.kind === kind);
    return {
      kind,
      surfaced: tally(own.filter((r) => r.expectSurface !== null)),
      unsurfaced: tally(own.filter((r) => r.expectSurface === null)),
      problems: own.filter((r) => r.verdict !== 'hit'),
    };
  });
}

/** The reports as the table the probe prints. */
export function formatRouteReport(reports: readonly RouteReport[]): string {
  const num = (n: number) => String(n).padStart(3);
  return reports.map((r) => {
    const total = (t: RouteTally) => t.hit + t.miss + t.noRoute;
    const lines = [
      `${r.kind} (${total(r.surfaced) + total(r.unsurfaced)} questions)`,
      `  surfaced    hit ${num(r.surfaced.hit)}  miss ${num(r.surfaced.miss)}  no-route ${num(r.surfaced.noRoute)}`,
      `  no surface  hit ${num(r.unsurfaced.hit)}  miss ${num(r.unsurfaced.miss)}`,
      ...r.problems.map((p) => `  ${p.verdict.padEnd(8)}  ${p.id}: expected ${p.expectSurface ?? 'no surface'}, ${p.route === undefined ? 'no route' : `route ${p.route}`}`),
    ];
    return lines.join('\n');
  }).join('\n\n');
}
