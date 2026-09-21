import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckRow } from '@/components/SettingsRows';
import PromptField from '@/components/prompt/PromptField';
import { defaultSystemPrompt } from '@/components/game/GamePrompts';
import { PROMPT_KIND_VARIABLES } from '@/lib/promptVariables';

const SAMPLE = defaultSystemPrompt.slice(
  defaultSystemPrompt.indexOf('## Traits'), defaultSystemPrompt.indexOf('## Sublocations'),
);

export function PromptChipsReference() {
  const [value, setValue] = useState(SAMPLE);
  const [present, setPresent] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  return (
    <Card>
      <CardHeader><CardTitle className="text-heading">Conditional Prompt Text</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <CheckRow htmlFor="reference-persona-present" label="Persona Present" hint="Includes the sample persona in Preview" checked={present} onChange={setPresent} />
        <CheckRow htmlFor="reference-prompt-readonly" label="Read-Only" hint="Disables changes to the sample prompt" checked={readOnly} onChange={setReadOnly} />
        <PromptField
          value={value}
          onChange={setValue}
          variables={PROMPT_KIND_VARIABLES.narration}
          previewValues={{
            '<TRAITS DESCRIPTION|markdown>': 'Observant',
            '<PERSONA|markdown>': present ? 'Mira, a traveling cartographer' : 'N/A',
            '<NOTES>': 'Find the missing keeper',
            '<LOCATION|markdown>': 'The old observatory',
          }}
          readOnly={readOnly}
          label="System Prompt"
          ariaLabel="System Prompt"
          className="h-[24rem] max-h-[65dvh]"
        />
      </CardContent>
    </Card>
  );
}
