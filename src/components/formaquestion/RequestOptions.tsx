import { useState } from 'react';
import { Minimize2 } from 'lucide-react';
import { MaxOutputControl } from '@/components/modals/PromptOptionFields';
import { SamplerControl } from '@/components/modals/SamplerControl';
import { ReadOnlyNotice } from '@/components/prompt/ReadOnlyNotice';
import { Tip } from '@/components/ui/tooltip';
import { DEFAULT_HELP_OPTIONS, HELP_REPETITION_PENALTY_RANGE, HELP_TEMPERATURE_RANGE, type HelpRequestOptions } from '@/lib/formaquestion/helpPresets';
import type { HelpRequestKey } from '@/lib/formaquestion/helpPrompt';
import { PROMPTS_COPY } from './formaquestionSettingsTabs';

/**
 * The Options panel of one prompt: temperature, repetition penalty and Max Output of that prompt's request in
 * the preset. The Default preset shows them read-only, so each release updates them for every player on it. A
 * field is Custom while its value differs from the Default's; the box can be on at the default until the slider
 * moves. Mount it with a key per preset and prompt, since the boxes start from the stored values.
 */
export function RequestOptions({ prompt, options, readOnly, readOnlyReason, onRequestEdit, onExitFullscreen, onChange }: {
  prompt: HelpRequestKey;
  options: HelpRequestOptions;
  readOnly: boolean;
  readOnlyReason?: string;
  onRequestEdit?: () => void;
  /** Given while the tab is in full screen: the panel then shows the prompt field's exit toggle. */
  onExitFullscreen?: () => void;
  onChange: (change: Partial<HelpRequestOptions>) => void;
}) {
  const defaults = DEFAULT_HELP_OPTIONS[prompt];
  const [on, setOn] = useState({
    temperature: options.temperature !== defaults.temperature,
    repetitionPenalty: options.repetitionPenalty !== defaults.repetitionPenalty,
    maxTokens: options.maxTokens !== defaults.maxTokens,
  });
  const copy = PROMPTS_COPY.options;
  const hints = copy.prompts[prompt];
  const toggle = (key: keyof HelpRequestOptions) => (custom: boolean) => {
    setOn({ ...on, [key]: custom });
    if (!custom) onChange({ [key]: defaults[key] });
  };
  return (
    <section aria-label={`${PROMPTS_COPY.prompts[prompt].label} ${copy.title}`} className="space-y-4" data-testid={`help-${prompt}-options`}>
      {readOnly && readOnlyReason && <ReadOnlyNotice reason={readOnlyReason} onRequestEdit={onRequestEdit} />}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-label font-medium">{copy.title}</h3>
          <p className="text-helper text-muted-foreground">{hints.hint}</p>
        </div>
        {/* The prompt field's toggle, in the same corner, so the two read as one control. */}
        {onExitFullscreen && (
          <Tip tip="Exit full screen">
            <button type="button" aria-label="Exit full screen" onClick={onExitFullscreen} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
              <Minimize2 className="h-4 w-4" />
            </button>
          </Tip>
        )}
      </div>
      <MaxOutputControl
        custom={on.maxTokens}
        value={options.maxTokens}
        shipped={defaults.maxTokens}
        disabled={readOnly}
        onCustomChange={toggle('maxTokens')}
        onValueChange={(maxTokens) => onChange({ maxTokens })}
      />
      <SamplerControl
        id={`help-${prompt}-temperature`}
        label={copy.temperature}
        hint={hints.temperature}
        {...HELP_TEMPERATURE_RANGE}
        custom={on.temperature}
        value={options.temperature}
        defaultValue={defaults.temperature}
        disabled={readOnly}
        onCustomChange={toggle('temperature')}
        onValueChange={(temperature) => onChange({ temperature })}
      />
      <SamplerControl
        id={`help-${prompt}-repetition-penalty`}
        label={copy.repetitionPenalty}
        hint={hints.repetitionPenalty}
        {...HELP_REPETITION_PENALTY_RANGE}
        custom={on.repetitionPenalty}
        value={options.repetitionPenalty}
        defaultValue={defaults.repetitionPenalty}
        disabled={readOnly}
        onCustomChange={toggle('repetitionPenalty')}
        onValueChange={(repetitionPenalty) => onChange({ repetitionPenalty })}
      />
    </section>
  );
}
