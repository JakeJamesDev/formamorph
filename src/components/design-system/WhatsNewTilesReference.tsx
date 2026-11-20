import seed from '../../../docs/whats-new/3.7.0.md?raw';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/typography';
import { WhatsNewTiles } from '@/components/whatsNew/WhatsNewTiles';
import { parseReleaseSummary } from '@/lib/whatsNew/releaseSummary';

const SUMMARY = parseReleaseSummary(seed).summary;

/** One mode of the tiles. The class and `data-theme` pin the mode, so both render at once. */
function ThemePanel({ mode }: { mode: 'light' | 'dark' }) {
  const name = mode === 'light' ? 'Light' : 'Dark';
  return (
    <section aria-label={`${name} Theme`} className={`${mode} min-w-0 space-y-3 rounded-md border border-border bg-background p-4 text-foreground`} data-theme="blue">
      <SectionTitle>{name}</SectionTitle>
      <WhatsNewTiles summary={SUMMARY} />
    </section>
  );
}

/** Accent-edge paired tiles: the 3.7.0 seed summary as What's New lays it out, both modes at once. */
export function WhatsNewTilesReference() {
  return (
    <Card role="region" aria-labelledby="whats-new-tiles-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="whats-new-tiles-reference-title" className="text-heading">Paired Tiles</CardTitle>
        <CardDescription>Shows each big change beside a related one, with the fixes in the last row</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        <ThemePanel mode="light" />
        <ThemePanel mode="dark" />
      </CardContent>
    </Card>
  );
}
