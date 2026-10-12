import { useState } from 'react';
import { ChipOptionsDialog } from '@/components/prompt/ChipOptionsDialog';
import { CheckRow } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta } from '@/components/ui/typography';
import { placeholderVocabulary, promptVocabulary, type ChipVocabulary } from '@/lib/chipVocabulary';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { SAMPLE_PREVIEW_VALUES } from '@/lib/previewValuePool';
import type { Placeholder } from '@/types';

const PROMPT_VOCABULARY = promptVocabulary([]);

const PLACEHOLDERS: Placeholder[] = [{ id: 'reference-town', name: 'Town', values: [
  { id: 'reference-harrow', text: 'Harrow' }, { id: 'reference-merrow', text: 'Merrow' },
] }];

interface Sample {
  id: string;
  title: string;
  note: string;
  token: string;
  vocab: ChipVocabulary;
}

/** One Chip Options sample per layout: two panes with a filter, two panes with one row of pieces, one column. */
const SAMPLES: readonly Sample[] = [
  {
    id: 'entities',
    title: 'Entities Chip',
    note: 'Two panes. Scope is a dropdown. Only With, Include and Stat Detail are rows of checkboxes.',
    token: '<ENTITIES|markdown|header="Entities">',
    vocab: PROMPT_VOCABULARY,
  },
  {
    id: 'stats',
    title: 'Stats Chip',
    note: 'Two panes. Stat Detail is the only row of checkboxes. The last piece on stays checked.',
    token: '<STATS DESCRIPTION|markdown>',
    vocab: PROMPT_VOCABULARY,
  },
  {
    id: 'placeholder',
    title: 'Placeholder Chip',
    note: 'One column. A placeholder chip has no What the AI Reads pane.',
    token: encodePlaceholderToken({ id: 'reference-town', mode: 'world', placementId: 'reference-place' }),
    vocab: placeholderVocabulary(PLACEHOLDERS),
  },
];

/** One sample row: its name, what it shows and a button that opens the production dialog on it. */
function SampleRow({ sample, editable }: { sample: Sample; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(sample.token);
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <p className="text-label font-medium">{sample.title}</p>
        <Meta>{sample.note}</Meta>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Open {sample.title}
      </Button>
      <ChipOptionsDialog
        open={open}
        onOpenChange={setOpen}
        token={token}
        vocab={sample.vocab}
        reads={sample.vocab.promptChip?.(token) ? SAMPLE_PREVIEW_VALUES : undefined}
        editable={editable}
        update={setToken}
      />
    </div>
  );
}

/** Chip Options: the production dialog on three sample chips. Picks change local state only. */
export function ChipOptionsReference() {
  const [editable, setEditable] = useState(true);
  return (
    <Card role="region" aria-labelledby="chip-options-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="chip-options-reference-title" className="text-heading">Chip Options Reference</CardTitle>
        <CardDescription>This reference opens the production dialog on three sample chips. Hover a control to light the text it adds.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CheckRow htmlFor="chip-options-reference-editable" label="Editable" hint="Clear it to open the dialog with every control disabled"
          checked={editable} onChange={setEditable} />
        <div className="grid min-w-0 gap-3">
          {SAMPLES.map((sample) => <SampleRow key={sample.id} sample={sample} editable={editable} />)}
        </div>
      </CardContent>
    </Card>
  );
}
