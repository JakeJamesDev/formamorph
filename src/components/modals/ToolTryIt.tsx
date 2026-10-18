import { useId, useState } from 'react';
import { ScriptPromptLine } from '@/components/game/ScriptPromptLine';
import { useEditorPromptRun } from '@/lib/useEditorPromptRun';
import { Play } from 'lucide-react';
import type { Tool, ToolParam } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldError, Hint, SectionTitle } from '@/components/ui/typography';
import { ToolText } from '@/components/prompt/ToolText';
import { useMountedRef } from '@/lib/useMountedRef';
import { runToolCall, type ToolCallResult } from '@/lib/tools/toolRunner';
import { toolSchema } from '@/lib/tools/toolSchema';
import type { ToolSnapshot } from '@/lib/tools/toolSnapshot';
import { listOptions, namedParams, tryItArguments } from '@/lib/tools/toolDraft';
import { isRecord } from '@/lib/tools/toolValidation';
import type { WorldToolTry, WorldToolTryOptions } from '@/lib/tools/worldToolTry';
import { toolTimingOf } from '@/lib/tools/worldTools';

/** Where Try It reads the world from, and how it names it. */
export interface TryItWorld {
  snapshot: () => ToolSnapshot;
  /** True for the world the player has open, false for the sample world. */
  open: boolean;
  /** Runs a Script World Tool on the script surface, staging its writes and applying none. Absent, a Script runs
   *  as a user Tool script does. */
  runScript?: (tool: Tool, argsText: string, options: WorldToolTryOptions) => Promise<WorldToolTry>;
}

/** What a run left for the panel to show. The writes, warnings and sentence are a Script World Tool's. */
type TryOutcome = ToolCallResult & Partial<Omit<WorldToolTry, keyof ToolCallResult>>;

/** The message an error result carries. */
function errorMessage(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed) && typeof parsed.error === 'string') return parsed.error;
  } catch {
    // Not JSON: the text is the message.
  }
  return text;
}

function ArgInput({ param, value, onChange }: { param: ToolParam; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const label = `${param.name}${param.required ? '' : ' (optional)'}`;
  const choices = param.type === 'boolean'
    ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]
    : param.type === 'enum' ? listOptions(param).map((o) => ({ value: o, label: o })) : null;
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <Label htmlFor={id} className="font-mono">{label}</Label>
      {choices ? (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger id={id} aria-label={param.name}><SelectValue placeholder="Pick one" /></SelectTrigger>
          <SelectContent>
            {choices.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id} aria-label={param.name} value={value} onChange={(e) => onChange(e.target.value)}
          inputMode={param.type === 'number' ? 'decimal' : undefined}
        />
      )}
    </div>
  );
}

/**
 * Try It: one input per parameter, a run through the real Tool Runner, and what came back. Below it, the
 * schema the AI receives, folded.
 */
export function ToolTryIt({ tool, world }: { tool: Tool; world: TryItWorld }) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  /** The last run's result, and the Tool as it stood for that run. */
  const [result, setResult] = useState<{ outcome: TryOutcome; ranOn: string } | null>(null);
  const [running, setRunning] = useState(false);
  /** The sentence a During AI Output Tool rewrites. Never saved. */
  const [sample, setSample] = useState('');
  const sampleId = useId();
  const prompts = useEditorPromptRun();
  const mounted = useMountedRef();
  const params = namedParams(tool.params);
  const current = JSON.stringify(tool);
  const scripted = tool.handler.kind === 'script' && world.runScript ? world.runScript : null;
  const isOutput = tool.handler.kind === 'script' && toolTimingOf(tool) === 'output';

  const run = async () => {
    setRunning(true);
    const promptRun = scripted ? prompts.open() : null;
    try {
      const argsText = tryItArguments(params, inputs);
      const outcome: TryOutcome = scripted && promptRun
        ? await scripted(tool, argsText, { prompts: promptRun.host, ...(isOutput && { sentence: sample }) })
        : await runToolCall(tool, argsText, world.snapshot());
      // An edit or an unmount mid-run closed this run, and its result is stale.
      if (mounted.current && (!promptRun || prompts.isCurrent(promptRun))) setResult({ outcome, ranOn: current });
    } finally {
      if (promptRun && prompts.isCurrent(promptRun)) prompts.close();
      if (mounted.current) setRunning(false);
    }
  };

  const outcome = result?.outcome;

  return (
    <section aria-label="Try It" className="flex flex-col gap-3 min-w-0">
      <div>
        <SectionTitle as="h4">Try It</SectionTitle>
        <Hint>{world.open ? 'Runs on the world you have open' : 'Runs on a sample world'}</Hint>
      </div>
      {params.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {params.map((p) => (
            <ArgInput key={p.name} param={p} value={inputs[p.name] ?? ''} onChange={(v) => setInputs((prev) => ({ ...prev, [p.name]: v }))} />
          ))}
        </div>
      )}
      {scripted && isOutput && (
        <div className="flex flex-col gap-1 min-w-0">
          <Label htmlFor={sampleId}>Sample Sentence</Label>
          <Input id={sampleId} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Type a sentence for the Tool to rewrite" />
        </div>
      )}
      <div>
        <Button size="sm" onClick={() => void run()} disabled={running}>
          <Play className="h-4 w-4 mr-1" />Run
        </Button>
      </div>
      {outcome && (
        <div className="flex flex-col gap-1 min-w-0" data-testid="try-it-result">
          {outcome.failure && <FieldError role="alert">{errorMessage(outcome.text)}</FieldError>}
          <Hint>{outcome.failure ? 'The AI reads this error' : 'The AI reads this result'}</Hint>
          {result.ranOn !== current && <Hint role="status">From before your last edit. Run again to try the Tool as it is now.</Hint>}
          <ToolText text={outcome.text} />
          {outcome.sentence !== undefined && (
            <>
              <Hint>The sentence after the Tool runs</Hint>
              <ToolText text={outcome.sentence} />
            </>
          )}
          {!!outcome.writes?.length && (
            <>
              <Hint>The writes the script staged. Try It doesn’t apply them.</Hint>
              <ul className="text-label font-mono break-words">
                {outcome.writes.map((write) => <li key={write}>{write}</li>)}
              </ul>
            </>
          )}
          {outcome.warnings?.map((warning) => <div key={warning} className="text-warning text-label">{warning}</div>)}
        </div>
      )}
      {scripted && prompts.store && <ScriptPromptLine store={prompts.store} />}
      <details>
        <summary className="cursor-pointer text-helper text-muted-foreground">What the AI Receives</summary>
        <ToolText text={JSON.stringify(toolSchema(tool))} className="mt-2" />
      </details>
    </section>
  );
}
