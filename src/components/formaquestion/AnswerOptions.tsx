import { useState } from 'react';
import { MaxOutputControl } from '@/components/modals/PromptOptionFields';
import { SamplerControl } from '@/components/modals/SamplerControl';
import { ReadOnlyNotice } from '@/components/prompt/ReadOnlyNotice';
import { DEFAULT_HELP_ANSWER_OPTIONS, HELP_REPETITION_PENALTY_RANGE, HELP_TEMPERATURE_RANGE, type HelpAnswerOptions } from '@/lib/formaquestion/helpPresets';
import { PROMPTS_COPY } from './formaquestionSettingsTabs';

/**
 * The Options panel of the answer prompt: temperature, repetition penalty and Max Output of the preset. The
 * Default preset shows them read-only, so each release updates them for every player on it. A field is Custom
 * while its value differs from the default; the box can be on at the default until the slider moves. Mount it
 * with a key per preset, since the boxes start from the stored values.
 */
export function AnswerOptions({ options, readOnly, readOnlyReason, onRequestEdit, onChange }: {
  options: HelpAnswerOptions;
  readOnly: boolean;
  readOnlyReason?: string;
  onRequestEdit?: () => void;
  onChange: (change: Partial<HelpAnswerOptions>) => void;
}) {
  const [on, setOn] = useState({
    temperature: options.temperature !== DEFAULT_HELP_ANSWER_OPTIONS.temperature,
    repetitionPenalty: options.repetitionPenalty !== DEFAULT_HELP_ANSWER_OPTIONS.repetitionPenalty,
    maxTokens: options.maxTokens !== DEFAULT_HELP_ANSWER_OPTIONS.maxTokens,
  });
  const copy = PROMPTS_COPY.options;
  const toggle = (key: keyof HelpAnswerOptions) => (custom: boolean) => {
    setOn({ ...on, [key]: custom });
    if (!custom) onChange({ [key]: DEFAULT_HELP_ANSWER_OPTIONS[key] });
  };
  return (
    <section aria-label={copy.title} className="space-y-4" data-testid="help-answer-options">
      {readOnly && readOnlyReason && <ReadOnlyNotice reason={readOnlyReason} onRequestEdit={onRequestEdit} />}
      <div>
        <h3 className="text-label font-medium">{copy.title}</h3>
        <p className="text-helper text-muted-foreground">{copy.hint}</p>
      </div>
      <MaxOutputControl
        custom={on.maxTokens}
        value={options.maxTokens}
        shipped={DEFAULT_HELP_ANSWER_OPTIONS.maxTokens}
        disabled={readOnly}
        onCustomChange={toggle('maxTokens')}
        onValueChange={(maxTokens) => onChange({ maxTokens })}
      />
      <SamplerControl
        id="helpAnswerTemperature"
        label={copy.temperature.label}
        hint={copy.temperature.hint}
        {...HELP_TEMPERATURE_RANGE}
        custom={on.temperature}
        value={options.temperature}
        defaultValue={DEFAULT_HELP_ANSWER_OPTIONS.temperature}
        disabled={readOnly}
        onCustomChange={toggle('temperature')}
        onValueChange={(temperature) => onChange({ temperature })}
      />
      <SamplerControl
        id="helpAnswerRepetitionPenalty"
        label={copy.repetitionPenalty.label}
        hint={copy.repetitionPenalty.hint}
        {...HELP_REPETITION_PENALTY_RANGE}
        custom={on.repetitionPenalty}
        value={options.repetitionPenalty}
        defaultValue={DEFAULT_HELP_ANSWER_OPTIONS.repetitionPenalty}
        disabled={readOnly}
        onCustomChange={toggle('repetitionPenalty')}
        onValueChange={(repetitionPenalty) => onChange({ repetitionPenalty })}
      />
    </section>
  );
}
