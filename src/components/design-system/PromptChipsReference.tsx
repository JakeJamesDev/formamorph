import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckRow } from '@/components/SettingsRows';
import PromptField from '@/components/prompt/PromptField';
import { PROMPT_KIND_VARIABLES } from '@/lib/promptVariables';
import PlaceholderPaletteBar from '@/components/prompt/PlaceholderPaletteBar';
import PlaceholderField from '@/components/prompt/PlaceholderField';
import { ChipInsertTargetProvider } from '@/components/prompt/ChipInsertTarget';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import type { Placeholder } from '@/types';

const SAMPLE = '<TRAITS DESCRIPTION|markdown|header="traits">'
  + '<PERSONA|markdown|header="player character">'
  + '<LOCATION|markdown|header="current location">'
  + '<NOTES|format=xml|header="player notes">';

const PLACEHOLDERS: Placeholder[] = [{ id: 'reference-town', name: 'Town', values: [
  { id: 'reference-harrow', text: 'Harrow' }, { id: 'reference-merrow', text: 'Merrow' },
] }];

export function PromptChipsReference() {
  const [value, setValue] = useState(SAMPLE);
  const [present, setPresent] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [description, setDescription] = useState('The road leads to the river.');
  const [notes, setNotes] = useState('');
  return (
    <>
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
    <Card>
      <CardHeader><CardTitle className="text-heading">Placeholder Chips</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <EditorPreviewRollsProvider>
          <ChipInsertTargetProvider>
            <PlaceholderPaletteBar placeholders={PLACEHOLDERS} />
            <PlaceholderField value={description} onChange={setDescription} placeholders={PLACEHOLDERS}
              readOnly={readOnly} label="Description" ariaLabel="Description" />
            <PlaceholderField value={notes} onChange={setNotes} placeholders={PLACEHOLDERS}
              readOnly={readOnly} label="Notes" ariaLabel="Notes" />
          </ChipInsertTargetProvider>
        </EditorPreviewRollsProvider>
      </CardContent>
    </Card>
    </>
  );
}
