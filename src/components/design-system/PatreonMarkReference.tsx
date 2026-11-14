import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta, SectionTitle } from '@/components/ui/typography';
import { PATREON_TONE, PatreonIcon, PatreonMark } from '@/components/PatreonMark';
import { WorldActionButton } from '@/components/WorldActionButton';
import { WorldCardFace } from '@/components/WorldCardFace';
import { SUPPORTER_WORLD_TIP as TIP } from '@/lib/supporterCopy';

const SAMPLE_WORLD = { id: 'sample-supporter-world', name: 'Sedge Landing', description: 'A fen town at the edge of the marsh.', thumbnail: '' };

/** One surface of the sample. The class and `data-theme` pin the mode, so both render at once. */
function ThemePanel({ mode, children }: { mode: 'light' | 'dark'; children: ReactNode }) {
  return (
    <section
      aria-label={`${mode === 'light' ? 'Light' : 'Dark'} Theme`}
      className={`${mode} min-w-0 space-y-5 rounded-md border border-border bg-background p-4 text-foreground`}
      data-theme="blue"
    >
      <SectionTitle>{mode === 'light' ? 'Light' : 'Dark'}</SectionTitle>
      {children}
    </section>
  );
}

function Sample() {
  const mark = <PatreonMark label="Supporter world" tip={TIP} />;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Meta>Sizes</Meta>
        <div className="flex items-center gap-3">
          <PatreonMark label="Supporter world" tip={TIP} />
          <PatreonMark label="Supporter world" tip={TIP} size="md" />
        </div>
      </div>
      <div className="space-y-2">
        <Meta>The Button It Comes From</Meta>
        <div className="max-w-xs">
          <WorldActionButton tone={PATREON_TONE}><PatreonIcon className="mr-2 h-4 w-4" />Patreon</WorldActionButton>
        </div>
      </div>
      <div className="space-y-2">
        <Meta>On a World Card</Meta>
        <div className="grid grid-cols-2 items-start gap-3">
          <div className="h-36"><WorldCardFace world={SAMPLE_WORLD} layout="grid" onSelect={() => {}} badge={mark} fill /></div>
          <WorldCardFace world={SAMPLE_WORLD} layout="detailed" onSelect={() => {}} badge={mark} note={<div className="mb-2">{mark}</div>} />
        </div>
      </div>
    </div>
  );
}

/** The Patreon mark: the Patreon button's heart in its gradient, on every item that comes with Patreon support. */
export function PatreonMarkReference() {
  return (
    <Card role="region" aria-labelledby="patreon-mark-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="patreon-mark-reference-title" className="text-heading">Patreon Mark Reference</CardTitle>
        <CardDescription>Shows the Patreon heart at both sizes, beside its button, and on a world card</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ThemePanel mode="light"><Sample /></ThemePanel>
        <ThemePanel mode="dark"><Sample /></ThemePanel>
      </CardContent>
    </Card>
  );
}
