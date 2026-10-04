// Route-accuracy probe: does the keyed section's route name the surface the question is about?
//
// No model runs, so every number is exact and needs no control. Each keyed task and here question of
// help-baseline-cases.json carries `expectSurface`; the keyed section's route comes from the bundled docs.
// The report sets no bar. Per kind, "surfaced" counts the questions with a surface and "no surface" the
// ones whose steps have none, where the right route is none.
//
// Usage: npm run probe:help-route
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { loadBaselineCases } from './help-baseline-cases';
import { formatRouteReport, routeReports, routeRows } from './help-route-score';

const index = bundledDocsIndex();
const rows = routeRows(loadBaselineCases(), (section) => index.get([section])[0]?.route);
console.log(formatRouteReport(routeReports(rows)));
