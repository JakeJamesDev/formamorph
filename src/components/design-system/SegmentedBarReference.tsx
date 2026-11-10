import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SegmentedBar, type BarSegment } from '@/components/ui/segmented-bar';
import { Meta } from '@/components/ui/typography';
import { bytes } from '@/lib/usageReport';

const GB = 1_000_000_000;

const DISK: BarSegment[] = [
  { key: 'worlds', label: 'Worlds', value: 41.2 * GB, color: 'hsl(var(--chart-2))' },
  { key: 'backups', label: 'Local Backups', value: 21.5 * GB, color: 'hsl(var(--chart-3))' },
  { key: 'database', label: 'Database', value: 9.7 * GB, color: 'hsl(var(--chart-1))' },
  { key: 'thumbnails', label: 'Thumbnails', value: 6.8 * GB, color: 'hsl(var(--chart-4))' },
  { key: 'other', label: 'Other Uploads', value: 2.8 * GB, color: 'hsl(var(--chart-5))' },
  { key: 'rest', label: 'System And App', value: 15.4 * GB, color: 'hsl(var(--muted-foreground) / 0.5)' },
];

const OVER: BarSegment[] = [
  { key: 'a', label: 'First Bucket', value: 8.1 * GB, color: 'hsl(var(--chart-2))' },
  { key: 'b', label: 'Second Bucket', value: 3.6 * GB, color: 'hsl(var(--chart-1))' },
];

/** The production bar over sample figures: a disk with alert marks, and a scale its segments pass. */
export function SegmentedBarReference() {
  return (
    <Card role="region" aria-labelledby="segmented-bar-title">
      <CardHeader>
        <CardTitle id="segmented-bar-title">Segmented Bar</CardTitle>
        <CardDescription>Parts of one whole on a flat track, with dashed marks and a legend of every segment.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8">
        <div className="grid gap-2">
          <Meta as="p">A 160 GB disk with marks at 80% and 90%</Meta>
          <SegmentedBar label="Disk Sample" scale={160 * GB} segments={DISK} marks={[{ at: 0.8, label: '80%' }, { at: 0.9, label: '90%' }]} format={bytes} />
        </div>
        <div className="grid gap-2">
          <Meta as="p">Two parts past a 10 GB scale: the bar is full</Meta>
          <SegmentedBar label="Over Scale Sample" scale={10 * GB} segments={OVER} format={bytes} />
        </div>
      </CardContent>
    </Card>
  );
}
