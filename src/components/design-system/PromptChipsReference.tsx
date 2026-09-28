import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckRow } from '@/components/SettingsRows';
import PromptField from '@/components/prompt/PromptField';
import { PROMPT_KIND_VARIABLES } from '@/lib/promptVariables';
import PlaceholderPaletteBar from '@/components/prompt/PlaceholderPaletteBar';
import PlaceholderField from '@/components/prompt/PlaceholderField';
import { ChipInsertTargetProvider } from '@/components/prompt/ChipInsertTarget';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { placeholderOwners } from '@/lib/placeholderHomes';
import type { Entity, Placeholder, PlaceholderGroup } from '@/types';

const SAMPLE = '<TRAITS DESCRIPTION|markdown|header="traits">'
  + '<PERSONA|markdown|header="player character">'
  + '<LOCATION|markdown|header="current location">'
  + '<NOTES|format=xml|header="player notes">';

const PLACEHOLDERS: Placeholder[] = [{ id: 'reference-town', name: 'Town', values: [
  { id: 'reference-harrow', text: 'Harrow' }, { id: 'reference-merrow', text: 'Merrow' },
] }];

// The panel's owner, so its own field offers Character Name and previews it as this name.
const OWNER = { id: 'reference-oren', name: 'Oren' } as Entity;

export function PromptChipsReference() {
  const [value, setValue] = useState(SAMPLE);
  const [present, setPresent] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [description, setDescription] = useState('The road leads to the river.');
  const [notes, setNotes] = useState('');
  const [entityDescription, setEntityDescription] = useState('{{char}} keeps the lamp lit.');
  const [placeholders, setPlaceholders] = useState(PLACEHOLDERS);
  const store = useMemo(() => {
    const lists = { placeholders, placeholderGroups: [], dictionaries: [], entities: [OWNER] };
    return { ...placeholderStore(placeholders, setPlaceholders), lists, owners: placeholderOwners(lists) };
  }, [placeholders]);
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
        <PlaceholderStoreProvider value={store}>
        <EditorPreviewRollsProvider>
          <ChipInsertTargetProvider>
            <PlaceholderPaletteBar placeholders={placeholders} scopeId={OWNER.id} />
            <PlaceholderField value={entityDescription} onChange={setEntityDescription} placeholders={placeholders}
              ownerId={OWNER.id} ownerName={OWNER.name} readOnly={readOnly} label="Entity Description" ariaLabel="Entity Description" />
            <PlaceholderField value={description} onChange={setDescription} placeholders={placeholders}
              readOnly={readOnly} label="Description" ariaLabel="Description" />
            <PlaceholderField value={notes} onChange={setNotes} placeholders={placeholders}
              readOnly={readOnly} label="Notes" ariaLabel="Notes" />
          </ChipInsertTargetProvider>
        </EditorPreviewRollsProvider>
        </PlaceholderStoreProvider>
      </CardContent>
    </Card>
    <BlueprintChipsReference readOnly={readOnly} />
    </>
  );
}

// A world with one blueprint: Garb, in the Blueprints group, beside the world placeholder Town.
const BLUEPRINTS_GROUP: PlaceholderGroup = { id: 'reference-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' };
const BLUEPRINT_PLACEHOLDERS: Placeholder[] = [
  ...PLACEHOLDERS,
  { id: 'reference-garb', name: 'Garb', groupId: BLUEPRINTS_GROUP.id, values: [
    { id: 'reference-tabard', text: 'a tabard' }, { id: 'reference-robe', text: 'a robe' },
  ] },
];

/** A blueprint chip carries the link glyph. A world trait's text takes one; an entity's field refuses it. */
function BlueprintChipsReference({ readOnly }: { readOnly: boolean }) {
  const [trait, setTrait] = useState('Sworn in {{ph:reference-garb:world:reference-p1}} at {{ph:reference-town:world:reference-p2}}.');
  const [entity, setEntity] = useState('');
  const [placeholders, setPlaceholders] = useState(BLUEPRINT_PLACEHOLDERS);
  const store = useMemo(() => {
    const lists = { placeholders, placeholderGroups: [BLUEPRINTS_GROUP], dictionaries: [], entities: [OWNER] };
    return { ...placeholderStore(placeholders, setPlaceholders), lists, owners: placeholderOwners(lists) };
  }, [placeholders]);
  const worldTrait = useMemo(() => ({ owned: false }), []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-heading">Blueprint Chips</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <PlaceholderStoreProvider value={store}>
        <EditorPreviewRollsProvider>
          <ChipInsertTargetProvider>
            <PlaceholderPaletteBar placeholders={placeholders} />
            <PlaceholderField value={trait} onChange={setTrait} placeholders={placeholders} trait={worldTrait}
              readOnly={readOnly} label="Trait Description" ariaLabel="Trait Description" />
            <PlaceholderField value={entity} onChange={setEntity} placeholders={placeholders}
              ownerId={OWNER.id} ownerName={OWNER.name} readOnly={readOnly} label="Entity Description" ariaLabel="Blueprint Entity Description" />
          </ChipInsertTargetProvider>
        </EditorPreviewRollsProvider>
        </PlaceholderStoreProvider>
      </CardContent>
    </Card>
  );
}
