import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta } from '@/components/ui/typography';
import { AllowanceRingGlyph } from '@/components/game/AllowanceRingGlyph';
import { HostedBreakdown } from '@/components/modals/HostedBreakdown';
import { allowanceTone } from '@/lib/hostedAi/allowanceFigure';
import { DEV_HOSTED_SAMPLES } from '@/lib/hostedAi/devHostedSamples';

const BREAKDOWN = DEV_HOSTED_SAMPLES.ready!;

const STATES: { percent: number | null; label: string }[] = [
  { percent: 32, label: 'Normal' },
  { percent: 78, label: 'Lower threshold' },
  { percent: 93, label: 'Highest threshold' },
  { percent: 100, label: 'Allowance used' },
  { percent: null, label: 'No usage figure' },
];

/** The ring's popover needs the app's contexts; it shows on the game view at `allowance=<state>`. */
export function AllowanceRingReference() {
  return (
    <Card role="region" aria-labelledby="allowance-ring-title">
      <CardHeader>
        <CardTitle id="allowance-ring-title">Allowance Ring</CardTitle>
        <CardDescription>A filling ring between Help and Send, with its breakdown bars below.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-6">
          {STATES.map(({ percent, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <Button variant="outline" size="icon" aria-label={label}>
                <AllowanceRingGlyph percent={percent} tone={allowanceTone(percent, BREAKDOWN.warnThresholds)} />
              </Button>
              <Meta>{label}</Meta>
            </div>
          ))}
        </div>
        <div className="max-w-sm">
          <HostedBreakdown breakdown={BREAKDOWN.breakdown ?? {}} threshold={BREAKDOWN.breakdownThreshold} />
        </div>
      </CardContent>
    </Card>
  );
}
