import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Meta, SectionTitle } from '@/components/ui/typography';
import { EntityListRow } from '@/components/game/EntityListRow';
import { YouMark } from '@/components/game/YouMark';

const PANELS = [
  { mode: 'light', palette: 'blue', label: 'Light' },
  { mode: 'dark', palette: 'blue', label: 'Dark' },
  { mode: 'dark', palette: 'purple', label: 'Dark Purple' },
] as const;

/** One surface of the sample. The class and `data-theme` pin the mode and palette, so all render at once. */
function ThemePanel({ mode, palette, label }: (typeof PANELS)[number]) {
  return (
    <section
      aria-label={`${label} Theme`}
      className={`${mode} min-w-0 space-y-4 rounded-md border border-border bg-background p-4 text-foreground`}
      data-theme={palette}
    >
      <SectionTitle>{label}</SectionTitle>
      <div className="space-y-2">
        <Meta>Plain Row</Meta>
        <div className="rounded-md border border-border bg-card p-1">
          <EntityListRow label="Kate" you />
          <EntityListRow label="Bram" following />
        </div>
      </div>
      <div className="space-y-2">
        <Meta>Selected Row</Meta>
        <div className="rounded-md border border-border bg-card p-1">
          <CompactSelectionRow selected>Kate<YouMark onFill /></CompactSelectionRow>
          <CompactSelectionRow>Bram</CompactSelectionRow>
        </div>
      </div>
    </section>
  );
}

/** The You pill on a plain row and on a selected row, in light, dark and one colored palette. */
export function YouMarkReference() {
  return (
    <Card role="region" aria-labelledby="you-mark-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="you-mark-reference-title" className="text-heading">You Pill Reference</CardTitle>
        <CardDescription>The pill follows the played persona’s name. A selected row inverts it onto the primary fill.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 lg:grid-cols-3">
        {PANELS.map((panel) => <ThemePanel key={panel.label} {...panel} />)}
      </CardContent>
    </Card>
  );
}
