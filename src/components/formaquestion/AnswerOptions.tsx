import { useState } from 'react';
import { MaxOutputControl } from '@/components/modals/PromptOptionFields';
import { SamplerControl } from '@/components/modals/SamplerControl';
import { DEFAULT_HELP_SETTINGS, HELP_REPETITION_PENALTY_RANGE, HELP_TEMPERATURE_RANGE, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { PROMPTS_COPY } from './formaquestionSettingsTabs';

/**
 * The Options panel of the answer prompt: temperature, repetition penalty and Max Output. The values are device
 * settings, so they stay across help presets and the Default preset does not lock them. A field is Custom
 * while its value differs from the default; the box can be on at the default until the slider moves.
 */
export function AnswerOptions({ settings, onChange }: { settings: HelpSettings; onChange: (change: HelpSettingsChange) => void }) {
  const [on, setOn] = useState({
    temperature: settings.answerTemperature !== DEFAULT_HELP_SETTINGS.answerTemperature,
    repetitionPenalty: settings.answerRepetitionPenalty !== DEFAULT_HELP_SETTINGS.answerRepetitionPenalty,
    maxOutput: settings.answerMaxTokens !== DEFAULT_HELP_SETTINGS.answerMaxTokens,
  });
  const copy = PROMPTS_COPY.options;
  return (
    <section aria-label={copy.title} className="space-y-4" data-testid="help-answer-options">
      <div>
        <h3 className="text-label font-medium">{copy.title}</h3>
        <p className="text-helper text-muted-foreground">{copy.hint}</p>
      </div>
      <MaxOutputControl
        custom={on.maxOutput}
        value={settings.answerMaxTokens}
        shipped={DEFAULT_HELP_SETTINGS.answerMaxTokens}
        onCustomChange={(custom) => {
          setOn({ ...on, maxOutput: custom });
          if (!custom) onChange({ answerMaxTokens: DEFAULT_HELP_SETTINGS.answerMaxTokens });
        }}
        onValueChange={(answerMaxTokens) => onChange({ answerMaxTokens })}
      />
      <SamplerControl
        id="helpAnswerTemperature"
        label={copy.temperature.label}
        hint={copy.temperature.hint}
        {...HELP_TEMPERATURE_RANGE}
        custom={on.temperature}
        value={settings.answerTemperature}
        defaultValue={DEFAULT_HELP_SETTINGS.answerTemperature}
        onCustomChange={(custom) => {
          setOn({ ...on, temperature: custom });
          if (!custom) onChange({ answerTemperature: DEFAULT_HELP_SETTINGS.answerTemperature });
        }}
        onValueChange={(answerTemperature) => onChange({ answerTemperature })}
      />
      <SamplerControl
        id="helpAnswerRepetitionPenalty"
        label={copy.repetitionPenalty.label}
        hint={copy.repetitionPenalty.hint}
        {...HELP_REPETITION_PENALTY_RANGE}
        custom={on.repetitionPenalty}
        value={settings.answerRepetitionPenalty}
        defaultValue={DEFAULT_HELP_SETTINGS.answerRepetitionPenalty}
        onCustomChange={(custom) => {
          setOn({ ...on, repetitionPenalty: custom });
          if (!custom) onChange({ answerRepetitionPenalty: DEFAULT_HELP_SETTINGS.answerRepetitionPenalty });
        }}
        onValueChange={(answerRepetitionPenalty) => onChange({ answerRepetitionPenalty })}
      />
    </section>
  );
}
