import { useState, type ReactNode } from 'react';
import { PresetHeader } from '@/components/presetHeader/PresetHeader';
import { EndpointReachabilityView } from '@/components/modals/EndpointReachabilityBadge';
import { PromptResetCompare } from '@/components/prompt/PromptResetCompare';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Meta } from '@/components/ui/typography';
import { plainVocabulary } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import type { EndpointProbe } from '@/lib/useAiReachable';
import { presetHeaderActions, type PresetHeaderHandlers } from '@/lib/presetHeaderActions';

const VOCABULARY = plainVocabulary();
const ADD_ROW = '__add__';
const DEFAULT_TEXT = 'Narrate the scene in second person. Keep each reply to three short paragraphs.';
const EDITED_TEXT = 'Narrate the scene in second person. Keep each reply to two short paragraphs, and end on a choice.';

/** A select that shows its preset and the "Add New Preset…" row, as the production headers do. */
function PresetSelect({ value, names }: { value: string; names: string[] }) {
  return (
    <Select value={value} onValueChange={() => {}}>
      <SelectTrigger aria-label="Preset" className="min-w-0 flex-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {names.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
        <SelectSeparator />
        <SelectItem value={ADD_ROW}>Add New Preset…</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** A bordered sample named `label`. A single column track lets a scroll box inside shrink below its content. */
function SampleCard({ label, title = label, className, children }: {
  label: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className={cn('grid min-w-0 grid-cols-1 content-start gap-2 rounded-md border border-border p-3', className)}>
      <h4 className="text-label font-semibold">{title}</h4>
      {children}
    </section>
  );
}

/** One header sample at one width. The narrow box is as wide as a phone. */
function Sample({ title, width, children }: { title: string; width: 'wide' | 'narrow'; children: ReactNode }) {
  return (
    <SampleCard label={title}>
      <div className={width === 'narrow' ? 'w-[22rem] max-w-full' : 'overflow-x-auto'}>
        <div className={width === 'narrow' ? undefined : 'min-w-[34rem]'}>{children}</div>
      </div>
    </SampleCard>
  );
}

/** A reachability state under a select, the way an endpoint header draws it. */
function BadgeSample({ title, status, checking = false, model = 'gemma-3-12b' }: {
  title: string;
  status: EndpointProbe | null;
  checking?: boolean;
  model?: string;
}) {
  return (
    <SampleCard label={title}>
      <PresetSelect value="Local Llama" names={['Local Llama']} />
      <EndpointReachabilityView status={status} checking={checking} model={model} onRecheck={() => {}} />
    </SampleCard>
  );
}

/** The preset header in both widths and every state, and the Reset and Compare pair in both placements. */
export function PresetHeaderReference() {
  const [status, setStatus] = useState('No action ran.');
  const [single, setSingle] = useState(EDITED_TEXT);
  const [first, setFirst] = useState(EDITED_TEXT);
  const [second, setSecond] = useState(DEFAULT_TEXT);

  const ran = (action: string) => () => setStatus(`Ran ${action} on the local sample.`);
  const confirmed = (action: string, description: string) => ({ run: ran(action), description });
  const prompt: PresetHeaderHandlers = {
    duplicate: ran('Duplicate'),
    rename: ran('Rename'),
    import: ran('Import'),
    export: ran('Export'),
    publish: ran('Publish'),
    reset: confirmed('Reset', 'Reset every prompt in the "Mine" preset to its default value? This can\'t be undone.'),
    delete: confirmed('Delete', 'Delete the "Mine" preset? This can\'t be undone.'),
  };
  const endpoint: PresetHeaderHandlers = {
    duplicate: ran('Duplicate'),
    rename: ran('Rename'),
    reset: confirmed('Reset', 'Reset the "Local Llama" preset to its default values? This can\'t be undone.'),
    delete: confirmed('Delete', 'Delete the "Local Llama" preset? This can\'t be undone.'),
  };
  const builtIn = { duplicate: prompt.duplicate, import: prompt.import, export: prompt.export };

  return (
    <Card role="region" aria-labelledby="preset-header-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="preset-header-reference-title" className="text-heading">Preset Header Reference</CardTitle>
        <CardDescription>Select an action to see its local result. Each confirm names what it changes.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 grid-cols-1 gap-6">
        <Meta role="status" aria-live="polite">{status}</Meta>

        <div className="grid min-w-0 grid-cols-1 gap-3">
          <h3 className="text-label font-semibold">Prompt Preset</h3>
          <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Sample title="Editable, Wide" width="wide">
              <PresetHeader label="Preset" layout="wide" actions={presetHeaderActions(false, prompt)}
                select={<PresetSelect value="Mine" names={['Default', 'Mine']} />} />
            </Sample>
            <Sample title="Editable, Narrow" width="narrow">
              <PresetHeader label="Preset" layout="narrow" actions={presetHeaderActions(false, prompt)}
                select={<PresetSelect value="Mine" names={['Default', 'Mine']} />} />
            </Sample>
            <Sample title="Built-In, Wide" width="wide">
              <PresetHeader label="Preset" layout="wide" actions={presetHeaderActions(true, builtIn)}
                select={<PresetSelect value="Default" names={['Default', 'Mine']} />} />
            </Sample>
            <Sample title="Built-In, Narrow" width="narrow">
              <PresetHeader label="Preset" layout="narrow" actions={presetHeaderActions(true, builtIn)}
                select={<PresetSelect value="Default" names={['Default', 'Mine']} />} />
            </Sample>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3">
          <h3 className="text-label font-semibold">Endpoint Preset</h3>
          <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Sample title="Endpoint, Wide" width="wide">
              <div className="grid gap-2">
                <PresetHeader label="Preset" layout="wide" actions={presetHeaderActions(false, endpoint)}
                  select={<PresetSelect value="Local Llama" names={['Local Llama']} />} />
                <EndpointReachabilityView status="ok" checking={false} model="gemma-3-12b" onRecheck={() => {}} />
              </div>
            </Sample>
            <Sample title="Endpoint, Narrow" width="narrow">
              <div className="grid gap-2">
                <PresetHeader label="Preset" layout="narrow" actions={presetHeaderActions(false, endpoint)}
                  select={<PresetSelect value="Local Llama" names={['Local Llama']} />} />
                <EndpointReachabilityView status="ok" checking={false} model="gemma-3-12b" onRecheck={() => {}} />
              </div>
            </Sample>
            <Sample title="Image, One Preset" width="wide">
              <PresetHeader label="Preset" layout="wide" actions={presetHeaderActions(false, { ...endpoint, delete: undefined })}
                select={<PresetSelect value="Local Llama" names={['Local Llama']} />} />
            </Sample>
            <Sample title="Heading Form" width="wide">
              <PresetHeader heading="Edit Local Llama" layout="wide" actions={presetHeaderActions(false, endpoint)} />
            </Sample>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3">
          <h3 className="text-label font-semibold">Reachability</h3>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <BadgeSample title="Checking" status={null} checking />
            <BadgeSample title="Reachable" status="ok" />
            <BadgeSample title="Missing Model" status="unknownModel" />
            <BadgeSample title="No Model Name" status="unknownModel" model="" />
            <BadgeSample title="Unreachable" status="unreachable" />
            <BadgeSample title="Not Checked" status={null} />
            <SampleCard label="Built-In Engine">
              <PresetSelect value="Local Llama" names={['Local Llama']} />
              <Meta>The preset has no URL, so no badge shows.</Meta>
            </SampleCard>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3">
          <h3 className="text-label font-semibold">Reset and Compare</h3>
          <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
            <SampleCard label="Single Prompt" title="Single Prompt, Modal Footer">
              <Textarea aria-label="Narration Prompt" rows={3} value={single} onChange={(event) => setSingle(event.target.value)} />
              <PromptResetCompare
                name="Narration Prompt" value={single} defaultValue={DEFAULT_TEXT} onReset={() => setSingle(DEFAULT_TEXT)}
                vocabulary={VOCABULARY} surface="settingsCompare"
              />
            </SampleCard>
            <SampleCard label="Stacked Prompts" title="Stacked Prompts, Label Rows" className="gap-3">
              {([
                ['Opening Message', first, setFirst],
                ['Closing Message', second, setSecond],
              ] as const).map(([label, value, set]) => (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="text-label font-medium">{label}</span>
                    <PromptResetCompare
                      className="ml-auto" size="sm" name={label} value={value} defaultValue={DEFAULT_TEXT}
                      onReset={() => set(DEFAULT_TEXT)} vocabulary={VOCABULARY} surface="settingsCompare"
                    />
                  </div>
                  <Textarea aria-label={label} rows={2} value={value} onChange={(event) => set(event.target.value)} />
                </div>
              ))}
            </SampleCard>
            <SampleCard label="Built-In Prompt" title="Built-In Preset, No Pair">
              <Textarea aria-label="Built-In Narration Prompt" rows={3} value={DEFAULT_TEXT} readOnly />
              <Meta>A built-in preset hides the pair, so its text stays the default of this release.</Meta>
            </SampleCard>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
// scroll-guard: allow horizontal: wide preset header scrolls sideways
