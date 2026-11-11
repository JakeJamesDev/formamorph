import { HereMark } from '@/components/HereMark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

const START = 'flex items-center gap-1.5 rounded-md border px-2 py-1 text-label';

/** The mark on a Start, a routine row and a Can Also Go entry, beside the same parts unmarked. */
export function HereMarkReference() {
  return (
    <Card role="region" aria-labelledby="here-mark-title">
      <CardHeader>
        <CardTitle id="here-mark-title">Here Mark</CardTitle>
        <CardDescription>A map pin on the routine parts that name the location whose Presence tab shows them.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1">
          <span className={cn(START, 'border-transparent')}>Start 1</span>
          <span className={cn(START, 'border-primary bg-accent')}>Start 2<HereMark locationName="Tavern" /></span>
        </div>
        <p className="text-label leading-7">
          <HereMark locationName="Tavern" className="mr-1.5 align-middle" />
          Dawn – Morning, stays at Tavern.
        </p>
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-label text-secondary-foreground">
          Tavern<HereMark locationName="Tavern" />
        </span>
        <Meta>The mark&apos;s name reads &quot;Names Tavern&quot;. It shows only on the Presence tab.</Meta>
      </CardContent>
    </Card>
  );
}
