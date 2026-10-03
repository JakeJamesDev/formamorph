import { Fragment, useState } from 'react';
import { Copy, GitCompare, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PresetNameDialog } from '@/components/modals/PresetNameDialog';
import PromptField from '@/components/prompt/PromptField';
import { Button } from '@/components/ui/button';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { helpChipVocabulary } from '@/lib/formaquestion/helpChips';
import {
  activeHelpPreset, DEFAULT_HELP_PRESET_ID, DEFAULT_HELP_PRESET_NAME, deleteHelpPreset, duplicateHelpPreset, editHelpPrompt, isDefaultHelpPresetActive,
  isHelpPromptEdited, renameHelpPreset, resetHelpPrompt, selectHelpPreset, type HelpPresetStore,
} from '@/lib/formaquestion/helpPresets';
import { DEFAULT_HELP_PROMPTS, HELP_PROMPT_CHIPS, type HelpPromptKey } from '@/lib/formaquestion/helpPrompt';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { randomUUID } from '@/lib/uuid';
import { HelpPromptCompareDialog } from './HelpPromptCompareDialog';
import { AnswerOptions } from './AnswerOptions';
import { COMPARE_COPY, PROMPTS_COPY } from './formaquestionSettingsTabs';

const ADD_PRESET = '__add__';

/** The prompts in rail order. */
const PROMPT_KEYS: readonly HelpPromptKey[] = ['answer', 'pick', 'lookup'];

/** One chip family per prompt, made once: the palette of each is fixed. */
const VOCABULARIES: Record<HelpPromptKey, ChipVocabulary> = {
  answer: helpChipVocabulary(HELP_PROMPT_CHIPS.answer),
  pick: helpChipVocabulary(HELP_PROMPT_CHIPS.pick),
  lookup: helpChipVocabulary(HELP_PROMPT_CHIPS.lookup),
};

/** The select value of the Options row, which shares the answer prompt's key. */
const OPTIONS_VALUE = 'options';

type Pending = { kind: 'add' } | { kind: 'rename' } | { kind: 'delete' } | { kind: 'reset'; key: HelpPromptKey } | null;

/**
 * The Prompts tab: the help preset select with duplicate, rename and delete, and the three prompts in a
 * rail. The Default preset shows its prompts read-only with a way to duplicate; a custom prompt resets to
 * the default text.
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
      <div className="flex flex-shrink-0 items-center gap-2" data-testid="help-preset-header-row">
        <span className="text-helper text-muted-foreground">{PROMPTS_COPY.preset.label}</span>
        {!readOnly && (
          <Tip tip="Delete">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Delete Preset" onClick={() => setPending({ kind: 'delete' })}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </Tip>
        )}
        <Select value={active.id} onValueChange={(value) => (value === ADD_PRESET ? setPending({ kind: 'add' }) : setStore(selectHelpPreset(store, value)))}>
          <SelectTrigger aria-label={PROMPTS_COPY.preset.label} className="min-w-0 flex-1">
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
      </div>
      <p className="-mt-2 flex-shrink-0 text-helper text-muted-foreground">{PROMPTS_COPY.preset.hint}</p>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <Select value={showOptions ? OPTIONS_VALUE : key} onValueChange={(value) => open(value === OPTIONS_VALUE ? 'answer' : value as HelpPromptKey, value === OPTIONS_VALUE)}>
          <SelectTrigger aria-label="Prompt" className="md:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROMPT_KEYS.map((id) => (
              <Fragment key={id}>
                <SelectItem value={id}>{PROMPTS_COPY.prompts[id].label}</SelectItem>
                {id === 'answer' && <SelectItem value={OPTIONS_VALUE}>{PROMPTS_COPY.options.title}</SelectItem>}
              </Fragment>
            ))}
          </SelectContent>
        </Select>
        <nav aria-label="Prompts" className="hidden w-[160px] shrink-0 flex-col border-r pr-3 md:flex">
          {PROMPT_KEYS.map((id) => (
            <Fragment key={id}>
              <CompactSelectionRow selected={key === id && !showOptions} showCheck={false} aria-pressed={undefined} aria-current={key === id && !showOptions ? 'true' : undefined} onClick={() => open(id, false)}>
                {PROMPTS_COPY.prompts[id].label}
              </CompactSelectionRow>
              {id === 'answer' && (
                <CompactSelectionRow className="pl-6" selected={showOptions} showCheck={false} aria-pressed={undefined} aria-current={showOptions ? 'true' : undefined} onClick={() => open('answer', true)}>
                  {PROMPTS_COPY.options.title}
                </CompactSelectionRow>
              )}
            </Fragment>
          ))}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showOptions ? (
            <AnswerOptions settings={settings} onChange={onChange} />
          ) : (
            <PromptField
              key={`${active.id}:${key}`}
              label={prompt.label}
              ariaLabel={`${prompt.label} Prompt`}
              hint={prompt.hint}
              value={active.prompts[key]}
              onChange={(text) => setStore(editHelpPrompt(store, active.id, key, text))}
              vocabulary={VOCABULARIES[key]}
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
