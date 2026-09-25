import { useId, useState } from 'react';
import { Play } from 'lucide-react';
import type { Tool, ToolParam } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldError, Hint, SectionTitle } from '@/components/ui/typography';
import { HighlightedCode } from '@/components/prompt/HighlightedCode';
import { useMountedRef } from '@/lib/useMountedRef';
import { runToolCall, type ToolCallResult } from '@/lib/tools/toolRunner';
import { toolSchema } from '@/lib/tools/toolSchema';
import type { ToolSnapshot } from '@/lib/tools/toolSnapshot';
import { tryItArguments } from '@/lib/tools/toolDraft';
import { isRecord } from '@/lib/tools/toolValidation';

/** Where Try It reads the world from, and how it names it. */
export interface TryItWorld {
  snapshot: () => ToolSnapshot;
  /** True for the world the player has open, false for the sample world. */
  open: boolean;
}

const CODE_BOX = 'rounded-md border bg-muted/40 p-2 text-meta';

/** JSON reads indented; anything else reads as the text the AI receives. */
function pretty(text: string): { code: string; json: boolean } {
  try {
    return { code: JSON.stringify(JSON.parse(text), null, 2), json: true };
  } catch {
    return { code: text, json: false };
  }
}

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
    : param.type === 'enum' ? param.options.map((o) => o.trim()).filter(Boolean).map((o) => ({ value: o, label: o })) : null;
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
  const [result, setResult] = useState<ToolCallResult | null>(null);
  const [running, setRunning] = useState(false);
  const mounted = useMountedRef();
  const params = tool.params.filter((p) => p.name.trim());

  const run = async () => {
    setRunning(true);
    try {
      const outcome = await runToolCall(tool, tryItArguments(params, inputs), world.snapshot());
      if (mounted.current) setResult(outcome);
    } finally {
      if (mounted.current) setRunning(false);
    }
  };

  const shown = result && pretty(result.text);

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
      <div>
        <Button size="sm" onClick={() => void run()} disabled={running}>
          <Play className="h-4 w-4 mr-1" />Run
        </Button>
      </div>
      {result && shown && (
        <div className="flex flex-col gap-1 min-w-0" data-testid="try-it-result">
          {result.failure && <FieldError role="alert">{errorMessage(result.text)}</FieldError>}
          <Hint>{result.failure ? 'The AI reads this error' : 'The AI reads this result'}</Hint>
          {shown.json
            ? <HighlightedCode code={shown.code} language="json" className={CODE_BOX} />
            : <pre className={`whitespace-pre-wrap break-words font-mono ${CODE_BOX}`}>{shown.code}</pre>}
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-helper text-muted-foreground">What the AI Receives</summary>
        <HighlightedCode code={JSON.stringify(toolSchema(tool), null, 2)} language="json" className={`mt-2 ${CODE_BOX}`} />
      </details>
    </section>
  );
}
