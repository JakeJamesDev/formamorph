import { useId, useMemo, type ReactNode } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import type { Tool, ToolHandler, ToolParam, ToolParamType } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PanelTabsList } from '@/components/ui/panel-tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { FieldError, Hint } from '@/components/ui/typography';
import { Section } from '@/components/SettingsRows';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { CodeArea } from '@/components/prompt/CodeArea';
import { HighlightedCode } from '@/components/prompt/HighlightedCode';
import PromptField from '@/components/prompt/PromptField';
import { plainVocabulary } from '@/lib/chipVocabulary';
import { cn } from '@/lib/utils';
import {
  draftProblems, finishDraft, hasDraftProblems, namedParams, renameParam, withHandlerKind,
  type DraftProblems, type KeptHandlers, type HandlerProblem, type ParamProblem,
} from '@/lib/tools/toolDraft';
import { toolScriptSurface } from '@/lib/tools/toolScriptSurface';
import { toolTemplateVocabulary } from '@/lib/tools/toolTemplateVocabulary';
import type { ToolNameProblem } from '@/lib/tools/toolValidation';
import { TOOL_EDIT_TABS, type ToolEditTab } from './toolsView';
import { ToolTryIt, type TryItWorld } from './ToolTryIt';

type Change = (next: Tool) => void;

const NAME_PROBLEM: Record<ToolNameProblem, string> = {
  format: 'Use only letters, digits, _ and -, from 1 to 64 characters',
  taken: 'Another of your Tools uses this name',
  builtin: 'A built-in Tool uses this name',
};

/** Shown under a parameter's name. An unnamed one is left to the footer, so a new card isn't born red. */
const PARAM_PROBLEM: Record<ParamProblem, string | null> = {
  unnamed: null,
  repeated: 'Another parameter uses this name',
  noOptions: 'Add at least one option',
};

const HANDLER_PROBLEM: Record<HandlerProblem, string> = { lookupParam: 'Pick the parameter to search by' };

/** The footer's fix for each parameter problem, by the parameter's 1-based position. */
const PARAM_FIX: Record<ParamProblem, (position: number) => string> = {
  unnamed: (n) => `Name parameter ${n}`,
  repeated: (n) => `Rename parameter ${n}`,
  noOptions: (n) => `Add options to parameter ${n}`,
};

const OUTLINE = ['Purpose:', 'Use when:', 'Input:', 'Output:'];
const DESCRIPTION_VOCABULARY = plainVocabulary();

const PARAM_TYPES: readonly { value: ToolParamType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'True/False' },
  { value: 'enum', label: 'One of a List' },
];

const HANDLER_KINDS: readonly { value: ToolHandler['kind']; label: string; help: string }[] = [
  { value: 'lookup', label: 'Lookup', help: 'Searches world data for the value the AI passes' },
  { value: 'template', label: 'Template', help: 'Returns your text with the AI’s values filled in' },
  { value: 'script', label: 'Script', help: 'Runs your code on the AI’s values and returns the result' },
];

type LookupSource = Extract<ToolHandler, { kind: 'lookup' }>['source'];

const LOOKUP_SOURCES: readonly { value: LookupSource; label: string; matches: string }[] = [
  { value: 'entities', label: 'Entities', matches: 'Matches entity names and aliases, in any case' },
  { value: 'locations', label: 'Locations', matches: 'Matches location names, in any case' },
  { value: 'dictionary', label: 'Dictionary Entries', matches: 'Matches dictionary names and trigger keywords, in any case' },
];

/** Label, help, control, then the control's problem: the Design System's field help order. */
function Field({ id, label, hint, error, aside, children }: {
  id: string; label: string; hint?: string; error?: string | null; aside?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {hint && <Hint>{hint}</Hint>}
      {children}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

/** A JSON text field colored as it is typed: a transparent textarea over the highlighted text. */
function JsonField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const text = 'px-3 py-2 font-mono text-label whitespace-pre-wrap break-words';
  return (
    <div className="relative rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
      <div aria-hidden>
        {/* The trailing newline keeps a last empty line as tall as the textarea's. */}
        <HighlightedCode code={`${value}\n`} language="json" className={`${text} overflow-hidden`} />
      </div>
      <textarea
        id={id} value={value} spellCheck={false} onChange={(e) => onChange(e.target.value)}
        className={`${text} absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-foreground outline-none`}
      />
    </div>
  );
}

/** A tab body. */
interface TabProps { draft: Tool; onChange: Change; problems: DraftProblems }

function DefinitionTab({ draft, onChange, problems }: TabProps) {
  const id = useId();
  const missing = OUTLINE.filter((heading) => !draft.description.includes(heading));
  const addOutline = () => {
    const kept = draft.description.trimEnd();
    onChange({ ...draft, description: `${kept}${kept ? '\n' : ''}${missing.map((h) => `${h} `).join('\n')}` });
  };
  const nameError = draft.name && problems.name ? NAME_PROBLEM[problems.name] : null;
  return (
    <div className="flex flex-col gap-4">
      <Field id={`${id}-name`} label="Name" hint="Names the Tool for the AI, such as find_person" error={nameError}>
        <Input
          id={`${id}-name`} value={draft.name} className="font-mono"
          aria-invalid={!!nameError} aria-describedby={nameError ? `${id}-name-error` : undefined}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </Field>
      <PromptField
        label="Description" ariaLabel="Description" vocabulary={DESCRIPTION_VOCABULARY}
        hint="Tells the AI what the Tool does and when to call it"
        placeholder={OUTLINE.join('\n')}
        labelAside={(
          <Button size="sm" variant="outline" disabled={missing.length === 0} onClick={addOutline}>Add Outline</Button>
        )}
        value={draft.description} onChange={(description) => onChange({ ...draft, description })}
      />
    </div>
  );
}

function ParamCard({ draft, index, problem, onChange }: {
  draft: Tool; index: number; problem: ParamProblem | null; onChange: Change;
}) {
  const id = useId();
  const param = draft.params[index];
  const set = (patch: Partial<ToolParam>) =>
    onChange({ ...draft, params: draft.params.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  const shownProblem = problem && PARAM_PROBLEM[problem];
  return (
    <div role="group" aria-label={`Parameter ${index + 1}`} className="flex flex-col gap-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)]">
        <Field id={`${id}-name`} label="Name" error={shownProblem}>
          <Input
            id={`${id}-name`} value={param.name} className="font-mono"
            aria-invalid={!!shownProblem} aria-describedby={shownProblem ? `${id}-name-error` : undefined}
            onChange={(e) => onChange(renameParam(draft, index, e.target.value))}
          />
        </Field>
        <Field id={`${id}-type`} label="Type">
          <Select value={param.type} onValueChange={(v) => set({ type: v as ToolParamType })}>
            <SelectTrigger id={`${id}-type`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {PARAM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field id={`${id}-description`} label="Description" hint="Tells the AI what to pass">
        <Input id={`${id}-description`} value={param.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      {param.type === 'enum' && (
        <Field id={`${id}-options`} label="Options" hint="Separate the options with commas">
          <Input id={`${id}-options`} value={param.options.join(',')} onChange={(e) => set({ options: e.target.value.split(',') })} />
        </Field>
      )}
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-label">
          <Checkbox checked={param.required} onCheckedChange={(c) => set({ required: c === true })} />
          Required
        </label>
        <Button
          size="sm" variant="ghost"
          onClick={() => onChange({ ...draft, params: draft.params.filter((_, i) => i !== index) })}
        >
          <Trash2 className="h-4 w-4 mr-1" />Remove Parameter
        </Button>
      </div>
    </div>
  );
}

function ParametersTab({ draft, onChange, problems }: TabProps) {
  const add = () => onChange({
    ...draft, params: [...draft.params, { name: '', type: 'string', description: '', required: true, options: [] }],
  });
  return (
    <div className="flex flex-col gap-3">
      {draft.params.length === 0 && <Hint>No parameters. The AI calls this Tool with no arguments.</Hint>}
      {draft.params.map((_, i) => (
        // Parameters have no id of their own, and a rename must not remount the field being typed in.
        <ParamCard key={i} draft={draft} index={i} problem={problems.params[i]} onChange={onChange} />
      ))}
      <div>
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-4 w-4 mr-1" />Add Parameter</Button>
      </div>
    </div>
  );
}

/** An ⓘ beside the Script label that opens the table of values a script can read. */
function ScriptReference({ globals }: { globals: readonly { name: string; detail: string; info: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button" aria-label="What a Script Can Read"
          className="shrink-0 text-muted-foreground hover:text-foreground focus-visible:text-foreground outline-none"
        >
          <Info className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-[640px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>What a Script Can Read</DialogTitle>
          <DialogDescription>Reads these read-only values. Returns text, or any other value as JSON.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
          <dl aria-label="What the script can read" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 pr-1 text-label">
            {globals.map((entry) => (
              <div key={entry.name} className="contents">
                <dt className="font-mono">{entry.name}</dt>
                <dd className="min-w-0 text-muted-foreground">
                  <span className="font-mono break-words text-foreground/80">{entry.detail}</span> {entry.info}
                </dd>
              </div>
            ))}
          </dl>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function HandlerTab({ draft, onChange, onKindChange, problems, placeholderNames }: TabProps & {
  onKindChange: (kind: ToolHandler['kind']) => void; placeholderNames: readonly string[];
}) {
  const id = useId();
  const { handler, params } = draft;
  const named = namedParams(params);
  const source = LOOKUP_SOURCES.find((s) => handler.kind === 'lookup' && s.value === handler.source);
  const handlerError = problems.handler && HANDLER_PROBLEM[problems.handler];
  const surface = useMemo(() => toolScriptSurface(params, placeholderNames), [params, placeholderNames]);
  const vocabulary = useMemo(() => toolTemplateVocabulary(params), [params]);
  const setHandler = (next: ToolHandler) => onChange({ ...draft, handler: next });
  const kind = HANDLER_KINDS.find((k) => k.value === handler.kind) ?? HANDLER_KINDS[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-kind`}>Handler Type</Label>
        <Hint id={`${id}-kind-help`}>{kind.help}</Hint>
        {/* Half width, level with the lookup's Search column. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={handler.kind} onValueChange={(v) => onKindChange(v as ToolHandler['kind'])}>
            <SelectTrigger id={`${id}-kind`} aria-describedby={`${id}-kind-help`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {HANDLER_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Field id={`${id}-empty`} label="Empty Result" hint="Goes to the AI when the handler finds nothing">
        <JsonField id={`${id}-empty`} value={draft.emptyResult} onChange={(emptyResult) => onChange({ ...draft, emptyResult })} />
      </Field>
      {/* Last, under a rule, since the type above swaps all of it. */}
      <Section title={`${kind.label} Settings`}>
      {handler.kind === 'lookup' && (
        <div className="flex flex-col gap-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={`${id}-source`} label="Search">
              <Select value={handler.source} onValueChange={(v) => setHandler({ ...handler, source: v as LookupSource })}>
                <SelectTrigger id={`${id}-source`} aria-describedby={`${id}-matches`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOOKUP_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id={`${id}-param`} label="By Parameter" error={handlerError}>
              <Select
                value={named.some((p) => p.name === handler.param) ? handler.param : undefined}
                onValueChange={(v) => setHandler({ ...handler, param: v })}
              >
                <SelectTrigger
                  id={`${id}-param`} aria-invalid={!!handlerError}
                  aria-describedby={handlerError ? `${id}-param-error` : undefined}
                >
                  <SelectValue placeholder="Pick a parameter" />
                </SelectTrigger>
                <SelectContent>
                  {named.length === 0 && <div className="px-2 py-1.5 text-meta text-muted-foreground">Add a parameter first</div>}
                  {named.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {handler.source !== 'dictionary' && handler.source !== 'memories' && (
              <Field id={`${id}-returns`} label="Returns">
                <Select value={handler.returns} onValueChange={(v) => setHandler({ ...handler, returns: v as typeof handler.returns })}>
                  <SelectTrigger id={`${id}-returns`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Description</SelectItem>
                    <SelectItem value="summary">Summary</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          {/* Under the whole row, so Search and By Parameter stay level. */}
          <Hint id={`${id}-matches`}>{source?.matches}</Hint>
        </div>
      )}
      {handler.kind === 'template' && (
        <PromptField
          label="Template" ariaLabel="Template" vocabulary={vocabulary}
          hint="Returns this text. Insert a parameter to place what the AI passed."
          value={handler.body} onChange={(body) => setHandler({ ...handler, body })}
        />
      )}
      {handler.kind === 'script' && (
        <CodeArea
          label="Script" ariaLabel="Script" rows={10} surface={surface}
          info={<ScriptReference globals={surface.globals} />}
          value={handler.code} onChange={(code) => setHandler({ ...handler, code })}
        />
      )}
      </Section>
    </div>
  );
}

const LIST = new Intl.ListFormat('en', { type: 'conjunction' });

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const TAB_LABEL = Object.fromEntries(TOOL_EDIT_TABS.map((t) => [t.value, t.label])) as Record<ToolEditTab, string>;

/** A fix with the tab that holds it, since the tab strip carries no problem marks. */
const fixOn = (tab: ToolEditTab, phrase: string) => `${phrase} (${TAB_LABEL[tab]})`;

/** The footer's sentence: one fix per problem, in tab order, or null when nothing blocks Save. */
function fixesToSave(draft: Tool, problems: DraftProblems): string | null {
  const fixes = [
    ...(problems.name ? [fixOn('definition', draft.name ? 'Rename the Tool' : 'Name the Tool')] : []),
    ...problems.params.flatMap((p, i) => (p ? [fixOn('parameters', PARAM_FIX[p](i + 1))] : [])),
    ...(problems.handler ? [fixOn('handler', HANDLER_PROBLEM[problems.handler])] : []),
  ];
  if (fixes.length === 0) return null;
  const [first, ...rest] = fixes;
  return `${LIST.format([first, ...rest.map(lowerFirst)])} to save`;
}

/**
 * Edit mode for a user Tool: Definition, Parameters and Handler on the World Editor's panel tab strip, Try It
 * beside them, and Cancel and Save Tool below. The draft and the tab live with the caller.
 */
export function ToolEditor({
  draft, onDraftChange, keptHandlers, editTab, onEditTabChange, userTools, reservedNames = [], editing, world, fullscreen, fullscreenButton,
  onCancel, onSave,
}: {
  draft: Tool;
  /** Takes the new kept handlers too when a handler type switch changed them. */
  onDraftChange: (next: Tool, kept?: KeptHandlers) => void;
  keptHandlers: KeptHandlers;
  editTab: ToolEditTab;
  onEditTabChange: (tab: ToolEditTab) => void;
  /** The user Tools, for the name check. */
  userTools: readonly Tool[];
  /** The caller's fixed function names, which the name check refuses as built-in. */
  reservedNames?: readonly string[];
  /** True when the draft edits a saved Tool, false for a new one. */
  editing: boolean;
  world: TryItWorld;
  /** Widens Try It to a third of the grid. */
  fullscreen: boolean;
  fullscreenButton: ReactNode;
  onCancel: () => void;
  onSave: () => void;
}) {
  const problems = draftProblems(draft, userTools, reservedNames);
  const blocked = hasDraftProblems(problems);
  const fixes = fixesToSave(draft, problems);
  const body = { draft, onChange: (next: Tool) => onDraftChange(next), problems };
  const switchKind = (kind: ToolHandler['kind']) => {
    const next = withHandlerKind(draft, kind, keptHandlers);
    onDraftChange(next.draft, next.kept);
  };
  // Autocomplete lists the shared placeholders of the world Try It runs on.
  const { snapshot } = world;
  const placeholderNames = useMemo(() => Object.keys(snapshot().placeholders), [snapshot]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <p className="text-label font-medium truncate">{editing ? `Edit ${draft.name}` : 'New Tool'}</p>
        {fullscreenButton}
      </div>
      <div
        data-testid="tool-editor-grid"
        className={cn(
          'grid flex-1 min-h-0 gap-4 grid-rows-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-1',
          fullscreen ? 'lg:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]',
        )}
      >
        <Tabs
          surfaceTabs="settingsToolEdit"
          value={editTab} onValueChange={(t) => onEditTabChange(t as ToolEditTab)}
          className="flex flex-col min-h-0 gap-3"
        >
          <PanelTabsList tabs={TOOL_EDIT_TABS} stripLabel="Tool Fields" labelClassName="hidden sm:inline" />
          <ScrollArea className="flex-1 min-h-0">
            <div className="pr-3 pb-1">
              <TabsContent value="definition" className="mt-0"><DefinitionTab {...body} /></TabsContent>
              <TabsContent value="parameters" className="mt-0"><ParametersTab {...body} /></TabsContent>
              <TabsContent value="handler" className="mt-0"><HandlerTab {...body} onKindChange={switchKind} placeholderNames={placeholderNames} /></TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
        <ScrollArea className="h-full min-h-0 rounded-md border">
          <div className="p-3">
            {/* The draft as it would save, so a list option typed with spaces matches as it will in play. */}
            <ToolTryIt tool={finishDraft(draft)} world={world} />
          </div>
        </ScrollArea>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3 flex-shrink-0">
        {fixes && <p role="status" className="mr-auto text-helper text-muted-foreground">{fixes}</p>}
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={blocked} onClick={onSave}>Save Tool</Button>
      </div>
    </div>
  );
}
