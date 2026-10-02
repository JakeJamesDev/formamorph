import { useState } from 'react';
import { BreadcrumbPicker, type BreadcrumbPickerSection } from '@/components/ui/breadcrumb-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hint, SectionTitle } from '@/components/ui/typography';

// Each row key is unique; two persona rows pick the same name, as Q3 of the spec shows.
const TRAIT_SECTIONS: BreadcrumbPickerSection<string>[] = [{
  rows: [
    { key: 'storm', value: 'Storm Touched by the Long Winter', name: 'Storm Touched by the Long Winter', breadcrumb: ['Lineage', 'Bloodlines of the Northern Reach', 'Storms'] },
    { key: 'owl', value: 'Night Owl', name: 'Night Owl', breadcrumb: ['Habits'] },
    { key: 'steady', value: 'Steady', name: 'Steady', breadcrumb: ['World'] },
    { key: 'cold', value: 'Cold Sleeper', name: 'Cold Sleeper', breadcrumb: ['Habits', 'Rest'] },
  ],
}];

const PERSONA_SECTIONS: BreadcrumbPickerSection<string>[] = [{
  rows: [
    { key: 'rook-scarred', value: 'Scarred', name: 'Scarred', breadcrumb: ['Rook'] },
    { key: 'rook-wary', value: 'Wary', name: 'Wary', breadcrumb: ['Rook', 'Habits'] },
    { key: 'mira-scarred', value: 'Scarred', name: 'Scarred', breadcrumb: ['Mira Vance'] },
    { key: 'mira-wounded', value: 'Wounded', name: 'Wounded', breadcrumb: ['Mira Vance', 'Injuries', 'Old'] },
  ],
}];

const STAT_SECTIONS: BreadcrumbPickerSection<string>[] = [{
  rows: [
    { key: 'focus', value: 'Focus', name: 'Focus' },
    { key: 'warmth', value: 'Warmth', name: 'Warmth' },
    { key: 'fatigue', value: 'Fatigue', name: 'Fatigue', disabled: true },
  ],
}];

const NO_SECTIONS: BreadcrumbPickerSection<string>[] = [{ rows: [] }];

/** One labeled picker bound to local state. */
function Sample({ title, note, sections, initial, placeholder, disabled }: {
  title: string;
  note: string;
  sections: BreadcrumbPickerSection<string>[];
  initial?: string;
  placeholder: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const labelId = `breadcrumb-picker-${title.toLowerCase().replace(/\W+/g, '-')}`;
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
        <Sample title="Default" note="Paths of any depth collapse to the first and last segment." sections={TRAIT_SECTIONS} placeholder="Pick a trait…" />
        <Sample title="Picked" note="Every row that holds the value shows a check. Scarred shows under both entities." sections={PERSONA_SECTIONS} initial="Scarred" placeholder="Pick a trait…" />
        <Sample title="No Breadcrumb" note="A list with no groups shows names only." sections={STAT_SECTIONS} placeholder="Pick a stat…" />
        <Sample title="Disabled Row" note="A disabled row stays visible and can't be picked." sections={STAT_SECTIONS} initial="Focus" placeholder="Pick a stat…" />
        <Sample title="Empty" note="A slot with no options says so." sections={NO_SECTIONS} placeholder="Pick a trait…" />
        <Sample title="Unavailable" note="A disabled field doesn't open." sections={TRAIT_SECTIONS} placeholder="Pick a trait…" disabled />
        <Sample title="No Matches" note="Type zzz in the search field." sections={TRAIT_SECTIONS} placeholder="Pick a trait…" />
      </CardContent>
    </Card>
  );
}
