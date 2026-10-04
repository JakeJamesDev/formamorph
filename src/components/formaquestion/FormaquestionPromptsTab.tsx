import { Fragment, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Copy, GitCompare, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PresetNameDialog } from '@/components/modals/PresetNameDialog';
import PromptField from '@/components/prompt/PromptField';
import { Button } from '@/components/ui/button';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { ActionIcon } from '@/lib/actionIcons';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { downloadBlob } from '@/lib/downloadBlob';
import { helpChipPreview, helpChipValues, helpChipVocabulary } from '@/lib/formaquestion/helpChips';
import { buildHelpPresetFile, helpPresetFileName, importHelpPresetFile, parseHelpPresetFile } from '@/lib/formaquestion/helpPresetFile';
import {
  activeHelpPreset, DEFAULT_HELP_PRESET_ID, DEFAULT_HELP_PRESET_NAME, deleteHelpPreset, duplicateHelpPreset, editHelpOptions, editHelpPrompt, isDefaultHelpPresetActive,
  isHelpPromptEdited, renameHelpPreset, resetHelpPrompt, selectHelpPreset, type HelpPresetStore,
} from '@/lib/formaquestion/helpPresets';
import { DEFAULT_HELP_PROMPTS, HELP_PROMPT_CHIPS, HELP_PROMPT_KEYS, type HelpPromptKey } from '@/lib/formaquestion/helpPrompt';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { filesFrom } from '@/lib/importFiles';
import { toastError } from '@/lib/linkToast';
import { useMountedRef } from '@/lib/useMountedRef';
import { PRESET_SCRIPT_TOOL_WARNING } from '@/lib/tools/toolPack';
import { randomUUID } from '@/lib/uuid';
import { APP_VERSION } from '@/lib/version';
import { HelpPromptCompareDialog } from './HelpPromptCompareDialog';
import { COMPARE_COPY, PROMPTS_COPY } from './formaquestionSettingsTabs';
import { RequestOptions } from './RequestOptions';

const ADD_PRESET = '__add__';

/** One chip family per prompt, made once: the palette of each is fixed. */
const VOCABULARIES: Record<HelpPromptKey, ChipVocabulary> = {
  answer: helpChipVocabulary(HELP_PROMPT_CHIPS.answer),
  pick: helpChipVocabulary(HELP_PROMPT_CHIPS.pick),
  lookup: helpChipVocabulary(HELP_PROMPT_CHIPS.lookup),
};

/** The select value of a prompt's Options row. */
const optionsValue = (key: HelpPromptKey) => `${key}:options`;

/** The prompt a select value names, and whether it is that prompt's Options row. */
const selectionOf = (value: string): { key: HelpPromptKey; options: boolean } | undefined => {
  const key = HELP_PROMPT_KEYS.find((id) => value === id || value === optionsValue(id));
  return key && { key, options: value !== key };
};

type Pending = { kind: 'add' } | { kind: 'rename' } | { kind: 'delete' } | { kind: 'reset'; key: HelpPromptKey } | null;

/**
 * The Prompts tab: the help preset select with duplicate, rename and delete, and the three prompts in a
 * rail, each with Edit | Preview and an Options row. The Default preset shows its prompts read-only with a
 * way to duplicate; a custom prompt resets to the default text. A custom preset exports to a help preset file, and a file imports as a new preset.
 */
export function PromptsTab({ settings, onChange }: { settings: HelpSettings; onChange: (change: HelpSettingsChange) => void }) {
  const store = settings.presets;
  const active = activeHelpPreset(store);
  const readOnly = isDefaultHelpPresetActive(store);
  const [key, setKey] = useState<HelpPromptKey>('answer');
  const [showOptions, setShowOptions] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [comparing, setComparing] = useState(false);
  const open = (next: HelpPromptKey, options: boolean) => { setKey(next); setShowOptions(options); setComparing(false); };
  const setStore = (next: HelpPresetStore) => onChange({ presets: next });
  const duplicate = (name: string) => setStore(duplicateHelpPreset(store, active.id, randomUUID(), name));
  const copyName = `${active.name} (copy)`;
  const prompt = PROMPTS_COPY.prompts[key];
  const edited = isHelpPromptEdited(active.prompts, key);
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useMountedRef();
  // The import reads the settings after the file text arrives, not as they were at the click.
  const latest = useRef(settings);
  latest.current = settings;
  const { mascot, rig } = settings;
  const preview = useMemo(() => helpChipPreview(helpChipValues(key, { mascot, rig })), [key, mascot, rig]);

  const exportPreset = () => {
    const file = buildHelpPresetFile(settings, active.id, APP_VERSION);
    if (file) downloadBlob(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), helpPresetFileName(file.name));
  };

  const importPreset = async (event: ChangeEvent<HTMLInputElement>) => {
    const [chosen] = filesFrom(event);
    if (!chosen) return;
    try {
      const text = await chosen.text();
      if (!mounted.current) return;
      const { change, presetName, skipped, scriptOn } = importHelpPresetFile(latest.current, parseHelpPresetFile(text), randomUUID);
      onChange(change);
      toast.success(`Imported the “${presetName}” preset`);
      if (skipped.length) toast.info(`Already in My Tools: ${skipped.join(', ')}`);
      if (scriptOn) toast.warn(PRESET_SCRIPT_TOOL_WARNING);
    } catch (error) {
      toastError(error, 'Couldn’t import that preset');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2" data-testid="help-preset-header-row">
        <span className="text-helper text-muted-foreground">{PROMPTS_COPY.preset.label}</span>
        {!readOnly && (
          <Tip tip="Delete">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Delete Preset" onClick={() => setPending({ kind: 'delete' })}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </Tip>
        )}
        <Select value={active.id} onValueChange={(value) => (value === ADD_PRESET ? setPending({ kind: 'add' }) : setStore(selectHelpPreset(store, value)))}>
          <SelectTrigger aria-label={PROMPTS_COPY.preset.label} className="min-w-40 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_HELP_PRESET_ID}>{DEFAULT_HELP_PRESET_NAME}</SelectItem>
            {store.presets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}
            <SelectSeparator />
            <SelectItem value={ADD_PRESET}>Add New Preset…</SelectItem>
          </SelectContent>
        </Select>
        <Tip tip="Duplicate">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Duplicate Preset" onClick={() => duplicate(copyName)}>
            <Copy className="h-4 w-4" aria-hidden />
          </Button>
        </Tip>
        {!readOnly && (
          <Tip tip="Rename">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Rename Preset" onClick={() => setPending({ kind: 'rename' })}>
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
          </Tip>
        )}
        <Tip tip="Import">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Import Preset" onClick={() => fileRef.current?.click()}>
            <ActionIcon.import className="h-4 w-4" aria-hidden />
          </Button>
        </Tip>
        {!readOnly && (
          <Tip tip="Export">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Export Preset" onClick={exportPreset}>
              <ActionIcon.export className="h-4 w-4" aria-hidden />
            </Button>
          </Tip>
        )}
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" data-testid="help-preset-input" onChange={(event) => void importPreset(event)} />
      </div>
      <p className="-mt-2 flex-shrink-0 text-helper text-muted-foreground">{PROMPTS_COPY.preset.hint}</p>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <Select value={showOptions ? optionsValue(key) : key} onValueChange={(value) => { const next = selectionOf(value); if (next) open(next.key, next.options); }}>
          <SelectTrigger aria-label="Prompt" className="md:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HELP_PROMPT_KEYS.map((id) => (
              <Fragment key={id}>
                <SelectItem value={id}>{PROMPTS_COPY.prompts[id].label}</SelectItem>
                <SelectItem value={optionsValue(id)}>{`${PROMPTS_COPY.prompts[id].label} ${PROMPTS_COPY.options.title}`}</SelectItem>
              </Fragment>
            ))}
          </SelectContent>
        </Select>
        <nav aria-label="Prompts" className="hidden w-[160px] shrink-0 flex-col border-r pr-3 md:flex">
          {HELP_PROMPT_KEYS.map((id) => (
            <Fragment key={id}>
              <CompactSelectionRow selected={key === id && !showOptions} showCheck={false} aria-pressed={undefined} aria-current={key === id && !showOptions ? 'true' : undefined} onClick={() => open(id, false)}>
                {PROMPTS_COPY.prompts[id].label}
              </CompactSelectionRow>
              <CompactSelectionRow
                className="pl-6" selected={key === id && showOptions} showCheck={false} aria-pressed={undefined}
                aria-label={`${PROMPTS_COPY.prompts[id].label} ${PROMPTS_COPY.options.title}`}
                aria-current={key === id && showOptions ? 'true' : undefined} onClick={() => open(id, true)}
              >
                {PROMPTS_COPY.options.title}
              </CompactSelectionRow>
            </Fragment>
          ))}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showOptions ? (
            <RequestOptions
              key={`${active.id}:${key}`}
              prompt={key}
              options={active.options[key]}
              readOnly={readOnly}
              readOnlyReason={readOnly ? PROMPTS_COPY.readOnly(active.name) : undefined}
              onRequestEdit={() => duplicate(copyName)}
              onChange={(change) => setStore(editHelpOptions(store, active.id, key, change))}
            />
          ) : (
            <PromptField
              key={`${active.id}:${key}`}
              label={prompt.label}
              ariaLabel={`${prompt.label} Prompt`}
              hint={prompt.hint}
              value={active.prompts[key]}
              onChange={(text) => setStore(editHelpPrompt(store, active.id, key, text))}
              vocabulary={VOCABULARIES[key]}
              previewValues={preview}
              readOnly={readOnly}
              readOnlyReason={readOnly ? PROMPTS_COPY.readOnly(active.name) : undefined}
              onRequestEdit={() => duplicate(copyName)}
              labelAside={!readOnly && (
                <div className="flex items-center gap-2">
                  <Tip tip={edited ? COMPARE_COPY.action.hint : COMPARE_COPY.action.same} labelsChild={false}>
                    <Button variant="outline" size="sm" className="h-7 px-2" disabled={!edited} onClick={() => setComparing(true)}>
                      <GitCompare className="mr-1 h-3.5 w-3.5" aria-hidden /> {COMPARE_COPY.action.label}
                    </Button>
                  </Tip>
                  <Tip tip={PROMPTS_COPY.reset.hint} labelsChild={false}>
                    <Button
                      variant="outline" size="sm" className="h-7 px-2"
                      disabled={!edited}
                      onClick={() => setPending({ kind: 'reset', key })}
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden /> {PROMPTS_COPY.reset.label}
                    </Button>
                  </Tip>
                </div>
              )}
              className="min-h-0 flex-1"
            />
          )}
        </div>
      </div>

      <HelpPromptCompareDialog
        open={comparing && !readOnly}
        onOpenChange={setComparing}
        label={prompt.label}
        defaultText={DEFAULT_HELP_PROMPTS[key]}
        text={active.prompts[key]}
      />
      <PresetNameDialog
        open={pending?.kind === 'add' || pending?.kind === 'rename'}
        mode={pending?.kind === 'rename' ? 'rename' : 'add'}
        initialName={pending?.kind === 'rename' ? active.name : copyName}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        onSubmit={(name) => (pending?.kind === 'rename' ? setStore(renameHelpPreset(store, active.id, name)) : duplicate(name))}
      />
      <ConfirmDialog
        open={pending?.kind === 'delete'}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Delete Preset"
        description={`Delete the "${active.name}" preset? This can't be undone.`}
        onConfirm={() => setStore(deleteHelpPreset(store, active.id))}
      />
      <ConfirmDialog
        open={pending?.kind === 'reset'}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title="Reset Prompt"
        description={`Reset the ${prompt.label} prompt of "${active.name}" to its default text? This can't be undone.`}
        onConfirm={() => setStore(resetHelpPrompt(store, active.id, key))}
      />
    </div>
  );
}
