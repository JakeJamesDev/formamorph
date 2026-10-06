import { useState, type ReactNode } from 'react';
import { PanelCrashCard } from '@/components/PanelCrashCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta, SectionTitle } from '@/components/ui/typography';

const SAMPLE_ROWS = ['Odd Wick', 'Marsh Tom', 'Wren'];

/** The editor list beside the crashed panel. It keeps working, so its rows stay as they are. */
function SampleList() {
  return (
    <ul className="space-y-1" aria-label="Sample entity list">
      {SAMPLE_ROWS.map((name) => (
        <li key={name} className="rounded-md border border-border bg-card px-3 py-2 text-label">{name}</li>
      ))}
    </ul>
  );
}

/** One crash card at one width. The narrow sample is as wide as a phone and shows the card alone, as the pushed detail does. */
function Sample({ title, width, onViewDetails, onTryAgain }: {
  title: string;
  width: 'wide' | 'narrow';
  onViewDetails: () => void;
  onTryAgain: () => void;
}) {
  const card = <PanelCrashCard onViewDetails={onViewDetails} onTryAgain={onTryAgain} />;
  let body: ReactNode;
  if (width === 'narrow') {
    body = <div className="w-[22rem] max-w-full rounded-md border border-border">{card}</div>;
  } else {
    body = (
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <SampleList />
        <div className="min-w-0 rounded-md border border-border">{card}</div>
      </div>
    );
  }
  return (
    <section aria-label={title} className="grid min-w-0 content-start gap-2">
      <Meta>{title}</Meta>
      {body}
    </section>
  );
}

/** The panel crash card in one theme, at both widths. The buttons only report what they do. */
function ThemePanel({ mode }: { mode: 'light' | 'dark' }) {
  const name = mode === 'light' ? 'Light' : 'Dark';
  const [status, setStatus] = useState('');
  const viewDetails = () => setStatus('View Details opens the Error Details dialog.');
  const tryAgain = () => setStatus('Try Again remounts the panel.');
  return (
    <section
      aria-label={`${name} Theme`}
      className={`${mode} min-w-0 space-y-4 rounded-md border border-border bg-background p-4 text-foreground`}
      data-theme="blue"
    >
      <SectionTitle>{name}</SectionTitle>
      <Sample title={`${name} Wide`} width="wide" onViewDetails={viewDetails} onTryAgain={tryAgain} />
      <Sample title={`${name} Narrow`} width="narrow" onViewDetails={viewDetails} onTryAgain={tryAgain} />
      <p role="status" className="min-h-5 text-helper text-muted-foreground">{status}</p>
    </section>
  );
}

/** Panel Crash Card: what a crashed World Editor panel shows in its own place, in both themes. */
export function PanelCrashCardReference() {
  return (
    <Card role="region" aria-labelledby="panel-crash-card-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="panel-crash-card-reference-title" className="text-heading">Panel Crash Card Reference</CardTitle>
        <CardDescription>This reference shows the card a crashed editor panel shows beside a list that keeps working.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ThemePanel mode="light" />
        <ThemePanel mode="dark" />
      </CardContent>
    </Card>
  );
}
