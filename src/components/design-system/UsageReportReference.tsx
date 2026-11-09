import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UsagePanel } from '@/components/menu/UsageTab';
import { createDevUsageApi } from '@/lib/devUsageSample';

const SAMPLE_API = createDevUsageApi();

/** The production panel over canned figures, with no endpoint call. */
export function UsageReportReference() {
  return (
    <Card role="region" aria-labelledby="usage-report-title">
      <CardHeader>
        <CardTitle id="usage-report-title">Usage Report</CardTitle>
        <CardDescription>Section tabs, figure tiles, a day chart, ranked bars and the tables that hold their exact figures.</CardDescription>
      </CardHeader>
      <CardContent>
        <UsagePanel active api={SAMPLE_API} />
      </CardContent>
    </Card>
  );
}
