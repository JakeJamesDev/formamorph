import { useId, useState } from 'react';
import { BreadcrumbPicker, type BreadcrumbPickerSection } from '@/components/ui/breadcrumb-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hint, SectionTitle } from '@/components/ui/typography';

const row = (key: string, name: string, breadcrumb?: string[], disabled?: boolean) => ({ key, value: name, name, breadcrumb, disabled });

const TRAIT_SECTIONS: BreadcrumbPickerSection<string>[] = [{
  rows: [
    row('storm', 'Storm Touched by the Long Winter of the Northern Reach and Its Quiet Aftermath', ['Lineage', 'Bloodlines of the Northern Reach', 'Storms']),
    row('owl', 'Night Owl', ['Habits']),
    row('steady', 'Steady', ['World']),
    row('cold', 'Cold Sleeper', ['Habits', 'Rest']),
  ],
}];

// Persona rows share a name under different keys.
const PERSONA_SECTIONS: BreadcrumbPickerSection<string>[] = [{
  rows: [
    row('rook-scarred', 'Scarred', ['Rook']),
    row('rook-wary', 'Wary', ['Rook', 'Habits']),
    row('mira-scarred', 'Scarred', ['Mira Vance']),
    row('mira-wounded', 'Wounded', ['Mira Vance', 'Injuries', 'Old']),
  ],
}];

const STAT_SECTIONS: BreadcrumbPickerSection<string>[] = [{
  rows: [row('focus', 'Focus'), row('warmth', 'Warmth'), row('fatigue', 'Fatigue')],
}];

const DISABLED_SECTIONS: BreadcrumbPickerSection<string>[] = [{
  rows: [row('focus', 'Focus'), row('warmth', 'Warmth'), row('fatigue', 'Fatigue', undefined, true)],
}];

const NO_SECTIONS: BreadcrumbPickerSection<string>[] = [{ rows: [] }];

/** One labeled picker bound to local state. */
function PickerSample({ title, note, sections, initial, placeholder, disabled }: {
  title: string;
  note: string;
  sections: BreadcrumbPickerSection<string>[];
  initial?: string;
  placeholder: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const labelId = useId();
  return (
    <section aria-labelledby={labelId} className="min-w-0 space-y-2 rounded-md border p-3">
      <SectionTitle id={labelId}>{title}</SectionTitle>
      <Hint>{note}</Hint>
      <BreadcrumbPicker
        sections={sections}
        value={value}
        onPick={setValue}
        placeholder={placeholder}
        searchPlaceholder="Search…"
        ariaLabelledBy={labelId}
        disabled={disabled}
      />
    </section>
  );
}

export function BreadcrumbPickerReference() {
  return (
    <Card role="region" aria-labelledby="breadcrumb-picker-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="breadcrumb-picker-reference-title" className="text-heading">Breadcrumb Picker Reference</CardTitle>
        <CardDescription>Open a picker to see its rows, then type to search.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3 md:grid-cols-2">
        <PickerSample title="Default" note="A path of three or more segments collapses to its first and last. Point at a row to see the full path." sections={TRAIT_SECTIONS} placeholder="Pick a trait…" />
        <PickerSample title="Picked" note="Every row that holds the value shows a check. Scarred shows under both entities." sections={PERSONA_SECTIONS} initial="Scarred" placeholder="Pick a trait…" />
        <PickerSample title="No Breadcrumb" note="A list with no groups shows names only." sections={STAT_SECTIONS} placeholder="Pick a stat…" />
        <PickerSample title="Disabled Row" note="A disabled row stays visible and can't be picked." sections={DISABLED_SECTIONS} initial="Focus" placeholder="Pick a stat…" />
        <PickerSample title="Empty" note="An empty list shows Nothing to pick." sections={NO_SECTIONS} placeholder="Pick a trait…" />
        <PickerSample title="Unavailable" note="A disabled field doesn't open." sections={TRAIT_SECTIONS} placeholder="Pick a trait…" disabled />
        <PickerSample title="No Matches" note="Type zzz in the search field." sections={TRAIT_SECTIONS} placeholder="Pick a trait…" />
      </CardContent>
    </Card>
  );
}
