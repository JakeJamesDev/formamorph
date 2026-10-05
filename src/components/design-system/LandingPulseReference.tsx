import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckRow, OptionSwitcher, Row, Section } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SectionTitle } from '@/components/ui/typography';
import { SETTINGS_OPTIONS } from '@/components/modals/settingsCopy';
import { optionRowCopy, rowCopy } from '@/components/modals/settingsRowCopy';
import type { ParagraphLimit } from '@/lib/outputLength';
import { landingControl, pulseLanding } from '@/lib/landingPulse';

type Target = 'modelName' | 'paragraphLimit' | 'showReasoning';

const TARGETS: readonly { value: Target; label: string }[] = [
  { value: 'modelName', label: 'Model Name' },
  { value: 'paragraphLimit', label: 'Paragraph Limit' },
  { value: 'showReasoning', label: 'Show Reasoning' },
];

/** A sample Settings tab in one theme. **Play Landing** pulses the target row and focuses its control. */
function ThemePanel({ mode, target, reducedMotion }: { mode: 'light' | 'dark'; target: Target; reducedMotion: boolean }) {
  const name = mode === 'light' ? 'Light' : 'Dark';
  const rows = useRef<Partial<Record<Target, HTMLDivElement | null>>>({});
  const cancel = useRef<(() => void) | null>(null);
  const [modelName, setModelName] = useState('Silver Siren 12B');
  const [paragraphLimit, setParagraphLimit] = useState<ParagraphLimit>('auto');
  const [showReasoning, setShowReasoning] = useState(true);
  useEffect(() => () => cancel.current?.(), []);

  const land = () => {
    const row = rows.current[target];
    if (!row) return;
    landingControl(row)?.focus();
    cancel.current = pulseLanding(row, { reducedMotion });
  };
  const slot = (key: Target, children: ReactNode) => (
    <div ref={(node) => { rows.current[key] = node; }} data-landing-sample={key}>{children}</div>
  );

  return (
    <section
      aria-label={`${name} Theme`}
      className={`${mode} min-w-0 space-y-5 rounded-md border border-border bg-background p-4 text-foreground`}
      data-theme="blue"
    >
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>{name}</SectionTitle>
        <Button variant="outline" size="sm" onClick={land}>Play Landing</Button>
      </div>
      <Section title="Output">
        {slot('modelName', (
          <Row htmlFor={`landing-model-${mode}`} {...rowCopy('modelName')}>
            <Input id={`landing-model-${mode}`} value={modelName} onChange={(event) => setModelName(event.target.value)} />
          </Row>
        ))}
        {slot('paragraphLimit', (
          <Row top {...optionRowCopy('paragraphLimit', SETTINGS_OPTIONS.paragraphLimit.find((option) => option.value === paragraphLimit))}>
            <OptionSwitcher
              ariaLabel="Paragraph Limit"
              value={paragraphLimit}
              onChange={setParagraphLimit}
              options={SETTINGS_OPTIONS.paragraphLimit}
            />
          </Row>
        ))}
        {slot('showReasoning', (
          <CheckRow
            htmlFor={`landing-reasoning-${mode}`}
            checked={showReasoning}
            onChange={setShowReasoning}
            {...rowCopy('showReasoning')}
          />
        ))}
      </Section>
    </section>
  );
}

/** Landing Pulse: the ring a Take Me There landing draws on its row, in both themes at once. */
export function LandingPulseReference() {
  const [target, setTarget] = useState<Target>('paragraphLimit');
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <Card role="region" aria-labelledby="landing-pulse-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="landing-pulse-reference-title" className="text-heading">Landing Pulse Reference</CardTitle>
        <CardDescription>This reference shows the ring that points at a row after a Take Me There landing.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <OptionSwitcher ariaLabel="Target Row" value={target} onChange={setTarget} options={TARGETS} />
          <label htmlFor="landing-reduced-motion" className="flex items-center gap-2 text-label">
            <Checkbox id="landing-reduced-motion" checked={reducedMotion} onCheckedChange={(value) => setReducedMotion(value === true)} />
            Reduced Motion
          </label>
        </div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <ThemePanel mode="light" target={target} reducedMotion={reducedMotion} />
          <ThemePanel mode="dark" target={target} reducedMotion={reducedMotion} />
        </div>
      </CardContent>
    </Card>
  );
}
