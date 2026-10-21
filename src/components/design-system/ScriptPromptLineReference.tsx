import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Meta } from '@/components/ui/typography';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { ScriptPromptLine, ScriptTellLines, type PromptLineLayout } from '@/components/game/ScriptPromptLine';
import { TurnCard } from '@/components/game/TurnCard';
import { SCRIPT_PROMPT_SAMPLES, type ScriptPromptSampleKey } from '@/lib/devScriptPromptSamples';
import { cancelOpenPrompts, createScriptPromptStore, noticeHost } from '@/lib/scriptPrompts';
import { useMountedRef } from '@/lib/useMountedRef';
import { useScriptPromptListener } from '@/lib/useScriptPromptListener';

const NARRATION = 'The keeper sets the lamp on the sill. Below the window, the tide pulls at the *eastern stair*.';

const SAMPLES: { key: ScriptPromptSampleKey; label: string }[] = [
  { key: 'confirm', label: 'Confirm' },
  { key: 'ask', label: 'Ask' },
  { key: 'askLong', label: 'Long Ask' },
  { key: 'askMulti', label: 'Multiple Ask' },
  { key: 'input', label: 'Input' },
  { key: 'tell', label: 'Tell' },
];

/** What the sample script read back, as the status line shows it. */
const readBack = (answer: unknown) => (answer === undefined ? 'nothing' : JSON.stringify(answer));

export function ScriptPromptLineReference() {
  // A store of the reference's own: nothing here reaches play.
  const store = useMemo(() => createScriptPromptStore(), []);
  const [layout, setLayout] = useState<PromptLineLayout>('pages');
  const [tells, setTells] = useState<{ text: string }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const mounted = useMountedRef();
  useScriptPromptListener(store);

  const fire = (key: ScriptPromptSampleKey) => {
    cancelOpenPrompts(store);
    setStatus(null);
    // The reference keeps a tell beside its turn, as play does.
    const host = noticeHost(store, { onTell: (text) => setTells((now) => [...now, { text }]), onToast: () => {} });
    host.prompt(SCRIPT_PROMPT_SAMPLES[key]).then(
      (answer) => { if (mounted.current) setStatus(`The script read ${readBack(answer)}`); },
      () => { if (mounted.current) setStatus('The script stopped as canceled'); },
    );
  };

  return (
    <Card role="region" aria-labelledby="prompt-line-title">
      <CardHeader>
        <CardTitle id="prompt-line-title" className="text-heading">Inline Prompt Line</CardTitle>
        <CardDescription>
          The production prompt line under a sample turn. Pick a prompt to open it. Press Escape inside it to cancel.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {SAMPLES.map(({ key, label }) => (
            <Button key={key} variant="outline" size="sm" onClick={() => fire(key)}>{label}</Button>
          ))}
          <ToggleGroup
            type="single"
            aria-label="Layout"
            className="ml-auto"
            value={layout}
            onValueChange={(next) => { if (next) setLayout(next as PromptLineLayout); }}
          >
            <ToggleGroupItem value="pages">Pages</ToggleGroupItem>
            <ToggleGroupItem value="chat">Chat</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="mx-auto w-full max-w-3xl">
          <TurnCard actions={[]} turnNumber={3}>
            <MarkdownRenderer text={NARRATION} dialogue />
          </TurnCard>
          <ScriptTellLines tells={tells} layout={layout} className="mt-3" />
          <ScriptPromptLine store={store} layout={layout} className="mt-4" />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Meta role="status">{status ?? 'No prompt answered yet'}</Meta>
          {tells.length > 0 && <Button variant="outline" size="sm" onClick={() => setTells([])}>Clear Tells</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
