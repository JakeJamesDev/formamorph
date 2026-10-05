import { Fragment, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'react-toastify';
import { PresetNameDialog } from '@/components/modals/PresetNameDialog';
import { PanelShell } from '@/components/PanelShell';
import { PresetHeader } from '@/components/presetHeader/PresetHeader';
import PromptField from '@/components/prompt/PromptField';
import { PromptResetCompare } from '@/components/prompt/PromptResetCompare';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { downloadBlob } from '@/lib/downloadBlob';
import { helpChipPreview, helpChipValues, helpChipVocabulary } from '@/lib/formaquestion/helpChips';
import { buildHelpPresetFile, helpPresetFileName, importHelpPresetFile, parseHelpPresetFile } from '@/lib/formaquestion/helpPresetFile';
import {
  activeHelpPreset, DEFAULT_HELP_PRESET_ID, DEFAULT_HELP_PRESET_NAME, deleteHelpPreset, duplicateHelpPreset, editHelpOptions, editHelpPrompt, isDefaultHelpPresetActive,
  renameHelpPreset, resetHelpPreset, resetHelpPrompt, selectHelpPreset, type HelpPresetStore,
} from '@/lib/formaquestion/helpPresets';
import { DEFAULT_HELP_PROMPTS, HELP_PROMPT_CHIPS, HELP_PROMPT_KEYS, isHelpRequestKey, type HelpPromptKey } from '@/lib/formaquestion/helpPrompt';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { filesFrom } from '@/lib/importFiles';
import { toastError } from '@/lib/linkToast';
import { presetHeaderActions } from '@/lib/presetHeaderActions';
import { useMorphFullscreen } from '@/lib/useMorphFullscreen';
import { useMountedRef } from '@/lib/useMountedRef';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { PRESET_SCRIPT_TOOL_WARNING } from '@/lib/tools/toolPack';
import { randomUUID } from '@/lib/uuid';
import { APP_VERSION } from '@/lib/version';
import { PROMPTS_COPY } from './formaquestionSettingsTabs';
import { RequestOptions } from './RequestOptions';

const ADD_PRESET = '__add__';

/** One chip family per prompt, made once: the palette of each is fixed. */
const VOCABULARIES: Record<HelpPromptKey, ChipVocabulary> = {
  answer: helpChipVocabulary(HELP_PROMPT_CHIPS.answer),
  pick: helpChipVocabulary(HELP_PROMPT_CHIPS.pick),
  lookup: helpChipVocabulary(HELP_PROMPT_CHIPS.lookup),
  code: helpChipVocabulary(HELP_PROMPT_CHIPS.code),
};

/** The select value of a prompt's Options row. */
const optionsValue = (key: HelpPromptKey) => `${key}:options`;

/** The prompt a select value names, and whether it is that prompt's Options row. */
const selectionOf = (value: string): { key: HelpPromptKey; options: boolean } | undefined => {
  const key = HELP_PROMPT_KEYS.find((id) => value === id || (isHelpRequestKey(id) && value === optionsValue(id)));
  return key && { key, options: value !== key };
};

type Pending = { kind: 'add' } | { kind: 'rename' } | null;

/**
 * The Prompts tab: the shared preset header, and the prompts in a rail, each with Edit | Preview. Each prompt
 * that runs a request has an Options row; the Code rider goes out with the answer request. The Default preset shows its prompts read-only with a way to duplicate. A custom prompt
 * resets and compares to the default text from the footer, and the header resets the whole preset. A preset
 * exports to a help preset file, and a file imports as a new preset. Full screen lifts the whole tab.
 */
export function PromptsTab({ settings, onChange }: { settings: HelpSettings; onChange: (change: HelpSettingsChange) => void }) {
  const store = settings.presets;
  const active = activeHelpPreset(store);
  const readOnly = isDefaultHelpPresetActive(store);
  const [key, setKey] = useState<HelpPromptKey>('answer');
  const [showOptions, setShowOptions] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const open = (next: HelpPromptKey, options: boolean) => { setKey(next); setShowOptions(options); };
  const setStore = (next: HelpPresetStore) => onChange({ presets: next });
  const duplicate = (name: string) => setStore(duplicateHelpPreset(store, active.id, randomUUID(), name));
  const copyName = `${active.name} (copy)`;
  const prompt = PROMPTS_COPY.prompts[key];
  const promptName = `${prompt.label} Prompt`;
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useMountedRef();
  // The import reads the settings after the file text arrives, not as they were at the click.
  const latest = useRef(settings);
  latest.current = settings;
  const { mascot, mascotPresets } = settings;
  const preview = useMemo(() => helpChipPreview(helpChipValues(key, { mascot, mascotPresets })), [key, mascot, mascotPresets]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const morph = useMorphFullscreen(panelRef);

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

  const presetActions = presetHeaderActions(readOnly, {
    duplicate: () => duplicate(copyName),
    rename: () => setPending({ kind: 'rename' }),
    import: () => fileRef.current?.click(),
    export: exportPreset,
    reset: {
      run: () => setStore(resetHelpPreset(store, active.id)),
      description: `Reset every prompt and option in the "${active.name}" preset to its default value? This can't be undone.`,
    },
    delete: {
      run: () => setStore(deleteHelpPreset(store, active.id)),
      description: `Delete the "${active.name}" preset? This can't be undone.`,
    },
  });

  return (
    <div ref={panelRef} className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
      <PanelShell morph={morph} sourceRef={panelRef} title="Prompts" showTitle={false}>
      <PresetHeader
        label={PROMPTS_COPY.preset.label}
        actions={presetActions}
        testId="help-preset-header-row"
        target={targetAttribute('formaquestionSettings.prompts', 'preset')}
        select={(
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
        )}
      />
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" data-testid="help-preset-input" onChange={(event) => void importPreset(event)} />
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
                {isHelpRequestKey(id) && <SelectItem value={optionsValue(id)}>{`${PROMPTS_COPY.prompts[id].label} ${PROMPTS_COPY.options.title}`}</SelectItem>}
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
              {isHelpRequestKey(id) && (
                <CompactSelectionRow
                  className="pl-6" selected={key === id && showOptions} showCheck={false} aria-pressed={undefined}
                  aria-label={`${PROMPTS_COPY.prompts[id].label} ${PROMPTS_COPY.options.title}`}
                  aria-current={key === id && showOptions ? 'true' : undefined} onClick={() => open(id, true)}
                >
                  {PROMPTS_COPY.options.title}
                </CompactSelectionRow>
              )}
            </Fragment>
          ))}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showOptions && isHelpRequestKey(key) ? (
            <RequestOptions
              key={`${active.id}:${key}`}
              prompt={key}
              options={active.options[key]}
              readOnly={readOnly}
              readOnlyReason={readOnly ? PROMPTS_COPY.readOnly(active.name) : undefined}
              onRequestEdit={() => duplicate(copyName)}
              onExitFullscreen={morph.contentInOverlay ? morph.toggle : undefined}
              onChange={(change) => setStore(editHelpOptions(store, active.id, key, change))}
            />
          ) : (
            <PromptField
              key={`${active.id}:${key}`}
              label={prompt.label}
              ariaLabel={promptName}
              hint={prompt.hint}
              value={active.prompts[key]}
              onChange={(text) => setStore(editHelpPrompt(store, active.id, key, text))}
              vocabulary={VOCABULARIES[key]}
              previewValues={preview}
              readOnly={readOnly}
              readOnlyReason={readOnly ? PROMPTS_COPY.readOnly(active.name) : undefined}
              onRequestEdit={() => duplicate(copyName)}
              fullscreen={morph.contentInOverlay}
              onRequestFullscreen={morph.toggle}
              className="min-h-0 flex-1"
            />
          )}
        </div>
      </div>

      {/* The pair targets the prompt on screen: none on the Default preset or an Options view. */}
      {!readOnly && !showOptions && (
        <PromptResetCompare
          className="flex-shrink-0"
          name={promptName}
          value={active.prompts[key]}
          defaultValue={DEFAULT_HELP_PROMPTS[key]}
          onReset={() => setStore(resetHelpPrompt(store, active.id, key))}
          vocabulary={VOCABULARIES[key]}
          surface="formaquestionCompare"
        />
      )}
      <PresetNameDialog
        open={pending?.kind === 'add' || pending?.kind === 'rename'}
        mode={pending?.kind === 'rename' ? 'rename' : 'add'}
        initialName={pending?.kind === 'rename' ? active.name : copyName}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        onSubmit={(name) => (pending?.kind === 'rename' ? setStore(renameHelpPreset(store, active.id, name)) : duplicate(name))}
      />
      </PanelShell>
    </div>
  );
}
