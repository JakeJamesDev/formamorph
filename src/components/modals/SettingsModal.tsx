import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSettings, type ThinkingMode, type ReasoningEffort, type ParagraphLimit } from '@/contexts/SettingsContext';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS, THEME_COLORS, FONT_OPTIONS, NARRATION_FONT_OPTIONS, DEFAULT_NARRATION_SCALE, DEFAULT_NARRATION_LINE_HEIGHT, CONTINUE_CHOICE_MODES, type ContinueChoiceMode, type ThemeColor, type FontChoice, type NarrationFont } from '@/contexts/settingsDefaults';
import { useTheme } from '../theme-provider';
import { ThemePreviewButton } from '@/components/ThemePreviewDialog';
import { LocalModelPanel } from '@/components/modals/LocalModelPanel';
import LlmSetupGuide from '@/components/modals/LlmSetupGuide';
import { settingsTabsFor } from '@/components/modals/settingsTabs';
import { readSettingsMode, writeSettingsMode, type SettingsMode } from '@/lib/settingsMode';
import { settingsUseAdvancedValues } from '@/lib/settingsAdvancedData';
import { TutorialPopover } from '@/components/TutorialPopover';
import { useDevRoute } from '@/lib/devRouter';
import { Row, CheckRow, Section, SubGroup, HintInfo } from '@/components/SettingsRows';
import { SETTINGS_COPY, SETTINGS_BUTTONS, SETTINGS_CONFIRMS, type SettingCopy, type SettingCopyKey } from '@/components/modals/settingsCopy';
import TagField from '@/components/prompt/TagField';
import { reasoningTabs, reasoningPromptTabs, defaultPromptReasoning, defaultReasoningBudgetPct, REASONING_CONTROL_KINDS, type PromptReasoning } from '@/lib/reasoningEffort';
import { ExportPresetDialog, ImportPresetDialog } from '@/components/modals/PresetShareDialogs';
import { type SharedPreset } from '@/lib/promptPresetShare';
import { APP_VERSION } from '@/lib/version';
import { normalizeEndpointUrl, endpointUrlWasCompleted } from '@/lib/endpointUrl';
import { computePromptTabAvailability } from '@/lib/promptTabAvailability';
import { visibleGroups, SURFACE_LABELS, PROMPT_DESCRIPTIONS, type PromptSurface } from '@/lib/promptGroups';
import { Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, dialogFullHeightMobile } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FullscreenShell } from "@/components/FullscreenShell";
import { useMorphFullscreen } from "@/lib/useMorphFullscreen";
import { composePreviewValues } from "@/lib/previewValuePool";
import { Button } from "@/components/ui/button";
import { RevealAnimationDemoButton } from "@/components/RevealAnimationDemo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { loadEmbeddingModel, disposeEmbeddingModel, type EmbeddingLoadProgress } from '@/lib/embeddingWorkerClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import PromptField from '../prompt/PromptField';
import { PROMPT_KIND_VARIABLES, PROMPT_KIND_USER_VARIABLES, NOW_LINE_VARIABLES, SUBJECT } from '@/lib/promptVariables';
import { defaultPromptSampler } from '@/lib/promptSamplers';
import { useEndpointReachable } from '@/lib/useEndpointReachable';
import { ReadOnlyNotice } from '@/components/prompt/ReadOnlyNotice';
import type { AIRequestType } from '@/types';
import { ConfirmDialog } from '../ConfirmDialog';
import { toast } from 'react-toastify';
import WorldStorageService from '@/services/WorldStorageService';
import { cachedImageBytes, clearCachedImages } from '@/lib/remoteImageCache';
import { formatBytes } from '@/lib/imageOptim';
import { DEFAULT_WORLDS, readDeletedDefaultWorlds, clearDeletedDefaultWorlds } from '@/lib/defaultWorlds';
import { PresetNameDialog } from './PresetNameDialog';
import { defaultSystemPrompt, defaultNarrationUserPrompt, defaultRecapUserPrompt, defaultRehydrateUserPrompt, defaultOocDirectivePrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt, defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt, defaultChoicesUserPrompt, defaultStatUpdatesUserPrompt, defaultLocationChangeUserPrompt, defaultSummaryUserPrompt, defaultDiaryPrompt, defaultDirectorPrompt, defaultDirectorUserPrompt, defaultCharacterPrompt, defaultStoryboardPrompt, defaultNowLinePrompt, defaultTimePassedPrompt, defaultTimePassedUserPrompt, defaultOpeningTimePrompt, defaultOpeningTimeUserPrompt, defaultSceneTagsPrompt, defaultSceneTagsUserPrompt } from '../game/GamePrompts';
import { isDesktop } from '@/lib/imageGen/desktop';
import { fetchComfyMeta, DEFAULT_COMFY_WORKFLOW, type ComfyMeta } from '@/lib/imageGen/comfyui';
import { fetchInvokeMeta, invokeConnectionMessage, encodersFor, vaesFor, PREFIXED_BASES, type InvokeMeta } from '@/lib/imageGen/invokeai';
import { DEFAULT_ENDPOINT_BY_PROVIDER, resolveImageEndpoint } from '@/lib/imageGen';
import { TokenAutocomplete } from '@/components/TokenAutocomplete';
import { COMMON_LANGUAGES } from '@/lib/languages';
import ImageSetupGuide from './ImageSetupGuide';
import ComfyWorkflowGuide from './ComfyWorkflowGuide';
import { DEFAULT_TAG_PROMPT, SUBJECT_GUIDANCE } from '@/lib/imagePrompt';
import { resetTutorials, useSeenTutorialCount, useTutorial } from '@/lib/tutorials';

/** Spreads one setting's copy onto a `Row` or `CheckRow`, so a call site names the setting and nothing
 *  else — the label, description, badge and `ⓘ` all come from `settingsCopy`, where they are guarded. */
function copy(key: SettingCopyKey) {
  const c: SettingCopy = SETTINGS_COPY[key];
  return {
    label: c.label,
    hint: c.description,
    experimental: c.experimental,
    info: c.info ? <HintInfo>{c.info}</HintInfo> : undefined,
  };
}

// Segmented-control options: a short tab label plus the helper text shown below the selected one.
const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string; help: string }[] = [
  { value: 'light', label: 'Light', help: 'Always uses the light color scheme.' },
  { value: 'dark', label: 'Dark', help: 'Always uses the dark color scheme.' },
  { value: 'system', label: 'System', help: 'Recommended. Follows your OS light/dark setting.' },
];

const PARAGRAPH_LIMIT_OPTIONS: { value: ParagraphLimit; label: string; help: string }[] = [
  { value: 'none', label: 'None', help: 'No paragraph limit. The model writes until it finishes or hits the token cap.' },
  { value: 'single', label: 'Single', help: 'One paragraph per turn (stops at the first line break).' },
  { value: 'auto', label: 'Auto', help: 'Recommended. Scales the paragraph count to your Max Output Tokens so responses fit the budget and end cleanly.' },
];
const THINKING_OPTIONS: { value: ThinkingMode; label: string; help: string }[] = [
  { value: 'off', label: 'Native', help: 'Nothing is added to the prompt. Reasoning models think as they normally would; other models respond immediately.' },
  { value: 'inline', label: 'Inline', help: 'The model reasons privately before narrating, in the same request. One fewer round-trip.' },
  { value: 'precall', label: 'Planning', help: 'Recommended. A separate request is sent to plan narration before writing it. Most reliable for small models.' },
  { value: 'staged', label: 'Staged', help: 'Highest quality, slowest. A director picks the cast, each character plans its motivation, and a storyboarder writes the plan — several extra requests per turn.' },
];
/** Sentinel for the InvokeAI "no board" choice — Radix Select rejects an empty-string item value, and the
 *  stored setting is '' (Uncategorized). */
const UNCATEGORIZED_BOARD = '__uncategorized__';

/** A segmented option control that collapses to a dropdown on mobile: a full-width Select below `sm`, the
 *  tab row at `sm+`. Both drive the same value, so option help stacked beneath it (by the caller) is unaffected. */
function OptionSwitcher({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:hidden"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="hidden sm:block">
        <ToggleGroup
          type="single"
          value={value}
          // A single ToggleGroup clears its value when the active item is clicked again; every caller's
          // setting is required, so an empty result is ignored rather than stored.
          onValueChange={(v) => { if (v) onChange(v); }}
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        >
          {options.map((o) => <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
    </>
  );
}

/** Parse a numeric `<input>` value, falling back to `min` when it's empty or invalid. Without this a cleared
 *  field yields `Number('') === 0`, which would persist a zero (a 0-token request, a 0px image) to settings. */
const numInput = (raw: string, min: number): number => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : min;
};

// Per-value help; the tabs themselves are built from the endpoint's detected support via `reasoningTabs`.
// The "only applies to reasoning models" caveat is a property of the control, not of any one level, so it
// lives once in the row's ⓘ rather than closing all eight of these.
const REASONING_EFFORT_HELP: Record<ReasoningEffort, string> = {
  auto: 'No hint sent — the endpoint decides.',
  none: 'Disables native reasoning.',
  minimal: 'Minimal effort.',
  low: 'Low effort.',
  medium: 'Medium effort.',
  high: 'High effort.',
  xhigh: 'Extra-high effort.',
  max: 'Maximum effort.',
};

/** Per-prompt control: how many recent turns this prompt receives verbatim (the rest are summarized). */
function VerbatimTurnsField({ id, value, onChange, disabled }: { id: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const c = SETTINGS_COPY.verbatimTurns;
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <label htmlFor={id} className="text-label">{c.label}</label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
        className="w-20"
      />
      <span className="hidden sm:inline text-helper text-muted-foreground">{c.description}</span>
      <HintInfo>{c.info}</HintInfo>
    </div>
  );
}

// The prompt sub-tab keys map to their `AIRequestType` for per-prompt temperature lookup.
const TAB_TO_REQUEST: Record<string, AIRequestType> = {
  narration: 'narration', thinking: 'thinking', choices: 'choices', statupdates: 'statUpdates',
  location: 'locationChange', summary: 'summary', diary: 'diary', director: 'director',
  character: 'character', storyboard: 'storyboard', timepassed: 'timePassed', timeopening: 'openingTime',
};

/** One custom-sampler override row: a checkbox that enables the override, a slider, and a value readout that
 *  shows "Endpoint default" while off when the sampler is omitted (a non-pinned prompt on a custom endpoint).
 *  On reveals the stored custom value, which persists across toggling and is sent to any endpoint. */
interface SamplerControlProps {
  id: string;
  label: string;
  hint: string;
  /** Markdown for the row's `ⓘ`, when the setting has a cost or mechanism worth stating. */
  info?: string;
  custom: boolean;
  value: number;
  /** The value shown when off, or undefined when the prompt omits the sampler (endpoint decides). */
  defaultValue: number | undefined;
  min: number;
  max: number;
  step: number;
  /** When true the whole control is read-only (a built-in prompt preset) — checkbox and slider both locked. */
  disabled?: boolean;
  onCustomChange: (custom: boolean) => void;
  onValueChange: (value: number) => void;
}
function SamplerControl({ id, label, hint, info, custom, value, defaultValue, min, max, step, disabled, onCustomChange, onValueChange }: SamplerControlProps) {
  const omitsWhenOff = defaultValue === undefined;
  const shown = custom ? value : (defaultValue ?? value);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={custom} disabled={disabled} onCheckedChange={(c) => onCustomChange(c === true)} />
        <label htmlFor={id} className="text-label">{label}</label>
        <span className="hidden sm:inline text-helper text-muted-foreground">{hint}</span>
        {info && <HintInfo>{info}</HintInfo>}
      </div>
      {/* pl-2.5 is the thumb's own overhang: it centers on the value, so at `min` it reaches 10px left of
          the track and would be clipped by the scroll frame. Only the left needs it — the readout and its
          gap already clear the right — so everything else in the panel stays flush with the editor. */}
      <div className="flex items-center gap-3 pl-2.5">
        <Slider
          className={`flex-grow${custom && !disabled ? '' : ' opacity-60'}`}
          value={[shown]}
          min={min}
          max={max}
          step={step}
          disabled={disabled || !custom}
          onValueChange={(v) => onValueChange(v[0])}
        />
        <span className="w-28 text-right text-label tabular-nums">
          {custom || !omitsWhenOff ? shown.toFixed(2) : <span className="text-muted-foreground not-italic">Endpoint default</span>}
        </span>
      </div>
    </div>
  );
}

/** Sentinel for the Use Active Endpoint row — Radix Select cannot hold an empty-string value, and "unpinned" is
 *  stored as an absent map entry rather than an id. */
const FOLLOW_ACTIVE = '__follow__';

/**
 * Which endpoint preset this prompt sends to. Use Active Endpoint (the default) means the prompt goes wherever the
 * globally-selected preset points, as it did before routing existed; any other choice pins this prompt alone.
 * Unlike the rest of this panel it is NOT preset-scoped — endpoint routing is global, so it stays editable
 * under a built-in prompt preset and is never carried by a shared one.
 */
/**
 * Whether a routed prompt's endpoint is actually answering. Only rendered for a pinned prompt: an unpinned
 * one uses the active endpoint, whose reachability the setup gate already reports. `unknownModel` is a
 * reachable server that can't serve the configured model, so it reads as a warning rather than an outage.
 */
function EndpointReachabilityBadge({ target }: { target: { url: string; apiToken: string; model: string; enabled: boolean } }) {
  const { status, checking, recheck } = useEndpointReachable(target.url, target.apiToken, target.model, target.enabled);
  if (!target.enabled) return null;

  const state = checking
    ? { dot: 'bg-muted-foreground animate-pulse', text: 'Checking…', tone: 'text-muted-foreground' }
    : status === 'ok'
      ? { dot: 'bg-success', text: 'Reachable', tone: 'text-muted-foreground' }
      : status === 'unknownModel'
        ? { dot: 'bg-warning', text: `Reachable, but no "${target.model}"`, tone: 'text-warning' }
        : status === 'unreachable'
          ? { dot: 'bg-destructive', text: "Didn't answer", tone: 'text-destructive' }
          : { dot: 'bg-muted-foreground', text: 'Not checked', tone: 'text-muted-foreground' };

  return (
    <div className="flex items-center gap-2 text-meta">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', state.dot)} />
      <span className={state.tone}>{state.text}</span>
      <button
        type="button"
        onClick={recheck}
        disabled={checking}
        className="text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      >
        Recheck
      </button>
    </div>
  );
}

function PromptEndpointField({ value, activeName, presets, onChange, target, disabled }: {
  value: string | null;
  activeName: string;
  presets: { id: string; name: string }[];
  onChange: (id: string | null) => void;
  /** The routed target to probe. `enabled` is false for an unpinned prompt, which shows no badge. */
  target: { url: string; apiToken: string; model: string; enabled: boolean };
  /** Read-only under a built-in prompt preset, which carries no routing (same rule as the tuning below). */
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <label className="text-label">{SETTINGS_COPY.promptEndpoint.label}</label>
        {/* Which endpoint this prompt is actually pinned to varies; the description above it does not. */}
        <HintInfo>{value === null
          ? 'Goes wherever AI Endpoints is pointed. Switch endpoints there and this prompt follows.'
          : `Always goes to ${presets.find((p) => p.id === value)?.name ?? 'this endpoint'}, even when you switch endpoints elsewhere.`}</HintInfo>
      </div>
      <span className="text-helper text-muted-foreground">{SETTINGS_COPY.promptEndpoint.description}</span>
      <Select
        value={value ?? FOLLOW_ACTIVE}
        onValueChange={(v) => onChange(v === FOLLOW_ACTIVE ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={FOLLOW_ACTIVE}>Use Active Endpoint ({activeName})</SelectItem>
          {/* A bare divider rather than a group heading: the two halves still read apart, without a row
              that looks selectable and isn't. */}
          <SelectSeparator />
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <EndpointReachabilityBadge target={target} />
    </div>
  );
}

/** A prompt's Native Reasoning override: `Global | None | <levels>`, shown only for narration/choices under
 *  Native mode. `Global` follows the endpoint-wide level; the rest override this prompt alone. */
function PromptReasoningField({ value, options, onChange, disabled }: {
  value: PromptReasoning;
  options: { value: PromptReasoning; label: string }[];
  onChange: (v: PromptReasoning) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <label className="text-label">{SETTINGS_COPY.promptNativeReasoning.label}</label>
        <HintInfo>{SETTINGS_COPY.promptNativeReasoning.info}</HintInfo>
      </div>
      <span className="text-helper text-muted-foreground">{SETTINGS_COPY.promptNativeReasoning.description}</span>
      <ToggleGroup
        type="single"
        value={value}
        // A single ToggleGroup clears its value when the active item is clicked again; the override always
        // has a level (Global included), so an empty result is ignored rather than stored.
        onValueChange={(v) => { if (v) onChange(v as PromptReasoning); }}
        className="grid w-full"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((t) => (
          <ToggleGroupItem key={t.value} value={t.value} disabled={disabled}>{t.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** A prompt's Native Reasoning BUDGET (local engine only): a % of Max Output Tokens the model may spend on its
 *  thought segment. 0% = no reasoning on this prompt; higher caps it. Replaces the effort control on the local
 *  engine, which budgets the thought segment directly rather than taking a coarse effort hint. */
function PromptReasoningBudgetField({ value, onChange, disabled }: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-label">{SETTINGS_COPY.reasoningBudget.label}</label>
        <span className="hidden sm:inline text-helper text-muted-foreground">{SETTINGS_COPY.reasoningBudget.description}</span>
        <HintInfo>{SETTINGS_COPY.reasoningBudget.info}</HintInfo>
      </div>
      {/* pl-2.5 for the thumb's overhang at 0 — see SamplerControl. */}
      <div className="flex items-center gap-3 pl-2.5">
        <Slider
          className={`flex-grow${disabled ? ' opacity-60' : ''}`}
          value={[value]}
          min={0}
          max={100}
          step={5}
          disabled={disabled}
          onValueChange={(v) => onChange(v[0])}
        />
        <span className="w-28 text-right text-label tabular-nums">{value === 0 ? <span className="text-muted-foreground not-italic">No reasoning</span> : `${value}%`}</span>
      </div>
    </div>
  );
}

/** The per-prompt Options sub-tab: the verbatim-turns control (only when digests are on and the prompt uses
 *  them), the per-prompt Native Reasoning override (narration/choices under Native only — the effort level on
 *  external endpoints, or the token budget on the local engine), plus one override row per tunable sampler.
 *  `disabled` locks every control when the active prompt preset is built-in (Default/Simple). */
function PromptOptionsPanel({ endpoint, verbatim, reasoning, reasoningBudget, samplers, disabled, readOnlyReason, onRequestEdit }: {
  endpoint: React.ComponentProps<typeof PromptEndpointField>;
  verbatim: { value: number; set: (n: number) => void } | null;
  reasoning: { value: PromptReasoning; options: { value: PromptReasoning; label: string }[]; set: (v: PromptReasoning) => void } | null;
  reasoningBudget: { value: number; set: (v: number) => void } | null;
  samplers: SamplerControlProps[];
  disabled: boolean;
  /** What is read-only, named in the notice. Absent on an editable preset. */
  readOnlyReason?: string;
  onRequestEdit?: () => void;
}) {
  return (
    <>
      {/* Same notice the editor carries: every control below is inert under a built-in, and a panel of dead
          checkboxes and sliders reads as broken rather than protected unless it says why. Outside the padded
          box so it lands at the same height as the editor's — inside, the panel's own top padding nudged it
          down and it visibly shifted when moving between a prompt's sub-tabs. */}
      {disabled && readOnlyReason && (
        <ReadOnlyNotice reason={readOnlyReason} onRequestEdit={onRequestEdit} />
      )}
      {/* Flush with the editor beside it. The slider thumb's clearance is on the slider rows themselves, so
          it no longer narrows the whole panel; the scroll frame supplies the right-hand gutter. */}
      <div className="space-y-5 py-3">
        <PromptEndpointField {...endpoint} disabled={disabled} />
        {verbatim && <VerbatimTurnsField id="promptVerbatim" value={verbatim.value} onChange={verbatim.set} disabled={disabled} />}
        {reasoning && <PromptReasoningField value={reasoning.value} options={reasoning.options} onChange={reasoning.set} disabled={disabled} />}
        {reasoningBudget && <PromptReasoningBudgetField value={reasoningBudget.value} onChange={reasoningBudget.set} disabled={disabled} />}
        {samplers.map((s) => <SamplerControl key={s.id} {...s} disabled={disabled} />)}
      </div>
    </>
  );
}

/**
 * The Prompts panel, either in place or filling the screen. Fullscreen is owned here rather than by
 * PromptField so the rail comes with it — the editor alone in a full-screen window loses the very
 * navigation that makes a long prompt findable.
 *
 * Toggling re-parents the panel into the overlay, so the editor is rebuilt from its value: the text is
 * safe (it is controlled) but the undo stack starts fresh on either side of the toggle.
 */
function PromptsShell({ fullscreen, sourceRef, children }: {
  fullscreen: boolean;
  /** The tab panel the rail sits in — what the window grows out of and shrinks back into. */
  sourceRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  // The caller owns the flag, so the morph follows it rather than the other way round. The rail has no
  // wrapper of its own — its children are flex items of the tab panel — so the panel is what it grows from.
  const morph = useMorphFullscreen(sourceRef);
  useEffect(() => { if (fullscreen) morph.open(); else morph.close(); }, [fullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!morph.mounted) return <>{children}</>;
  // A panel, not a field: nothing inside it carries a caption, so this is the one window that has to name
  // itself.
  return (
    <FullscreenShell
      morph={morph}
      title="Prompts"
      showTitle
      returnFocus={() => sourceRef.current?.querySelector<HTMLElement>('button[aria-label="Edit full screen"]')}
    >
      {children}
    </FullscreenShell>
  );
}

export const SettingsModal = ({ isOpen, onOpenChange, previewValues, initialTab, initialEndpointTab, initialPromptTab, onWorldsRestored, forcedMode }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after Restore Default Worlds re-seeds, so a world list on screen can refresh. */
  onWorldsRestored?: () => void;
  /** Live variable values for the prompt-editor Preview tab. Supplied only in-game; absent → no Preview. */
  previewValues?: Record<string, string>;
  /** DEV dev-router: open on this top-level tab instead of the default (see `devRouter.ts`). */
  initialTab?: string;
  /** Which AI Endpoints sub-tab to open ('text-endpoint' | 'img-endpoint' | 'img-tagprompt'). Used by the
   *  "Open Settings" shortcut in the image generation dialog to land straight on Image. */
  initialEndpointTab?: string;
  /** DEV dev-router: which prompt under the Prompts tab to open (e.g. 'narration', 'thinking'). */
  initialPromptTab?: string;
  /** Overrides the stored Simple/Advanced preference (the dev-router's `mode` param; tests set it directly). */
  forcedMode?: SettingsMode;
}) => {
  const devRoute = useDevRoute();
  const routeMode = import.meta.env.DEV && (devRoute?.mode === 'simple' || devRoute?.mode === 'advanced')
    ? devRoute.mode
    : undefined;
  // Asking for a tab Simple hides is asking for Advanced: `goto('settings', { tab: 'prompts' })` and the
  // image dialog's jump to the Tag Prompt editor both name a destination, and landing somewhere else
  // instead is the dev-router failure that is hardest to notice.
  const wantsAdvancedTab = (!!initialTab && settingsTabsFor(false).every((t) => t.value !== initialTab))
    || initialEndpointTab === 'img-tagprompt';
  const [mode, setModeState] = useState<SettingsMode>(() =>
    forcedMode ?? routeMode ?? (wantsAdvancedTab ? 'advanced' : readSettingsMode()));
  const setMode = useCallback((next: SettingsMode) => { setModeState(next); writeSettingsMode(next); }, []);
  const advanced = mode === 'advanced';
  // Each parsed route is a fresh object, so a `goto` with the mode already showing still re-applies it —
  // a mount-time seed alone would miss that once the switch had been clicked.
  const lastRoute = useRef(devRoute);
  useEffect(() => {
    if (lastRoute.current === devRoute) return;
    lastRoute.current = devRoute;
    if (routeMode) setModeState(routeMode);
    else if (wantsAdvancedTab) setModeState('advanced');
  }, [devRoute, routeMode, wantsAdvancedTab]);
  useEffect(() => { if (forcedMode) setModeState(forcedMode); }, [forcedMode]);
  const visibleTabs = useMemo(() => settingsTabsFor(advanced), [advanced]);
  const { active: tutorial, nav: tutorialNav, dismiss } = useTutorial('settings', { active: isOpen });
  const dismissTutorial = useCallback(() => { if (tutorial) dismiss(tutorial.id); }, [tutorial, dismiss]);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? visibleTabs[0].value);
  const [endpointTab, setEndpointTab] = useState<string>(initialEndpointTab ?? 'text-endpoint');
  // Switching to Simple while standing on a hidden tab would blank the panel with no way back to it.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === activeTab)) setActiveTab(visibleTabs[0].value);
  }, [visibleTabs, activeTab]);
  useEffect(() => {
    if (!advanced && endpointTab === 'img-tagprompt') setEndpointTab('text-endpoint');
  }, [advanced, endpointTab]);
  // Deleted-default count, refreshed whenever the modal opens: localStorage isn't reactive, and the player
  // may have deleted a world since it last rendered.
  const [deletedDefaultCount, setDeletedDefaultCount] = useState(0);
  useEffect(() => { if (isOpen) setDeletedDefaultCount(readDeletedDefaultWorlds().size); }, [isOpen]);
  // Same reasoning for the linked-image cache: it grows during play, so re-measure on open rather than once.
  const [cachedBytes, setCachedBytes] = useState(0);
  const seenTutorialCount = useSeenTutorialCount();
  useEffect(() => { if (isOpen) cachedImageBytes().then(setCachedBytes).catch(() => setCachedBytes(0)); }, [isOpen]);

  const clearImageCache = async () => {
    try {
      await clearCachedImages();
      setCachedBytes(0);
      toast.success('Cached images cleared');
    } catch {
      toast.error('Could not clear the cached images');
    }
  };

  const restoreDefaultWorlds = async () => {
    clearDeletedDefaultWorlds();
    try {
      const { failed } = await WorldStorageService.loadDefaultWorlds(DEFAULT_WORLDS);
      if (failed.length) toast.error(`Some default worlds failed to restore: ${failed.join(', ')}`);
      else toast.success('Default worlds restored');
    } catch {
      toast.error('Could not restore the default worlds');
    }
    setDeletedDefaultCount(readDeletedDefaultWorlds().size);
    onWorldsRestored?.();
  };
  // Honor a later dev-router tab change while the modal stays open (a fresh __fmDev.goto).
  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);
  useEffect(() => { if (initialEndpointTab) setEndpointTab(initialEndpointTab); }, [initialEndpointTab]);
  const {
    bgmEnabled,
    setBgmEnabled,
    language,
    setLanguage,
    endpointUrl,
    setEndpointUrl,
    apiToken,
    setApiToken,
    modelName,
    setModelName,
    maxTokens,
    setMaxTokens,
    contextWindow,
    contextWindowOverride,
    setContextWindowOverride,
    detectedContextWindow,
    detectStatus,
    detectContextWindow,
    localModelActive,
    builtinTextEndpointPresets,
    textEndpointPresets,
    activeTextEndpointPresetId,
    activeTextEndpointPresetIsBuiltIn,
    activeTextEndpointPresetName,
    selectTextEndpointPreset,
    addTextEndpointPreset,
    renameTextEndpointPreset,
    deleteTextEndpointPreset,
    resetTextEndpointPreset,
    systemPrompt,
    setSystemPrompt,
    choicesPrompt,
    setChoicesPrompt,
    statUpdatesPrompt,
    setStatUpdatesPrompt,
    locationChangePromptText,
    setLocationChangePromptText,
    choicesEnabled,
    continueChoiceMode,
    setContinueChoiceMode,
    setChoicesEnabled,
    statUpdatesEnabled,
    setStatUpdatesEnabled,
    locationChangeEnabled,
    setLocationChangeEnabled,
    locationAutoApply,
    setLocationAutoApply,
    narrationVerbatimTurns,
    setNarrationVerbatimTurns,
    thinkingVerbatimTurns,
    setThinkingVerbatimTurns,
    choicesVerbatimTurns,
    setChoicesVerbatimTurns,
    statUpdatesVerbatimTurns,
    setStatUpdatesVerbatimTurns,
    locationChangeVerbatimTurns,
    setLocationChangeVerbatimTurns,
    summaryVerbatimTurns,
    setSummaryVerbatimTurns,
    thinkingMode,
    setThinkingMode,
    limitActiveCharacters,
    setLimitActiveCharacters,
    activeCharacterLimit,
    setActiveCharacterLimit,
    reasoningEffort,
    setReasoningEffort,
    supportedReasoningEfforts,
    promptReasoning,
    setPromptReasoning,
    promptReasoningBudget,
    setPromptReasoningBudget,
    thinkingPrompt,
    setThinkingPrompt,
    summaryPrompt,
    setSummaryPrompt,
    diaryPrompt,
    setDiaryPrompt,
    directorPrompt,
    setDirectorPrompt,
    directorUserPrompt,
    setDirectorUserPrompt,
    characterPrompt,
    setCharacterPrompt,
    storyboardPrompt,
    setStoryboardPrompt,
    narrationUserPrompt,
    setNarrationUserPrompt,
    recapUserPrompt,
    rehydrateUserPrompt,
    setRehydrateUserPrompt,
    setRecapUserPrompt,
    oocDirectivePrompt,
    setOocDirectivePrompt,
    choicesUserPrompt,
    setChoicesUserPrompt,
    statUpdatesUserPrompt,
    setStatUpdatesUserPrompt,
    locationChangeUserPrompt,
    setLocationChangeUserPrompt,
    summaryUserPrompt,
    nowLinePrompt,
    setNowLinePrompt,
    timePassedPrompt,
    setTimePassedPrompt,
    timePassedUserPrompt,
    setTimePassedUserPrompt,
    openingTimePrompt,
    setOpeningTimePrompt,
    openingTimeUserPrompt,
    setOpeningTimeUserPrompt,
    sceneTagsPrompt,
    setSceneTagsPrompt,
    sceneTagsUserPrompt,
    setSceneTagsUserPrompt,
    sceneImageAuto,
    setSceneImageAuto,
    setSummaryUserPrompt,
    promptPresets,
    builtinPresets,
    activePresetId,
    activeSectionStyle,
    presetPinnedToWorld,
    activePresetIsBuiltIn,
    selectPreset,
    addPreset,
    renamePreset,
    deletePreset,
    resetPreset,
    exportActivePreset,
    importPreset,
    memoryDigests,
    setMemoryDigests,
    semanticMemory,
    setSemanticMemory,
    semanticLore,
    setSemanticLore,
    semanticRehydration,
    timeContext,
    setTimeContext,
    aiClock,
    setAiClock,
    setSemanticRehydration,
    semanticDiaries,
    setSemanticDiaries,
    semanticBandCap,
    setSemanticBandCap,
    concurrentTurnRequests,
    setConcurrentTurnRequests,
    autosaveEnabled,
    setAutosaveEnabled,
    characterDiaries,
    describeCharacters,
    setDescribeCharacters,
    setCharacterDiaries,
    genTemperature,
    genRepetitionPenalty,
    promptSamplers,
    setPromptSamplerCustom,
    setPromptSamplerValue,
    promptEndpoints,
    setPromptEndpoint,
    resolveEndpointForKind,
    showSilentRequests,
    setShowSilentRequests,
    showReasoning,
    setShowReasoning,
    paragraphLimit,
    setParagraphLimit,
    locationBackground,
    setLocationBackground,
    backgroundOverlay,
    setBackgroundOverlay,
    markdownOutput,
    setMarkdownOutput,
    imageProvider,
    setImageProvider,
    imageEndpoint,
    setImageEndpoint,
    imageApiToken,
    setImageApiToken,
    imageModel,
    setImageModel,
    imagePositivePrompt,
    setImagePositivePrompt,
    imageNegativePrompt,
    setImageNegativePrompt,
    imagePortraitWidth,
    setImagePortraitWidth,
    imagePortraitHeight,
    setImagePortraitHeight,
    imageLandscapeWidth,
    setImageLandscapeWidth,
    imageLandscapeHeight,
    setImageLandscapeHeight,
    imageSteps,
    setImageSteps,
    imageCfg,
    setImageCfg,
    imageSampler,
    setImageSampler,
    imageAdetailer,
    setImageAdetailer,
    imageWorkflow,
    setImageWorkflow,
    imageInvokeEncoder,
    imageInvokeBoard,
    setImageInvokeBoard,
    setImageInvokeEncoder,
    imageInvokeVae,
    setImageInvokeVae,
    imageGenDisabled,
    setImageGenDisabled,
    imageEndpointPresets,
    activeImageEndpointPresetId,
    activeImageEndpointPresetName,
    selectImageEndpointPreset,
    addImageEndpointPreset,
    renameImageEndpointPreset,
    deleteImageEndpointPreset,
    resetImageEndpointPreset,
    imageTagPrompt,
    setImageTagPrompt,
    themeColor,
    setThemeColor,
    fontFamily,
    setFontFamily,
    narrationFont,
    setNarrationFont,
    narrationScale,
    setNarrationScale,
    narrationLineHeight,
    setNarrationLineHeight
  } = useSettings();
  const { theme, setTheme } = useTheme();
  const desktop = isDesktop();
  const [connectionGuideOpen, setConnectionGuideOpen] = useState(false);
  // Embedding-model download state for the semantic memory toggle. Local to the modal: the toggle
  // stays on through a failed download (scoring fails open until the model arrives), so this state
  // only drives the progress bar / error row.
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedProgress, setEmbedProgress] = useState<EmbeddingLoadProgress | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const startEmbeddingDownload = () => {
    setEmbedLoading(true);
    setEmbedError(null);
    setEmbedProgress(null);
    loadEmbeddingModel(setEmbedProgress)
      .then(() => setEmbedError(null))
      .catch((err) => setEmbedError((err as Error).message))
      .finally(() => { setEmbedLoading(false); setEmbedProgress(null); });
  };
  const handleSemanticMemoryToggle = (on: boolean) => {
    setSemanticMemory(on);
    if (on) startEmbeddingDownload();
    else if (!semanticLore) void disposeEmbeddingModel(); // model stays while any semantic feature needs it
  };
  const handleSemanticLoreToggle = (on: boolean) => {
    setSemanticLore(on);
    if (on) startEmbeddingDownload();
    else if (!semanticMemory) void disposeEmbeddingModel();
  };
  const handleResetEndpointSettings = () => {
    setEndpointUrl(DEFAULT_ENDPOINT);
    setModelName(DEFAULT_MODEL_NAME);
    setApiToken(DEFAULT_API_TOKEN);
    setContextWindowOverride(null);
    setMaxTokens(DEFAULT_MAX_TOKENS);
  };

  // Single status line under the Context Window field: red for over-limit or a failed manual detect,
  // gray for detecting / detected / the idle helper.
  const contextOverLimit =
    contextWindowOverride != null && detectedContextWindow != null && contextWindowOverride > detectedContextWindow;
  const contextStatus = activeTextEndpointPresetIsBuiltIn
    ? { red: false, text: 'Using the shared endpoint — add or pick a preset to set or detect the context window.' }
    : contextOverLimit
    ? { red: true, text: `Above the detected limit (${detectedContextWindow?.toLocaleString()} tok) — the server may truncate requests.` }
    : detectStatus === 'error'
      ? { red: true, text: "Couldn't detect context length from this endpoint." }
      : detectStatus === 'detecting'
        ? { red: false, text: 'Detecting context length…' }
        : detectStatus === 'success'
          ? { red: false, text: `Detected ${(detectedContextWindow ?? contextWindow).toLocaleString()} tok from the endpoint.` }
          : { red: false, text: 'Auto-detected from your endpoint; lower it if the model feels constantly full.' };

  // Preset name dialog (Add / Rename); the "Add New Preset…" select option opens it in add mode.
  const [presetDialog, setPresetDialog] = useState<{ mode: 'add' | 'rename' } | null>(null);
  const ADD_PRESET_SENTINEL = '__add_preset__';
  const IMPORT_PRESET_SENTINEL = '__import_preset__';
  const [exportShared, setExportShared] = useState<SharedPreset | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const activePresetName = [...builtinPresets, ...promptPresets].find((p) => p.id === activePresetId)?.name ?? '';
  const handlePresetSelect = (v: string) => {
    if (v === ADD_PRESET_SENTINEL) setPresetDialog({ mode: 'add' });
    else if (v === IMPORT_PRESET_SENTINEL) setImportOpen(true);
    else selectPreset(v);
  };
  const handlePresetNameSubmit = (name: string) => {
    if (presetDialog?.mode === 'add') addPreset(name);
    else if (presetDialog?.mode === 'rename') renamePreset(activePresetId, name);
  };
  // A built-in can't be edited, so the way forward is a copy of it. `addPreset` already clones the active
  // values and selects the result, so this is the whole gesture — no dialog in the way.
  const duplicateForEditing = () => addPreset(`${activePresetName} (copy)`);
  // Short enough for one line on mobile; the notice puts the whole sentence on hover.
  const readOnlyReason = activePresetIsBuiltIn ? `${activePresetName} is read-only` : undefined;

  // AI Endpoints → Image preset name dialog (mirrors the prompt preset one; all presets editable).
  const [imagePresetDialog, setImagePresetDialog] = useState<{ mode: 'add' | 'rename' } | null>(null);
  const IMG_ADD_PRESET_SENTINEL = '__add_image_preset__';

  // AI Endpoints → Text preset name dialog (immutable Default + editable user presets, like the prompts tab).
  const [textPresetDialog, setTextPresetDialog] = useState<{ mode: 'add' | 'rename' } | null>(null);
  const TEXT_ADD_PRESET_SENTINEL = '__add_text_preset__';
  const handleTextPresetSelect = (v: string) => {
    if (v === TEXT_ADD_PRESET_SENTINEL) setTextPresetDialog({ mode: 'add' });
    else selectTextEndpointPreset(v);
  };
  const handleTextPresetNameSubmit = (name: string) => {
    if (textPresetDialog?.mode === 'add') addTextEndpointPreset(name);
    else if (textPresetDialog?.mode === 'rename') renameTextEndpointPreset(activeTextEndpointPresetId, name);
  };

  // ComfyUI checkpoint/sampler lists that back the Model/Sampler autocompletes. Auto-fetched from
  // /object_info whenever ComfyUI is the active provider (debounced on endpoint edits); fails silently
  // when the server isn't up (it's fast and optional — free text still works). Gated on the modal being
  // open, same as the InvokeAI fetch below: the lists only feed this modal's fields.
  const [comfyMeta, setComfyMeta] = useState<ComfyMeta | null>(null);
  const [showImageSetup, setShowImageSetup] = useState(false);
  const [showComfyWorkflow, setShowComfyWorkflow] = useState(false);
  useEffect(() => {
    if (!isOpen || imageProvider !== 'comfyui') return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const meta = await fetchComfyMeta(resolveImageEndpoint(imageProvider, imageEndpoint), imageApiToken);
        if (!cancelled) setComfyMeta(meta);
      } catch {
        // silent: ComfyUI not running / unreachable — the fields fall back to free text
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isOpen, imageProvider, imageEndpoint, imageApiToken]);

  // InvokeAI model/submodel lists that back the Model + encoder/VAE override dropdowns. Auto-fetched from
  // /api/v2/models/ whenever InvokeAI is the active provider (debounced); fails silently when unreachable.
  // Gated on the modal being open: the component stays mounted while closed, and the lists only feed the
  // modal's own dropdowns — probing on page load just spams the console when InvokeAI isn't running.
  const [invokeMeta, setInvokeMeta] = useState<InvokeMeta | null>(null);
  const [invokeMetaError, setInvokeMetaError] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen || imageProvider !== 'invokeai') return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const endpoint = resolveImageEndpoint(imageProvider, imageEndpoint);
      try {
        const meta = await fetchInvokeMeta(endpoint, imageApiToken);
        if (!cancelled) { setInvokeMeta(meta); setInvokeMetaError(null); }
      } catch (error) {
        // Show what actually failed under the Model field (the fields still take free text): a rejected
        // token reads nothing like an unreachable server, and blaming CORS for a 401 sends the user away
        // from the one field that would fix it.
        if (!cancelled) { setInvokeMeta(null); setInvokeMetaError(invokeConnectionMessage(error, endpoint)); }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isOpen, imageProvider, imageEndpoint, imageApiToken]);
  // The selected model's base when it's one that loads its own encoder + VAE (Z-Image, Anima), else ''.
  // Drives whether those two override rows show at all, and what they offer.
  const invokeSubmodelBase = (() => {
    const base = invokeMeta?.models.find((m) => m.name === imageModel || m.key === imageModel)?.base ?? '';
    return PREFIXED_BASES[base] ? base : '';
  })();
  const handleImagePresetSelect = (v: string) => {
    if (v === IMG_ADD_PRESET_SENTINEL) setImagePresetDialog({ mode: 'add' });
    else selectImageEndpointPreset(v);
  };
  const handleImagePresetNameSubmit = (name: string) => {
    if (imagePresetDialog?.mode === 'add') addImageEndpointPreset(name);
    else if (imagePresetDialog?.mode === 'rename') renameImageEndpointPreset(activeImageEndpointPresetId, name);
  };

  // Preview needs values to swap the chips for, and a game supplies them. Without one the pane (and the
  // side-by-side split that depends on it) had nothing to show, so writing a prompt meant loading a world
  // first. Falling back to samples makes the editor usable from the main menu; `sampleData` badges the pane
  // so the stand-in content is never mistaken for the player's own world.
  // Guidance follows the player's own settings and is real either way; only the world-state tokens are
  // stand-ins, which is what the badge speaks to.
  const usingSampleValues = !previewValues;
  const effectivePreviewValues = composePreviewValues(
    { paragraphLimit, maxTokens, markdownOutput, sectionStyle: activeSectionStyle, limitActiveCharacters, activeCharacterLimit },
    previewValues,
  );

  // The selected prompt sub-tab, so the Reset button can target just that prompt.
  const [promptTab, setPromptTab] = useState(initialPromptTab ?? 'narration');
  // DEV dev-router: honor a requested prompt sub-tab (a `subtab=…` in the hash).
  useEffect(() => { if (initialPromptTab) setPromptTab(initialPromptTab); }, [initialPromptTab]);
  const promptResets: Record<string, { label: string; reset: () => void }> = {
    narration: { label: 'Narration', reset: () => setSystemPrompt(defaultSystemPrompt) },
    thinking: { label: 'Planning', reset: () => setThinkingPrompt(defaultThinkingPrompt) },
    choices: { label: 'Choices', reset: () => setChoicesPrompt(defaultChoicesPrompt) },
    statupdates: { label: 'Stat Updates', reset: () => setStatUpdatesPrompt(defaultStatUpdatesPrompt) },
    location: { label: 'Location Change', reset: () => setLocationChangePromptText(defaultLocationChangePrompt) },
    summary: { label: 'Summary', reset: () => setSummaryPrompt(defaultSummaryPrompt) },
    timepassed: { label: 'Clock', reset: () => setTimePassedPrompt(defaultTimePassedPrompt) },
    timeopening: { label: 'Opening', reset: () => setOpeningTimePrompt(defaultOpeningTimePrompt) },
    scenetags: { label: 'Scene Tags', reset: () => setSceneTagsPrompt(defaultSceneTagsPrompt) },
    diary: { label: 'Diary', reset: () => setDiaryPrompt(defaultDiaryPrompt) },
    director: { label: 'Director', reset: () => setDirectorPrompt(defaultDirectorPrompt) },
    character: { label: 'Character', reset: () => setCharacterPrompt(defaultCharacterPrompt) },
    storyboard: { label: 'Storyboard', reset: () => setStoryboardPrompt(defaultStoryboardPrompt) },
  };
  // Each prompt tab only exists while its prompt is enabled (toggled in Generation → System Prompts, or
  // its governing setting for Thinking/Summary). If the open tab is no longer available (disabled since,
  // or on reopen), fall back to Narration so the panel isn't blank.
  const promptAvailable = computePromptTabAvailability({
    thinkingMode, choicesEnabled, statUpdatesEnabled, locationChangeEnabled, memoryDigests, characterDiaries, aiClock,
    sceneImages: !imageGenDisabled,
  });
  const activePromptTab = promptAvailable[promptTab] ? promptTab : 'narration';
  // Tag Prompt only exists while image generation is on; fall back to Image so the panel is never blank.
  const activeEndpointTab = imageGenDisabled && endpointTab === 'img-tagprompt' ? 'img-endpoint' : endpointTab;
  const selectedPrompt = promptResets[activePromptTab] ?? promptResets.narration;

  // Each prompt has a System editor, an Options sub-tab, and — for the aux prompts — a User-message editor.
  // Narration additionally has a Messages view: the conditional user-slot lines that ride the narration
  // exchange (Recap, Recall, Direction), stacked with per-field resets, each hidden with its feature.
  // A System | User | Messages | Options toggle swaps between them (User/Messages only where they exist).
  // `promptView` resets to System on every tab change.
  const [promptView, setPromptView] = useState<'system' | 'user' | 'messages' | 'options'>('system');
  // Fullscreen for the whole Prompts panel (rail included), not for one field — see PromptsShell.
  const [promptsFullscreen, setPromptsFullscreen] = useState(false);
  const promptsPanelRef = useRef<HTMLDivElement | null>(null);
  const selectPromptTab = (t: string) => { setPromptTab(t); setPromptView('system'); };
  // The rail's groups, with prompts whose feature is off already removed.
  const railGroups = visibleGroups(promptAvailable);
  const userPrompts: Record<string, { value: string; set: (s: string) => void; reset: () => void; variables: typeof PROMPT_KIND_VARIABLES.choices }> = {
    // Narration's user template applies only with thinking off (GameViewer guard); hide the editor
    // in other modes so a change there can't silently do nothing.
    ...(thinkingMode === 'off' ? { narration: { value: narrationUserPrompt, set: setNarrationUserPrompt, reset: () => setNarrationUserPrompt(defaultNarrationUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.narration ?? [] } } : {}),
    choices: { value: choicesUserPrompt, set: setChoicesUserPrompt, reset: () => setChoicesUserPrompt(defaultChoicesUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.choices ?? [] },
    statupdates: { value: statUpdatesUserPrompt, set: setStatUpdatesUserPrompt, reset: () => setStatUpdatesUserPrompt(defaultStatUpdatesUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.statupdates ?? [] },
    location: { value: locationChangeUserPrompt, set: setLocationChangeUserPrompt, reset: () => setLocationChangeUserPrompt(defaultLocationChangeUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.location ?? [] },
    summary: { value: summaryUserPrompt, set: setSummaryUserPrompt, reset: () => setSummaryUserPrompt(defaultSummaryUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.summary ?? [] },
    timepassed: { value: timePassedUserPrompt, set: setTimePassedUserPrompt, reset: () => setTimePassedUserPrompt(defaultTimePassedUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.timepassed ?? [] },
    timeopening: { value: openingTimeUserPrompt, set: setOpeningTimeUserPrompt, reset: () => setOpeningTimeUserPrompt(defaultOpeningTimeUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.timeopening ?? [] },
    director: { value: directorUserPrompt, set: setDirectorUserPrompt, reset: () => setDirectorUserPrompt(defaultDirectorUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.director ?? [] },
    scenetags: { value: sceneTagsUserPrompt, set: setSceneTagsUserPrompt, reset: () => setSceneTagsUserPrompt(defaultSceneTagsUserPrompt), variables: PROMPT_KIND_USER_VARIABLES.scenetags ?? [] },
  };
  const activeUserPrompt = userPrompts[activePromptTab];
  const showingUser = promptView === 'user' && !!activeUserPrompt;
  // The recap line rides the narration history only while Memory Digests is on; the editor lives on the
  // Narration tab and hides with the feature so an edit can't silently do nothing.
  const recapAvailable = activePromptTab === 'narration' && memoryDigests;
  // The now-line closes the same recap reply, so it lives and hides with the recap itself.
  const nowAvailable = recapAvailable;
  // The recall line rides only while Scene Recall is on — same hide-with-the-feature rule as the recap.
  const recallAvailable = activePromptTab === 'narration' && memoryDigests && semanticMemory && semanticRehydration;
  // The direction rider fires only on [bracket] turns with thinking off (same guard as the User template).
  const directionAvailable = activePromptTab === 'narration' && thinkingMode === 'off';
  // The Messages view stacks whichever of the conditional narration lines are live.
  const messagesAvailable = recapAvailable || nowAvailable || recallAvailable || directionAvailable;
  const showingMessages = promptView === 'messages' && messagesAvailable;
  // The stacked fields the Messages view renders — one per live line, each with its own reset.
  const messageFields = [
    ...(recapAvailable ? [{
      key: 'recap', ...SETTINGS_COPY.recapMessage,
      value: recapUserPrompt, set: setRecapUserPrompt, def: defaultRecapUserPrompt,
      variables: undefined,
    }] : []),
    ...(nowAvailable ? [{
      key: 'now', ...SETTINGS_COPY.nowMessage,
      value: nowLinePrompt, set: setNowLinePrompt, def: defaultNowLinePrompt,
      variables: NOW_LINE_VARIABLES,
    }] : []),
    ...(recallAvailable ? [{
      key: 'recall', ...SETTINGS_COPY.recallMessage,
      value: rehydrateUserPrompt, set: setRehydrateUserPrompt, def: defaultRehydrateUserPrompt,
      variables: undefined,
    }] : []),
    ...(directionAvailable ? [{
      key: 'direction', ...SETTINGS_COPY.directionMessage,
      value: oocDirectivePrompt, set: setOocDirectivePrompt, def: defaultOocDirectivePrompt,
      variables: undefined,
    }] : []),
  ];
  // Which parts the open prompt actually has — the rail lists exactly these under it.
  const activeSurfaces: PromptSurface[] = [
    'system',
    ...(activeUserPrompt ? ['user' as const] : []),
    ...(messagesAvailable ? ['messages' as const] : []),
    'options',
  ];
  const showingOptions = promptView === 'options';
  // The Reset button targets whichever template is on screen. `label` is the full noun ("Narration Prompt"
  // or just "Message" for the user-message template), so the button reads "Reset <label>". The Messages
  // view carries its own per-field resets, so the footer button hides there (like Options).
  const resetTarget = showingUser && activeUserPrompt
    ? { label: `${selectedPrompt.label} Message`, reset: activeUserPrompt.reset }
    : { label: `${selectedPrompt.label} Prompt`, reset: selectedPrompt.reset };

  // Verbatim-turns control for the active prompt, shown once in the footer (like Reset).
  const promptVerbatim: Record<string, { value: number; set: (n: number) => void }> = {
    narration: { value: narrationVerbatimTurns, set: setNarrationVerbatimTurns },
    thinking: { value: thinkingVerbatimTurns, set: setThinkingVerbatimTurns },
    choices: { value: choicesVerbatimTurns, set: setChoicesVerbatimTurns },
    statupdates: { value: statUpdatesVerbatimTurns, set: setStatUpdatesVerbatimTurns },
    location: { value: locationChangeVerbatimTurns, set: setLocationChangeVerbatimTurns },
    summary: { value: summaryVerbatimTurns, set: setSummaryVerbatimTurns },
  };
  const activeVerbatimEntry = promptVerbatim[activePromptTab];
  const verbatimApplicable = memoryDigests && !!activeVerbatimEntry;

  // Per-prompt samplers for the active tab. Off shows the kind's default (read-only); on shows the stored
  // custom value (seeded to the default on first enable). A default of `undefined` means the prompt omits the
  // sampler (a non-pinned prompt on a custom endpoint) — the panel then shows "Endpoint default".
  const activeKind = TAB_TO_REQUEST[activePromptTab] ?? 'narration';
  const activeSamplers = promptSamplers[activeKind];
  // Endpoint routing for this prompt. A pin naming a preset that no longer exists shows as Use Active Endpoint —
  // the same thing it actually resolves to at request time.
  const routableEndpoints = [...builtinTextEndpointPresets, ...textEndpointPresets];
  const pinnedEndpointId = promptEndpoints[activeKind];
  // The rest of the panel describes what this prompt will actually send, so its engine flag and reasoning
  // support come from the routed target — a prompt pinned off the bundled engine gets the external-endpoint
  // controls even while the engine is running, and vice versa.
  const promptTarget = resolveEndpointForKind(activeKind);
  const promptLocalEngine = promptTarget.localEngine;
  const promptReasoningEfforts = promptTarget.supportedReasoningEfforts;
  const endpointControl = {
    value: pinnedEndpointId && routableEndpoints.some((p) => p.id === pinnedEndpointId) ? pinnedEndpointId : null,
    activeName: activeTextEndpointPresetName,
    presets: routableEndpoints,
    onChange: (id: string | null) => setPromptEndpoint(activeKind, id),
    // Probed only while pinned — an unpinned prompt uses the active endpoint, which the setup gate covers.
    target: {
      url: promptTarget.url,
      apiToken: promptTarget.apiToken,
      model: promptTarget.model,
      enabled: promptTarget.presetId !== null,
    },
  };
  const samplerControls: SamplerControlProps[] = [
    {
      id: 'customTemp',
      label: SETTINGS_COPY.customTemperature.label,
      hint: SETTINGS_COPY.customTemperature.description,
      min: 0, max: 2, step: 0.05,
      custom: activeSamplers?.temperature?.custom ?? false,
      value: activeSamplers?.temperature?.value ?? defaultPromptSampler(activeKind, 'temperature', genTemperature, promptLocalEngine) ?? genTemperature,
      defaultValue: defaultPromptSampler(activeKind, 'temperature', genTemperature, promptLocalEngine),
      onCustomChange: (c) => setPromptSamplerCustom(activeKind, 'temperature', c),
      onValueChange: (v) => setPromptSamplerValue(activeKind, 'temperature', v),
    },
    {
      id: 'customRepPen',
      label: SETTINGS_COPY.customRepetitionPenalty.label,
      hint: SETTINGS_COPY.customRepetitionPenalty.description,
      min: 1, max: 1.5, step: 0.02,
      custom: activeSamplers?.repetitionPenalty?.custom ?? false,
      value: activeSamplers?.repetitionPenalty?.value ?? defaultPromptSampler(activeKind, 'repetitionPenalty', genRepetitionPenalty, promptLocalEngine) ?? genRepetitionPenalty,
      defaultValue: defaultPromptSampler(activeKind, 'repetitionPenalty', genRepetitionPenalty, promptLocalEngine),
      onCustomChange: (c) => setPromptSamplerCustom(activeKind, 'repetitionPenalty', c),
      onValueChange: (v) => setPromptSamplerValue(activeKind, 'repetitionPenalty', v),
    },
  ];
  // Per-prompt Native Reasoning override — only for the controllable prompts and only under Native mode
  // (guided modes force no reasoning, so an override there is meaningless). Engine-split: the local engine
  // caps the thought segment by a token budget; external endpoints take the coarse effort level. Exactly one
  // shows per engine (the other is inert there).
  // A probed-but-empty support list means the active endpoint rejects every reasoning_effort literal (even
  // `none`) — a conclusively non-reasoning model. `null`/undefined = not yet probed, so keep showing controls.
  const reasoningUnsupported = Array.isArray(promptReasoningEfforts) && promptReasoningEfforts.length === 0;
  const reasoningApplicable = thinkingMode === 'off' && REASONING_CONTROL_KINDS.includes(activeKind);
  const reasoningControl = reasoningApplicable && !promptLocalEngine && !reasoningUnsupported
    ? {
        value: promptReasoning[activeKind] ?? defaultPromptReasoning(activeKind),
        options: reasoningPromptTabs(promptReasoningEfforts),
        set: (v: PromptReasoning) => setPromptReasoning(activeKind, v),
      }
    : null;
  const reasoningBudgetControl = reasoningApplicable && promptLocalEngine
    ? {
        value: promptReasoningBudget[activeKind] ?? defaultReasoningBudgetPct(activeKind),
        set: (v: number) => setPromptReasoningBudget(activeKind, v),
      }
    : null;

  // Only meaningful in Simple mode, where the settings it reports on are the ones out of sight. Most hidden
  // rows sit behind a switch Simple still shows (Thinking, the image Provider), so Advanced can always reach
  // them. Native Reasoning is the exception: an endpoint that rejects every effort level has no such row to
  // reach, so a stored level there is left out rather than promising one.
  const hasHiddenValues = !advanced && settingsUseAdvancedValues({
    paragraphLimit, markdownOutput, limitActiveCharacters, activeCharacterLimit,
    ...(reasoningUnsupported ? {} : { reasoningEffort }),
    memoryDigests, semanticMemory, semanticBandCap, semanticRehydration, timeContext, aiClock,
    semanticLore, describeCharacters, characterDiaries, semanticDiaries,
    concurrentTurnRequests, showReasoning, showSilentRequests, maxTokens,
    imagePortraitWidth, imagePortraitHeight, imageLandscapeWidth, imageLandscapeHeight,
    imageWorkflowCustom: imageWorkflow !== DEFAULT_COMFY_WORKFLOW,
    imageInvokeBoard, imageInvokeEncoder, imageInvokeVae,
    promptPresetCustom: !activePresetIsBuiltIn,
  });

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {/* Prompts get a wider dialog than the rest of Settings: they're the only tab holding a document
          rather than a list of controls, and the extra width is what lets the editor show edit and
          preview side by side instead of one at a time. */}
      <DialogContent
        aria-describedby={undefined}
        // One width for every tab, matching the Feedback hub — Prompts wanted a wider window only to fit
        // the side-by-side panes, and those now belong to full screen.
        className={cn(
          'flex flex-col overflow-hidden sm:max-w-[900px]',
          // Mobile has no room to spend on the frame around a settings panel — fill the screen.
          dialogFullHeightMobile,
          'max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0 sm:h-[90dvh]',
        )}
      >
        <DialogHeader className="flex-shrink-0">
          {/* The close cross is absolutely placed over this row, so the switch is kept clear of it. */}
          <div className="flex items-center gap-4 pr-8">
            <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Settings</DialogTitle>
            <TutorialPopover entry={tutorial} nav={tutorialNav}>
              <ToggleGroup
                type="single"
                value={mode}
                // Using the switch is itself the lesson, so it retires the tutorial as surely as the button does.
                onValueChange={(v) => { if (v) { dismissTutorial(); setMode(v as SettingsMode); } }}
                aria-label="Settings mode"
                className="ml-auto h-8"
              >
                <ToggleGroupItem value="simple" className="px-2 py-1">Simple</ToggleGroupItem>
                <ToggleGroupItem
                  value="advanced"
                  className="relative px-2 py-1"
                  // The marker rides the switch that acts on it: it says "there is more through here",
                  // which is exactly what this control does.
                  title={hasHiddenValues ? 'Some hidden settings are off their defaults. Switch to Advanced to see them.' : undefined}
                >
                  Advanced
                  {hasHiddenValues && (
                    <span
                      aria-label="Hidden settings are off their defaults"
                      className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary"
                    />
                  )}
                </ToggleGroupItem>
              </ToggleGroup>
            </TutorialPopover>
          </div>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
          {/* The tab labels don't fit narrow mobile, so below sm the tab strip becomes a dropdown of the
              active tab; sm+ keeps the full row. Both drive the same activeTab state. */}
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full flex-shrink-0 sm:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleTabs.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TabsList
            className={cn('hidden w-full flex-shrink-0 sm:grid', advanced ? 'grid-cols-5' : 'grid-cols-4')}
          >
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="presentation" className="px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6 py-4">
              <Section title="Appearance">
              <Row top {...copy('theme')}>
                <div>
                  <ToggleGroup
                    type="single"
                    value={theme}
                    // A single ToggleGroup clears its value when the active item is clicked again; a theme
                    // is always set, so an empty result is ignored rather than stored.
                    onValueChange={(v) => { if (v) setTheme(v as 'light' | 'dark' | 'system'); }}
                    className="grid w-full grid-cols-3"
                  >
                    {THEME_OPTIONS.map((o) => (
                      <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {/* Help texts stacked in one cell so switching options doesn't reflow the layout. */}
                  <div className="grid mt-2">
                    {THEME_OPTIONS.map((o) => (
                      <p
                        key={o.value}
                        className={`col-start-1 row-start-1 text-helper text-muted-foreground${o.value === theme ? '' : ' invisible'}`}
                      >
                        {o.help}
                      </p>
                    ))}
                  </div>
                </div>
              </Row>
              <Row center htmlFor="themeColor" {...copy('themeColor')}>
                <div className="flex items-center gap-3">
                  <Select value={themeColor} onValueChange={(v) => setThemeColor(v as ThemeColor)}>
                    <SelectTrigger id="themeColor" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THEME_COLORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ThemePreviewButton />
                </div>
              </Row>
              <Row center htmlFor="fontFamily" {...copy('font')}>
                <div className="flex items-center gap-3">
                  <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as FontChoice)}>
                    <SelectTrigger id="fontFamily" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} style={{ fontFamily: o.stack || undefined }}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Row>
              </Section>

              <Section title="Scene">
              <CheckRow
                htmlFor="bgmEnabled"
                checked={bgmEnabled}
                onChange={setBgmEnabled}
                {...copy('backgroundMusic')}
              />
              <CheckRow
                htmlFor="locationBackground"
                checked={locationBackground}
                onChange={setLocationBackground}
                {...copy('locationBackground')}
              />
              {locationBackground && (
                <SubGroup>
                <Row center {...copy('backgroundFade')}>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[backgroundOverlay]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={(v) => setBackgroundOverlay(v[0])}
                      className="max-w-[220px]"
                    />
                    <span className="text-meta text-muted-foreground tabular-nums w-9 shrink-0">
                      {Math.round(backgroundOverlay * 100)}%
                    </span>
                  </div>
                </Row>
                </SubGroup>
              )}
              </Section>

              <Section title="Narration">
              <Row center {...copy('narrationReveal')}>
                <RevealAnimationDemoButton />
              </Row>
              <Row top {...copy('aiLanguage')}>
                <TokenAutocomplete
                  single
                  openOnFocus
                  values={language ? [language] : []}
                  onChange={(vals) => setLanguage(vals[0] ?? '')}
                  options={COMMON_LANGUAGES}
                  placeholder="Language or style…"
                />
              </Row>
              {advanced && (
              <Row top {...copy('paragraphLimit')}>
                <div>
                  <ToggleGroup
                    type="single"
                    value={paragraphLimit}
                    // A single ToggleGroup clears its value when the active item is clicked again; the limit
                    // always has a setting, so an empty result is ignored rather than stored.
                    onValueChange={(v) => { if (v) setParagraphLimit(v as ParagraphLimit); }}
                    className="grid w-full grid-cols-3"
                  >
                    {PARAGRAPH_LIMIT_OPTIONS.map((o) => (
                      <ToggleGroupItem key={o.value} value={o.value}>{o.label}</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {/* All option texts stacked in one grid cell so the block is always as tall as the
                      longest — switching options shows the active one without reflowing the layout. */}
                  <div className="grid mt-2">
                    {PARAGRAPH_LIMIT_OPTIONS.map((o) => (
                      <p
                        key={o.value}
                        className={`col-start-1 row-start-1 text-helper text-muted-foreground${o.value === paragraphLimit ? '' : ' invisible'}`}
                      >
                        {o.help}
                      </p>
                    ))}
                  </div>
                </div>
              </Row>
              )}
              {advanced && (
              <CheckRow
                htmlFor="markdownOutput"
                checked={markdownOutput}
                onChange={setMarkdownOutput}
                {...copy('markdownFormatting')}
              />
              )}
              </Section>
            </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="generation" className="px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6 py-4">
              <Section title="Turn Extras" hint="Optional passes that run alongside each turn's narration.">
              {/* Enable/disable the optional per-turn requests. Synced with the System Prompts tab, which
                  shows a prompt's editor tab only while it's enabled here. */}
              <Row {...copy('systemPrompts')}>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <label htmlFor="choicesEnabled" className="flex items-center gap-2 text-label cursor-pointer">
                    <Checkbox
                      id="choicesEnabled"
                      checked={choicesEnabled}
                      onCheckedChange={(c) => setChoicesEnabled(c === true)}
                      className="shrink-0"
                    />
                    Choices
                  </label>
                  <label htmlFor="statUpdatesEnabled" className="flex items-center gap-2 text-label cursor-pointer">
                    <Checkbox
                      id="statUpdatesEnabled"
                      checked={statUpdatesEnabled}
                      onCheckedChange={(c) => setStatUpdatesEnabled(c === true)}
                      className="shrink-0"
                    />
                    Stat Updates
                  </label>
                  <label htmlFor="locationChangeEnabled" className="flex items-center gap-2 text-label cursor-pointer">
                    <Checkbox
                      id="locationChangeEnabled"
                      checked={locationChangeEnabled}
                      onCheckedChange={(c) => setLocationChangeEnabled(c === true)}
                      className="shrink-0"
                    />
                    Location Change
                  </label>
                </div>
              </Row>
              {/* Auto-apply detected location changes — its own row, only shown while Location Change is on. */}
              {locationChangeEnabled && (
                <SubGroup>
                <CheckRow
                  htmlFor="locationAutoApply"
                  checked={locationAutoApply}
                  onChange={setLocationAutoApply}
                  {...copy('moveAutomatically')}
                />
                </SubGroup>
              )}
              </Section>

              <Section title="Reasoning">
              <Row top {...copy('thinking')}>
                <div>
                  <OptionSwitcher value={thinkingMode} onChange={(v) => setThinkingMode(v as ThinkingMode)} options={THINKING_OPTIONS} />
                  {/* Stacked like Paragraph Limit so switching thinking modes doesn't reflow the layout. */}
                  <div className="grid mt-2">
                    {THINKING_OPTIONS.map((o) => (
                      <p
                        key={o.value}
                        className={`col-start-1 row-start-1 text-helper text-muted-foreground${o.value === thinkingMode ? '' : ' invisible'}`}
                      >
                        {o.help}
                      </p>
                    ))}
                  </div>
                </div>
              </Row>
              {/* Staged only: cap how many characters the director stages per turn (each is its own pass). Off =
                  unbounded. Feeds both the hard cap and the <ACTIVE CHARACTER GUIDANCE> chip in the director prompt. */}
              {advanced && thinkingMode === 'staged' && (
                <SubGroup>
                <Row top {...copy('limitActiveCharacters')}>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={limitActiveCharacters}
                      onCheckedChange={(v) => setLimitActiveCharacters(v === true)}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={activeCharacterLimit}
                      disabled={!limitActiveCharacters}
                      onChange={(e) => setActiveCharacterLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20"
                    />
                  </div>
                </Row>
                </SubGroup>
              )}
              {/* Native mode passes reasoning_effort straight through; shown only there since the guided modes drive
                  their own thinking. The levels are whichever the active endpoint accepts (detected on connect). */}
              {advanced && thinkingMode === 'off' && reasoningUnsupported && (
                <SubGroup>
                <Row top muted label={SETTINGS_COPY.nativeReasoning.label}>
                  <p className="pt-2 text-helper text-muted-foreground">This model doesn&apos;t support reasoning, so there&apos;s nothing to configure.</p>
                </Row>
                </SubGroup>
              )}
              {advanced && thinkingMode === 'off' && !reasoningUnsupported && (() => {
                const reasoningOptions = reasoningTabs(supportedReasoningEfforts);
                return (
                  <SubGroup>
                  <Row top {...copy('nativeReasoning')}>
                    <div>
                      <OptionSwitcher value={reasoningEffort} onChange={(v) => setReasoningEffort(v as ReasoningEffort)} options={reasoningOptions} />
                      <div className="grid mt-2">
                        {reasoningOptions.map((o) => (
                          <p
                            key={o.value}
                            className={`col-start-1 row-start-1 text-helper text-muted-foreground${o.value === reasoningEffort ? '' : ' invisible'}`}
                          >
                            {REASONING_EFFORT_HELP[o.value]}
                          </p>
                        ))}
                      </div>
                    </div>
                  </Row>
                  </SubGroup>
                );
              })()}
              </Section>

              {advanced && (<>
              <Section title="Memory" hint="What the AI carries forward from earlier turns.">
              <CheckRow
                htmlFor="memoryDigests"
                checked={memoryDigests}
                onChange={setMemoryDigests}
                {...copy('memorySummaries')}
              />
              {memoryDigests && (
                <SubGroup>
                <CheckRow
                  htmlFor="semanticMemory"
                  checked={semanticMemory}
                  onChange={handleSemanticMemoryToggle}
                  {...copy('semanticMemory')}
                />
                {semanticMemory && (
                  <SubGroup>
                  {/* Always-on top-K cap: derived checkbox (cap > 0), enabling seeds a sensible default. */}
                  <Row top {...copy('memoryCap')}>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={semanticBandCap > 0}
                        onCheckedChange={(v) => setSemanticBandCap(v === true ? 12 : 0)}
                      />
                      <Input
                        type="number"
                        min={3}
                        value={semanticBandCap > 0 ? semanticBandCap : 12}
                        disabled={semanticBandCap === 0}
                        onChange={(e) => setSemanticBandCap(Math.max(3, parseInt(e.target.value) || 3))}
                        className="w-20"
                      />
                    </div>
                  </Row>
                  <CheckRow
                    htmlFor="semanticRehydration"
                    checked={semanticRehydration}
                    onChange={setSemanticRehydration}
                    {...copy('sceneRecall')}
                  />
                  </SubGroup>
                )}
                <CheckRow
                  htmlFor="timeContext"
                  checked={timeContext}
                  onChange={setTimeContext}
                  {...copy('timeInMemory')}
                />
                <CheckRow
                  htmlFor="aiClock"
                  checked={aiClock}
                  onChange={setAiClock}
                  {...copy('measuredClock')}
                />
                </SubGroup>
              )}
              <CheckRow
                htmlFor="semanticLore"
                checked={semanticLore}
                onChange={handleSemanticLoreToggle}
                {...copy('semanticLore')}
              />
              {embedLoading && (
                <Row center>
                  <div className="flex items-center gap-2">
                    <Progress
                      className="h-2 flex-1"
                      value={embedProgress && embedProgress.total > 0 ? (embedProgress.loaded / embedProgress.total) * 100 : 0}
                    />
                    <span className="text-meta text-muted-foreground whitespace-nowrap">
                      {embedProgress && embedProgress.total > 0
                        ? `${Math.round(embedProgress.loaded / 1048576)} / ${Math.round(embedProgress.total / 1048576)} MB`
                        : 'Preparing…'}
                    </span>
                  </div>
                </Row>
              )}
              {embedError && !embedLoading && (semanticMemory || semanticLore) && (
                <Row center>
                  <div className="flex items-center gap-2">
                    <span className="text-helper text-destructive">Model download failed: {embedError}</span>
                    <Button variant="outline" size="sm" onClick={startEmbeddingDownload}>Retry</Button>
                  </div>
                </Row>
              )}
              {/* Descriptions work from the narration alone, so unlike diaries this is offered in every mode. */}
              <CheckRow
                htmlFor="describeCharacters"
                checked={describeCharacters}
                onChange={setDescribeCharacters}
                {...copy('describeNewCharacters')}
              />
              {/* Diaries are only read by the staged character pass, so the option only appears in that mode. */}
              {thinkingMode === 'staged' && (
                <>
                <CheckRow
                  htmlFor="characterDiaries"
                  checked={characterDiaries}
                  onChange={setCharacterDiaries}
                  {...copy('characterDiaries')}
                />
                {characterDiaries && semanticMemory && (
                  <SubGroup>
                  <CheckRow
                    htmlFor="semanticDiaries"
                    checked={semanticDiaries}
                    onChange={setSemanticDiaries}
                    {...copy('diaryRecall')}
                  />
                  </SubGroup>
                )}
                </>
              )}
              </Section>

              <Section title="Performance">
              <CheckRow
                htmlFor="concurrentTurnRequests"
                checked={concurrentTurnRequests}
                onChange={setConcurrentTurnRequests}
                {...copy('concurrentRequests')}
              />
              </Section>

              <Section title="Inspection" hint="Surfaces work that normally happens out of sight.">
              <CheckRow
                htmlFor="showReasoning"
                checked={showReasoning}
                onChange={setShowReasoning}
                {...copy('showReasoning')}
              />
              <CheckRow
                htmlFor="showSilentRequests"
                checked={showSilentRequests}
                onChange={setShowSilentRequests}
                {...copy('showSilentRequests')}
              />
              </Section>
              </>)}
            </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="endpoints" className="py-4 px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            <Tabs value={activeEndpointTab} onValueChange={setEndpointTab} className="flex flex-col flex-1 min-h-0">
              <TabsList className={`grid w-full flex-shrink-0 ${imageGenDisabled || !advanced ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <TabsTrigger value="text-endpoint">Text</TabsTrigger>
                <TabsTrigger value="img-endpoint">Image</TabsTrigger>
                {!imageGenDisabled && advanced && <TabsTrigger value="img-tagprompt">Tag Prompt</TabsTrigger>}
              </TabsList>
              <TabsContent value="text-endpoint" className="flex-1 min-h-0 data-[state=active]:flex flex-col">
              {/* Preset selector: swaps the whole endpoint field set. The read-only built-ins are the shared
                  endpoint ("Default") and, on desktop, the bundled engine — which is a preset rather than a
                  mode precisely so a single prompt can be routed to it while the rest go elsewhere. The
                  selector stays visible for every preset, including the engine, or there'd be no way back. */}
              <div className="flex items-center gap-2 flex-shrink-0 pt-4">
                <span className="text-helper text-muted-foreground">{SETTINGS_COPY.textPreset.label}</span>
                {!activeTextEndpointPresetIsBuiltIn && (
                  <ConfirmDialog
                    title="Delete Preset"
                    description={`Delete the "${activeTextEndpointPresetName}" preset? This can't be undone.`}
                    onConfirm={() => deleteTextEndpointPreset(activeTextEndpointPresetId)}
                  >
                    <Button variant="outline" size="sm">Delete</Button>
                  </ConfirmDialog>
                )}
                {!activeTextEndpointPresetIsBuiltIn && (
                  <ConfirmDialog
                    title="Reset Preset"
                    description={`Reset the "${activeTextEndpointPresetName}" preset to its default values? This can't be undone.`}
                    onConfirm={() => resetTextEndpointPreset(activeTextEndpointPresetId)}
                  >
                    <Button variant="outline" size="sm">Reset</Button>
                  </ConfirmDialog>
                )}
                <Select value={activeTextEndpointPresetId} onValueChange={handleTextPresetSelect}>
                  <SelectTrigger className="flex-1 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {builtinTextEndpointPresets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {textEndpointPresets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={TEXT_ADD_PRESET_SENTINEL}>Add New Preset…</SelectItem>
                  </SelectContent>
                </Select>
                {!activeTextEndpointPresetIsBuiltIn && (
                  <Button variant="outline" size="sm" onClick={() => setTextPresetDialog({ mode: 'rename' })}>Rename</Button>
                )}
              </div>
              <p className="flex-shrink-0 pt-1 text-helper text-muted-foreground">{SETTINGS_COPY.textPreset.description}</p>
              {/* The engine has no URL or token to edit — its runtime panel stands in for the field set. */}
              {localModelActive ? <LocalModelPanel /> : (
              <>
              <ScrollArea className="flex-1 min-h-0">
                <div className="grid gap-4 py-4">
              <Row center htmlFor="endpointUrl" {...copy('endpointUrl')}>
                <div className="grid gap-1">
                  <Input
                    id="endpointUrl"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    readOnly={activeTextEndpointPresetIsBuiltIn}
                    className={activeTextEndpointPresetIsBuiltIn ? 'opacity-60 cursor-not-allowed' : undefined}
                  />
                  {endpointUrlWasCompleted(endpointUrl) && (
                    <p className="text-helper text-muted-foreground">
                      Requests go to <span className="font-mono break-all">{normalizeEndpointUrl(endpointUrl)}</span>
                    </p>
                  )}
                </div>
              </Row>
              <Row>
                <button
                  type="button"
                  className="justify-self-start text-helper text-muted-foreground underline hover:text-foreground"
                  onClick={() => setConnectionGuideOpen(true)}
                >
                  {SETTINGS_BUTTONS.troubleConnecting}
                </button>
              </Row>
              <Row center htmlFor="apiToken" {...copy('apiToken')}>
                <Input
                  id="apiToken"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  readOnly={activeTextEndpointPresetIsBuiltIn}
                  className={activeTextEndpointPresetIsBuiltIn ? 'opacity-60 cursor-not-allowed' : undefined}
                />
              </Row>
              <Row center htmlFor="modelName" {...copy('modelName')}>
                <Input
                  id="modelName"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  readOnly={activeTextEndpointPresetIsBuiltIn}
                  className={activeTextEndpointPresetIsBuiltIn ? 'opacity-60 cursor-not-allowed' : undefined}
                />
              </Row>
              {advanced && (<>
              <Row center htmlFor="contextWindow" {...copy('contextWindow')}>
                <div className="flex items-start gap-2">
                  <Input
                    id="contextWindow"
                    type="number"
                    className={activeTextEndpointPresetIsBuiltIn ? 'flex-grow opacity-60 cursor-not-allowed' : 'flex-grow'}
                    value={contextWindow}
                    onChange={(e) => setContextWindowOverride(e.target.value === '' ? null : Number(e.target.value))}
                    readOnly={activeTextEndpointPresetIsBuiltIn}
                  />
                  <Button
                    variant="outline"
                    onClick={() => detectContextWindow(true)}
                    disabled={activeTextEndpointPresetIsBuiltIn || detectStatus === 'detecting'}
                  >
                    Detect
                  </Button>
                </div>
              </Row>
              <Row>
                <div className={contextStatus.red ? 'text-helper text-destructive' : 'text-helper text-muted-foreground'}>
                  {contextStatus.text}
                </div>
              </Row>
              <Row center htmlFor="maxTokens" {...copy('maxOutputTokens')}>
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(numInput(e.target.value, 1))}
                  readOnly={activeTextEndpointPresetIsBuiltIn}
                  className={activeTextEndpointPresetIsBuiltIn ? 'opacity-60 cursor-not-allowed' : undefined}
                />
              </Row>
              </>)}
              <div className="flex justify-start">
                <ConfirmDialog
                  {...SETTINGS_CONFIRMS.resetAiEndpoint}
                  onConfirm={handleResetEndpointSettings}
                >
                  <Button variant="outline" className="flex items-center gap-2" disabled={activeTextEndpointPresetIsBuiltIn}>
                    {SETTINGS_BUTTONS.resetAiEndpoint}
                  </Button>
                </ConfirmDialog>
              </div>
                </div>
              </ScrollArea>
              </>
            )}
            <PresetNameDialog
              open={textPresetDialog !== null}
              mode={textPresetDialog?.mode ?? 'add'}
              initialName={textPresetDialog?.mode === 'rename' ? activeTextEndpointPresetName : ''}
              onOpenChange={(o) => { if (!o) setTextPresetDialog(null); }}
              onSubmit={handleTextPresetNameSubmit}
            />
              </TabsContent>
              <TabsContent value="img-endpoint" className="pt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-3">
            {/* Preset selector: swaps the whole endpoint field set. Every preset (incl. Default) is editable. */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-helper text-muted-foreground">Preset</span>
              {imageEndpointPresets.length > 1 && (
                <ConfirmDialog
                  title="Delete Preset"
                  description={`Delete the "${activeImageEndpointPresetName}" preset? This can't be undone.`}
                  onConfirm={() => deleteImageEndpointPreset(activeImageEndpointPresetId)}
                >
                  <Button variant="outline" size="sm">Delete</Button>
                </ConfirmDialog>
              )}
              <ConfirmDialog
                title="Reset Preset"
                description={`Reset the "${activeImageEndpointPresetName}" preset to its default values? This can't be undone.`}
                onConfirm={() => resetImageEndpointPreset(activeImageEndpointPresetId)}
              >
                <Button variant="outline" size="sm">Reset</Button>
              </ConfirmDialog>
              <Select value={activeImageEndpointPresetId} onValueChange={handleImagePresetSelect}>
                <SelectTrigger className="flex-1 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {imageEndpointPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={IMG_ADD_PRESET_SENTINEL}>Add New Preset…</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setImagePresetDialog({ mode: 'rename' })}>Rename</Button>
            </div>
            {/* Global kill switch: hides every "Generate with AI" image button, and everything below it here.
                On the same row grid as Face Fix further down, so all three checkboxes share a label column. */}
            <div className="flex-shrink-0">
              <CheckRow
                htmlFor="imageGenEnabled"
                checked={!imageGenDisabled}
                onChange={(v) => setImageGenDisabled(!v)}
                {...copy('enableImageGeneration')}
              />
            </div>
            {!imageGenDisabled && (<>
            <div className="flex-shrink-0">
              <CheckRow
                htmlFor="sceneImageAuto"
                checked={sceneImageAuto}
                onChange={setSceneImageAuto}
                {...copy('sceneImages')}
              />
            </div>
            <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6">
              <Section title="Connection">
              <Row center htmlFor="imageProvider" {...copy('imageProvider')}>
                <Select value={imageProvider} onValueChange={(v) => setImageProvider(v as typeof imageProvider)}>
                  <SelectTrigger id="imageProvider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfyui">ComfyUI (local)</SelectItem>
                    <SelectItem value="invokeai">InvokeAI (local)</SelectItem>
                    <SelectItem value="a1111">Automatic1111 / Forge (local)</SelectItem>
                    <SelectItem value="openai" disabled={!desktop}>
                      OpenAI-compatible (cloud){desktop ? '' : ' — desktop app only'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row>
                <div>
                  <Button variant="outline" size="sm" onClick={() => setShowImageSetup(true)}>{SETTINGS_BUTTONS.howToSetUp}</Button>
                </div>
              </Row>
              <Row center htmlFor="imageEndpoint" {...copy('imageEndpointUrl')}>
                <Input
                  id="imageEndpoint"
                  value={imageEndpoint}
                  onChange={(e) => setImageEndpoint(e.target.value)}
                  placeholder={DEFAULT_ENDPOINT_BY_PROVIDER[imageProvider] || 'https://api.openai.com'}
                />
              </Row>
              <Row center htmlFor="imageApiToken" {...copy('imageApiToken')}>
                <Input id="imageApiToken" type="password" value={imageApiToken} onChange={(e) => setImageApiToken(e.target.value)} />
              </Row>
              <Row center htmlFor="imageModel" {...copy('imageModel')}>
                {imageProvider === 'comfyui' ? (
                  <TokenAutocomplete
                    single
                    openOnFocus
                    values={imageModel ? [imageModel] : []}
                    onChange={(v) => setImageModel(v[0] ?? '')}
                    options={comfyMeta?.checkpoints ?? []}
                    placeholder="(server default)"
                  />
                ) : imageProvider === 'invokeai' ? (
                  <div className="grid gap-1.5">
                    <TokenAutocomplete
                      single
                      openOnFocus
                      values={imageModel ? [imageModel] : []}
                      onChange={(v) => setImageModel(v[0] ?? '')}
                      options={(invokeMeta?.models ?? []).map((m) => m.name)}
                      placeholder="Pick an installed model"
                    />
                    {invokeMetaError && (
                      <p className="text-helper text-destructive">{invokeMetaError}</p>
                    )}
                  </div>
                ) : (
                  <Input id="imageModel" value={imageModel} onChange={(e) => setImageModel(e.target.value)} placeholder="(server default)" />
                )}
              </Row>
              </Section>

              <Section title="Image">
              <Row {...copy('promptPrefix')}>
                <TagField
                  value={imagePositivePrompt}
                  onChange={setImagePositivePrompt}
                  ariaLabel="Prompt Prefix"
                  placeholder="e.g. masterpiece, best quality"
                />
              </Row>
              <Row {...copy('negativePrompt')}>
                <TagField
                  value={imageNegativePrompt}
                  onChange={setImageNegativePrompt}
                  ariaLabel="Negative Prompt"
                  placeholder="tags to avoid…"
                />
              </Row>
              {advanced && (<>
              <Row center {...copy('portraitSize')}>
                <div className="flex items-center gap-2">
                  <Input aria-label="Portrait width" type="number" min={64} step={64} value={imagePortraitWidth} onChange={(e) => setImagePortraitWidth(numInput(e.target.value, 64))} className="w-28" />
                  <span className="text-muted-foreground">×</span>
                  <Input aria-label="Portrait height" type="number" min={64} step={64} value={imagePortraitHeight} onChange={(e) => setImagePortraitHeight(numInput(e.target.value, 64))} className="w-28" />
                </div>
              </Row>
              <Row center {...copy('landscapeSize')}>
                <div className="flex items-center gap-2">
                  <Input aria-label="Landscape width" type="number" min={64} step={64} value={imageLandscapeWidth} onChange={(e) => setImageLandscapeWidth(numInput(e.target.value, 64))} className="w-28" />
                  <span className="text-muted-foreground">×</span>
                  <Input aria-label="Landscape height" type="number" min={64} step={64} value={imageLandscapeHeight} onChange={(e) => setImageLandscapeHeight(numInput(e.target.value, 64))} className="w-28" />
                </div>
              </Row>
              </>)}
              <Row center {...copy('stepsCfg')}>
                <div className="flex items-center gap-2">
                  <Input aria-label="Steps" type="number" min={1} value={imageSteps} onChange={(e) => setImageSteps(numInput(e.target.value, 1))} className="w-28" />
                  <Input aria-label="CFG scale" type="number" min={0} step={0.5} value={imageCfg} onChange={(e) => setImageCfg(numInput(e.target.value, 0))} className="w-28" />
                </div>
              </Row>
              <Row center htmlFor="imageSampler" {...copy('imageSampler')}>
                {imageProvider === 'comfyui' ? (
                  <TokenAutocomplete
                    single
                    openOnFocus
                    values={imageSampler ? [imageSampler] : []}
                    onChange={(v) => setImageSampler(v[0] ?? '')}
                    options={comfyMeta?.samplers ?? []}
                    placeholder="euler"
                  />
                ) : (
                  <Input id="imageSampler" value={imageSampler} onChange={(e) => setImageSampler(e.target.value)} placeholder="Euler a" />
                )}
              </Row>
              {(imageProvider === 'a1111' || imageProvider === 'invokeai') && (
                <CheckRow
                  htmlFor="imageAdetailer"
                  checked={imageAdetailer}
                  onChange={setImageAdetailer}
                  {...copy('faceFix')}
                  // The description holds still across providers; only what it costs you differs.
                  info={<HintInfo>{imageProvider === 'a1111'
                    ? 'Fixes faces and hands. Requires the **ADetailer** extension installed on your A1111/Forge server.'
                    : 'Re-renders the face at full resolution. Roughly **doubles** generation time; SDXL and SD1.5 only.'}</HintInfo>}
                />
              )}
              {advanced && imageProvider === 'comfyui' && (
                <Row
                  htmlFor="imageWorkflow"
                  {...copy('imageWorkflow')}
                  info={<HintInfo>{`Tokens Formamorph fills in:

\`%prompt%\` \`%negative%\` \`%ckpt%\` \`%width%\` \`%height%\` \`%steps%\` \`%cfg%\` \`%seed%\` \`%sampler%\``}</HintInfo>}
                >
                  <div className="grid gap-1.5">
                    <Textarea
                      id="imageWorkflow"
                      value={imageWorkflow}
                      onChange={(e) => setImageWorkflow(e.target.value)}
                      spellCheck={false}
                      className="min-h-[200px] font-mono text-meta"
                    />
                    <div className="flex gap-2 justify-between">
                      <ConfirmDialog
                        {...SETTINGS_CONFIRMS.resetWorkflow}
                        onConfirm={() => setImageWorkflow(DEFAULT_COMFY_WORKFLOW)}
                      >
                        <Button variant="outline" size="sm" disabled={imageWorkflow === DEFAULT_COMFY_WORKFLOW}>
                          {SETTINGS_BUTTONS.resetToDefaults}
                        </Button>
                      </ConfirmDialog>
                      <Button variant="outline" size="sm" onClick={() => setShowComfyWorkflow(true)}>{SETTINGS_BUTTONS.howToGetThis}</Button>
                    </div>
                  </div>
                </Row>
              )}
              {advanced && imageProvider === 'invokeai' && (
                <Row htmlFor="imageInvokeBoard" {...copy('invokeBoard')}>
                  <Select
                    value={imageInvokeBoard || UNCATEGORIZED_BOARD}
                    onValueChange={(v) => setImageInvokeBoard(v === UNCATEGORIZED_BOARD ? '' : v)}
                  >
                    <SelectTrigger id="imageInvokeBoard"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNCATEGORIZED_BOARD}>Uncategorized</SelectItem>
                      {(invokeMeta?.boards ?? []).map((b) => (
                        <SelectItem key={b.board_id} value={b.board_id}>{b.board_name}</SelectItem>
                      ))}
                      {/* A board saved in this preset but missing from the server still needs an item, or
                          Radix would render an empty trigger. Only call it unknown once the list actually
                          arrived — while it's loading or unreachable, the board is probably fine. */}
                      {imageInvokeBoard && !(invokeMeta?.boards ?? []).some((b) => b.board_id === imageInvokeBoard) && (
                        <SelectItem value={imageInvokeBoard}>
                          {invokeMeta ? 'Unknown board (falls back to Uncategorized)' : 'Saved board (list unavailable)'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </Row>
              )}
              {/* Z-Image and Anima both load a Qwen3 encoder + VAE alongside the checkpoint; the options
                  are narrowed to the ones that architecture can actually use. */}
              {advanced && imageProvider === 'invokeai' && invokeSubmodelBase && (
                <>
                  <Row
                    htmlFor="imageInvokeEncoder"
                    {...copy('invokeEncoder')}
                    // Which encoder the base needs varies; that it needs one does not.
                    info={<HintInfo>{invokeSubmodelBase === 'anima'
                      ? 'Anima needs a **Qwen3 0.6B** text encoder. Leave blank to auto-pick.'
                      : 'Z-Image needs a **Qwen3 4B** text encoder. Leave blank to auto-pick.'}</HintInfo>}
                  >
                    <TokenAutocomplete
                      single
                      openOnFocus
                      values={imageInvokeEncoder ? [imageInvokeEncoder] : []}
                      onChange={(v) => setImageInvokeEncoder(v[0] ?? '')}
                      options={encodersFor(invokeMeta?.encoders ?? [], invokeSubmodelBase).map((m) => m.name)}
                      placeholder="(auto)"
                    />
                  </Row>
                  <Row
                    htmlFor="imageInvokeVae"
                    {...copy('invokeVae')}
                    label={invokeSubmodelBase === 'anima' ? 'Anima VAE' : 'Z-Image VAE'}
                    info={<HintInfo>{invokeSubmodelBase === 'anima'
                      ? 'Anima needs a **QwenImage/Wan 2.1** VAE — a FLUX VAE also works. Leave blank to auto-pick.'
                      : 'Z-Image needs a **FLUX-type** VAE, such as the FLUX.1-schnell VAE. Leave blank to auto-pick.'}</HintInfo>}
                  >
                    <TokenAutocomplete
                      single
                      openOnFocus
                      values={imageInvokeVae ? [imageInvokeVae] : []}
                      onChange={(v) => setImageInvokeVae(v[0] ?? '')}
                      options={vaesFor(invokeMeta?.vaes ?? [], invokeSubmodelBase).map((m) => m.name)}
                      placeholder="(auto)"
                    />
                  </Row>
                </>
              )}
              </Section>
            </div>
            </ScrollArea>
            </>)}
              </TabsContent>
              {!imageGenDisabled && advanced && (
              <TabsContent value="img-tagprompt" className="pt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-2">
                <p className="text-helper text-muted-foreground flex-shrink-0">
                  The prompt sent to your text model to turn a subject’s description into booru tags. The
                  <span className="mx-1 font-medium">Subject</span>chip expands per kind — character: “{SUBJECT_GUIDANCE.character}”; location: “{SUBJECT_GUIDANCE.location}”; world: “{SUBJECT_GUIDANCE.world}”.
                </p>
                <PromptField value={imageTagPrompt} onChange={setImageTagPrompt} variables={[SUBJECT]} />
                <div className="flex justify-start flex-shrink-0">
                  <ConfirmDialog
                    {...SETTINGS_CONFIRMS.resetTagPrompt}
                    onConfirm={() => setImageTagPrompt(DEFAULT_TAG_PROMPT)}
                  >
                    <Button variant="outline" size="sm" disabled={imageTagPrompt === DEFAULT_TAG_PROMPT}>
                      {SETTINGS_BUTTONS.resetToDefaults}
                    </Button>
                  </ConfirmDialog>
                </div>
              </TabsContent>
              )}
            </Tabs>
            <PresetNameDialog
              open={imagePresetDialog !== null}
              mode={imagePresetDialog?.mode ?? 'add'}
              initialName={imagePresetDialog?.mode === 'rename' ? activeImageEndpointPresetName : ''}
              onOpenChange={(o) => { if (!o) setImagePresetDialog(null); }}
              onSubmit={handleImagePresetNameSubmit}
            />
          </TabsContent>

          {advanced && (
          <TabsContent ref={promptsPanelRef} value="prompts" className="pt-4 px-2 pb-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-4">
            <PromptsShell fullscreen={promptsFullscreen} sourceRef={promptsPanelRef}>
            {/* Preset selector: the whole prompt set switches together. Built-in presets (Default, Simple)
                are read-only and differ only in section-header style. */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-helper text-muted-foreground">Preset</span>
              {!activePresetIsBuiltIn && (
                <ConfirmDialog
                  title="Delete Preset"
                  description={`Delete the "${activePresetName}" preset? This can't be undone.`}
                  onConfirm={() => deletePreset(activePresetId)}
                >
                  <Button variant="outline" size="sm">Delete</Button>
                </ConfirmDialog>
              )}
              {!activePresetIsBuiltIn && (
                <ConfirmDialog
                  title="Reset Preset"
                  description={`Reset every prompt in the "${activePresetName}" preset to its default value? This can't be undone.`}
                  onConfirm={() => resetPreset(activePresetId)}
                >
                  <Button variant="outline" size="sm">Reset</Button>
                </ConfirmDialog>
              )}
              <Select value={activePresetId} onValueChange={handlePresetSelect}>
                <SelectTrigger aria-label="Preset" className="flex-1 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {builtinPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  {promptPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={ADD_PRESET_SENTINEL}>Add New Preset…</SelectItem>
                  <SelectItem value={IMPORT_PRESET_SENTINEL}>Import Preset…</SelectItem>
                </SelectContent>
              </Select>
              {!activePresetIsBuiltIn && (
                <Button variant="outline" size="sm" onClick={() => setPresetDialog({ mode: 'rename' })}>Rename</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setExportShared(exportActivePreset(APP_VERSION))}>Export</Button>
            </div>
            {/* While a pinned world is open the selector edits that world's pin, not the global choice —
                say so, or picking a preset here looks like it silently did nothing to the rest of the app. */}
            {presetPinnedToWorld && (
              <p className="-mt-2 flex-shrink-0 text-helper text-muted-foreground">
                The world you&apos;re playing is pinned to this preset, so changing it here re-pins this world.
                Your usual preset is unaffected and comes back when you leave.
              </p>
            )}
            {/* Rail + panel. The rail replaces both the thirteen wrapped prompt tabs and the
                System/User/Messages/Options row: two rows of chrome the editor gets back, and a list that
                says what each prompt is for. `Tabs` still owns the panel switching — only its list is gone. */}
            <Tabs value={activePromptTab} onValueChange={selectPromptTab} className="w-full flex flex-1 min-h-0 gap-4 flex-col md:flex-row">
              {/* Narrow: one dropdown carrying prompt + surface, since a rail and an editor can't share
                  mobile width. Same collapse the top-level Settings tabs already do. */}
              <div className="md:hidden flex-shrink-0">
                {/* Prompt and surface entries live in one list but must not share a value string, or
                    Radix matches both and renders their labels concatenated. */}
                <Select
                  value={`surface:${promptView}`}
                  onValueChange={(v) => {
                    const [kind, id] = v.split(':');
                    if (kind === 'prompt') selectPromptTab(id);
                    else setPromptView(id as PromptSurface);
                  }}
                >
                  {/* Named outright rather than via SelectValue: the value tracks only the surface, and
                      the reader needs to see which prompt they're in. */}
                  <SelectTrigger>
                    <span className="truncate leading-normal">{selectedPrompt.label} &middot; {SURFACE_LABELS[promptView]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {railGroups.map((g) => (
                      <SelectGroup key={g.label}>
                        <SelectLabel>{g.label}</SelectLabel>
                        {g.tabs.map((t) => (
                          <SelectItem key={t} value={`prompt:${t}`}>{promptResets[t]?.label ?? t}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>{selectedPrompt.label}</SelectLabel>
                      {activeSurfaces.map((s) => (
                        <SelectItem key={s} value={`surface:${s}`}>{SURFACE_LABELS[s]}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="hidden md:block w-[190px] flex-shrink-0 border-r pr-2">
                <div className="flex flex-col gap-0.5 pb-2">
                  {railGroups.map((g) => (
                    <div key={g.label} className="flex flex-col gap-0.5">
                      {/* A divider, not an entry: styled like the items it heads, it invited clicks and
                          ignored them. The rule is what says "structure" without adding a control. */}
                      <div className="flex items-center gap-2 px-2 pb-1 pt-4 first:pt-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                          {g.label}
                        </span>
                        <span className="h-px flex-1 bg-border" aria-hidden />
                      </div>
                      {g.tabs.map((t) => {
                        const selected = t === activePromptTab;
                        return (
                          <div key={t} className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => selectPromptTab(t)}
                              aria-current={selected ? 'true' : undefined}
                              className={cn(
                                'rounded px-2 py-1 text-left text-label',
                                selected ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50',
                              )}
                            >
                              {promptResets[t]?.label ?? t}
                            </button>
                            {/* Only the open prompt lists its parts — expanding all of them would just be
                                the old flat wall of buttons with extra steps. */}
                            {selected && activeSurfaces.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setPromptView(s)}
                                aria-current={promptView === s ? 'true' : undefined}
                                className={cn(
                                  'ml-2 rounded px-2 py-0.5 text-left text-meta',
                                  promptView === s ? 'text-primary font-medium' : 'text-muted-foreground hover:bg-accent/50',
                                )}
                              >
                                {SURFACE_LABELS[s]}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex flex-1 min-w-0 min-h-0 flex-col gap-2">

              {/* What this prompt is for, above it rather than beneath: at the bottom of a full-height
                  editor it sat below the fold, which is the one place a description is no use. */}
              <p className="flex-shrink-0 text-helper text-muted-foreground">
                {PROMPT_DESCRIPTIONS[activePromptTab]}
              </p>

              {showingOptions && (
                <ScrollArea className="mt-4 flex-1 min-h-0">
                  <PromptOptionsPanel
                    endpoint={endpointControl}
                    verbatim={verbatimApplicable ? activeVerbatimEntry : null}
                    reasoning={reasoningControl}
                    reasoningBudget={reasoningBudgetControl}
                    samplers={samplerControls}
                    disabled={activePresetIsBuiltIn}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                  />
                </ScrollArea>
              )}

              {!showingOptions && (
              <>
              <TabsContent value="narration" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                {showingMessages ? (
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="flex flex-col gap-5 pr-3">
                      {messageFields.map((f) => (
                        <div key={f.key} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-label font-medium">
                              {f.label}
                              <HintInfo>{f.info}</HintInfo>
                            </span>
                            {!activePresetIsBuiltIn && (
                              <ConfirmDialog
                                title={`Reset ${f.label}`}
                                description={`Are you sure you want to reset the ${f.label} to its default value?`}
                                onConfirm={() => f.set(f.def)}
                              >
                                <Button variant="outline" size="sm" disabled={f.value === f.def}>Reset</Button>
                              </ConfirmDialog>
                            )}
                          </div>
                          <PromptField
                            value={f.value}
                            onChange={f.set}
                            variables={f.variables ?? []}
                            previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                            readOnly={activePresetIsBuiltIn}
                          />
                          <p className="text-helper text-muted-foreground">{f.description}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <PromptField
                    value={showingUser ? narrationUserPrompt : systemPrompt}
                    onChange={showingUser ? setNarrationUserPrompt : setSystemPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.narration ?? []) : PROMPT_KIND_VARIABLES.narration}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                )}
              </TabsContent>

              {thinkingMode === 'precall' && (
                <TabsContent value="thinking" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <PromptField
                    value={thinkingPrompt}
                    onChange={setThinkingPrompt}
                    variables={PROMPT_KIND_VARIABLES.thinking}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {choicesEnabled && (
                <TabsContent value="choices" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <PromptField
                    value={showingUser ? choicesUserPrompt : choicesPrompt}
                    onChange={showingUser ? setChoicesUserPrompt : setChoicesPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.choices ?? []) : PROMPT_KIND_VARIABLES.choices}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {statUpdatesEnabled && (
                <TabsContent value="statupdates" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col">
                  <PromptField
                    value={showingUser ? statUpdatesUserPrompt : statUpdatesPrompt}
                    onChange={showingUser ? setStatUpdatesUserPrompt : setStatUpdatesPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.statupdates ?? []) : PROMPT_KIND_VARIABLES.statupdates}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {locationChangeEnabled && (
                <TabsContent value="location" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? locationChangeUserPrompt : locationChangePromptText}
                    onChange={showingUser ? setLocationChangeUserPrompt : setLocationChangePromptText}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.location ?? []) : PROMPT_KIND_VARIABLES.location}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {memoryDigests && (
                <TabsContent value="summary" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? summaryUserPrompt : summaryPrompt}
                    onChange={showingUser ? setSummaryUserPrompt : setSummaryPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.summary ?? []) : PROMPT_KIND_VARIABLES.summary}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {aiClock && (
                <TabsContent value="timepassed" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? timePassedUserPrompt : timePassedPrompt}
                    onChange={showingUser ? setTimePassedUserPrompt : setTimePassedPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.timepassed ?? []) : PROMPT_KIND_VARIABLES.timepassed}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {aiClock && (
                <TabsContent value="timeopening" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? openingTimeUserPrompt : openingTimePrompt}
                    onChange={showingUser ? setOpeningTimeUserPrompt : setOpeningTimePrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.timeopening ?? []) : PROMPT_KIND_VARIABLES.timeopening}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {!imageGenDisabled && (
                <TabsContent value="scenetags" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? sceneTagsUserPrompt : sceneTagsPrompt}
                    onChange={showingUser ? setSceneTagsUserPrompt : setSceneTagsPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.scenetags ?? []) : PROMPT_KIND_VARIABLES.scenetags}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {characterDiaries && (
                <TabsContent value="diary" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={diaryPrompt}
                    onChange={setDiaryPrompt}
                    variables={PROMPT_KIND_VARIABLES.diary}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {thinkingMode === 'staged' && (
                <TabsContent value="director" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={showingUser ? directorUserPrompt : directorPrompt}
                    onChange={showingUser ? setDirectorUserPrompt : setDirectorPrompt}
                    variables={showingUser ? (PROMPT_KIND_USER_VARIABLES.director ?? []) : PROMPT_KIND_VARIABLES.director}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {thinkingMode === 'staged' && (
                <TabsContent value="character" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={characterPrompt}
                    onChange={setCharacterPrompt}
                    variables={PROMPT_KIND_VARIABLES.character}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}

              {thinkingMode === 'staged' && (
                <TabsContent value="storyboard" className="mt-4 flex-1 min-h-0 data-[state=active]:flex flex-col gap-1">
                  <PromptField
                    value={storyboardPrompt}
                    onChange={setStoryboardPrompt}
                    variables={PROMPT_KIND_VARIABLES.storyboard}
                    previewValues={effectivePreviewValues}
                    sampleData={usingSampleValues}
                    readOnlyReason={readOnlyReason}
                    onRequestEdit={duplicateForEditing}
                    fullscreen={promptsFullscreen}
                    onRequestFullscreen={() => setPromptsFullscreen((f) => !f)}
                    readOnly={activePresetIsBuiltIn}
                  />
                </TabsContent>
              )}
              </>
              )}
              </div>
            </Tabs>

            {/* Reset targets the on-screen template; hidden on the Options sub-tab (edits no template)
                and the Messages view (per-field resets). */}
            <div className="flex flex-wrap justify-end items-center gap-2 flex-shrink-0">
              {!activePresetIsBuiltIn && !showingOptions && !showingMessages && (
                <ConfirmDialog
                  title={`Reset ${resetTarget.label}`}
                  description={`Are you sure you want to reset the ${resetTarget.label} to its default value?`}
                  onConfirm={resetTarget.reset}
                >
                  <Button variant="outline" className="flex items-center gap-2">
                    Reset {resetTarget.label}
                  </Button>
                </ConfirmDialog>
              )}
            </div>
            <PresetNameDialog
              open={presetDialog !== null}
              mode={presetDialog?.mode ?? 'add'}
              initialName={presetDialog?.mode === 'rename' ? activePresetName : ''}
              onOpenChange={(o) => { if (!o) setPresetDialog(null); }}
              onSubmit={handlePresetNameSubmit}
            />
            <ExportPresetDialog
              open={exportShared !== null}
              onOpenChange={(o) => { if (!o) setExportShared(null); }}
              shared={exportShared}
            />
            <ImportPresetDialog
              open={importOpen}
              onOpenChange={setImportOpen}
              currentAppVersion={APP_VERSION}
              existingUserNames={promptPresets}
              onImport={(imported, opts) => { const id = importPreset(imported, opts); selectPreset(id); }}
            />
            </PromptsShell>
          </TabsContent>
          )}

          <TabsContent value="accessibility" className="px-2 flex-1 min-h-0 data-[state=active]:flex flex-col">
            <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6 py-4">
              <Section title="Reading" hint="Applies to the story text only, not the rest of the app.">
              <Row top htmlFor="narrationFont" {...copy('narrationFont')}>
                <Select value={narrationFont} onValueChange={(v) => setNarrationFont(v as NarrationFont)}>
                  <SelectTrigger id="narrationFont" className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NARRATION_FONT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} style={{ fontFamily: o.stack || undefined }}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row center {...copy('narrationTextSize')}>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[narrationScale]}
                    min={0.85}
                    max={1.6}
                    step={0.05}
                    onValueChange={(v) => setNarrationScale(v[0])}
                    className="max-w-[220px]"
                  />
                  <span className="text-meta text-muted-foreground tabular-nums w-10 shrink-0">
                    {Math.round(narrationScale * 100)}%
                  </span>
                </div>
              </Row>
              <Row center {...copy('lineSpacing')}>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[narrationLineHeight]}
                    min={1.2}
                    max={2.2}
                    step={0.05}
                    onValueChange={(v) => setNarrationLineHeight(v[0])}
                    className="max-w-[220px]"
                  />
                  <span className="text-meta text-muted-foreground tabular-nums w-10 shrink-0">
                    {narrationLineHeight.toFixed(2)}
                  </span>
                </div>
              </Row>
              <Row>
                <div>
                  <ConfirmDialog
                    {...SETTINGS_CONFIRMS.resetSizeSpacing}
                    onConfirm={() => { setNarrationScale(DEFAULT_NARRATION_SCALE); setNarrationLineHeight(DEFAULT_NARRATION_LINE_HEIGHT); }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={narrationScale === DEFAULT_NARRATION_SCALE && narrationLineHeight === DEFAULT_NARRATION_LINE_HEIGHT}
                    >
                      {SETTINGS_BUTTONS.resetSizeSpacing}
                    </Button>
                  </ConfirmDialog>
                </div>
              </Row>
              </Section>

              <Section title="Choices">
              <Row center {...copy('continueTheStory')}>
                <OptionSwitcher
                  value={continueChoiceMode}
                  onChange={(v) => setContinueChoiceMode(v as ContinueChoiceMode)}
                  options={CONTINUE_CHOICE_MODES}
                />
              </Row>
              </Section>

              <Section title="Saves & Worlds">
              <CheckRow
                htmlFor="autosaveEnabled"
                checked={autosaveEnabled}
                onChange={setAutosaveEnabled}
                {...copy('autosave')}
              />
              {advanced && (<>
              <Row>
                <div>
                  <ConfirmDialog
                    {...SETTINGS_CONFIRMS.restoreDefaultWorlds}
                    onConfirm={restoreDefaultWorlds}
                  >
                    <Button variant="outline" size="sm" disabled={deletedDefaultCount === 0}>
                      {SETTINGS_BUTTONS.restoreDefaultWorlds}
                    </Button>
                  </ConfirmDialog>
                  <p className="text-helper text-muted-foreground mt-1">
                    {deletedDefaultCount === 0
                      ? "You haven't deleted any of the bundled worlds."
                      : `Re-creates ${deletedDefaultCount} deleted bundled world${deletedDefaultCount > 1 ? 's' : ''} at their latest version.`}
                  </p>
                </div>
              </Row>
              <Row>
                <div>
                  <ConfirmDialog
                    {...SETTINGS_CONFIRMS.clearCachedImages}
                    onConfirm={clearImageCache}
                  >
                    <Button variant="outline" size="sm" disabled={cachedBytes === 0}>
                      {SETTINGS_BUTTONS.clearCachedImages}
                    </Button>
                  </ConfirmDialog>
                  <p className="text-helper text-muted-foreground mt-1">
                    {cachedBytes === 0
                      ? 'No linked images have been cached yet.'
                      : `${formatBytes(cachedBytes)} of linked images kept on this device so they work offline.`}
                  </p>
                </div>
              </Row>
              </>)}
              </Section>

              {/* Housekeeping actions rather than settings, and every one of them is a "put it back" a
                  normal player never needs — so Simple keeps the whole section out of the way. */}
              {advanced && (
              <Section title="Help">
              <Row>
                <div>
                  <ConfirmDialog
                    {...SETTINGS_CONFIRMS.resetTutorials}
                    onConfirm={resetTutorials}
                  >
                    <Button variant="outline" size="sm" disabled={seenTutorialCount === 0}>
                      {SETTINGS_BUTTONS.resetTutorials}
                    </Button>
                  </ConfirmDialog>
                  <p className="text-helper text-muted-foreground mt-1">
                    {seenTutorialCount === 0
                      ? 'No tutorials have been dismissed yet.'
                      : `Brings back ${seenTutorialCount} dismissed tutorial${seenTutorialCount > 1 ? 's' : ''}.`}
                  </p>
                </div>
              </Row>
              </Section>
              )}
            </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <ImageSetupGuide provider={imageProvider} open={showImageSetup} onOpenChange={setShowImageSetup} />
    <ComfyWorkflowGuide open={showComfyWorkflow} onOpenChange={setShowComfyWorkflow} />
    <LlmSetupGuide
      open={connectionGuideOpen}
      onOpenChange={setConnectionGuideOpen}
      endpointUrl={endpointUrl}
    />
    </>
  );
};
