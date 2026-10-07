import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchField } from '@/components/ui/search-field';
import { Meta, SectionTitle } from '@/components/ui/typography';

const PLACES = ['Harbor Gate', 'Salt Marsh Watchtower', 'Old Observatory', 'Eastern Stair', 'Keeper’s Room'];

/** One theme's samples: a list filter at the default height and a compact field that starts with text. */
function ThemePanel({ mode }: { mode: 'light' | 'dark' }) {
  const name = mode === 'light' ? 'Light' : 'Dark';
  const [filter, setFilter] = useState('');
  const [compact, setCompact] = useState('tide');
  const shown = PLACES.filter((place) => place.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <section
      aria-label={`${name} Theme`}
      className={`${mode} grid min-w-0 content-start gap-4 rounded-md border border-border bg-background p-4 text-foreground`}
      data-theme="blue"
    >
      <SectionTitle>{name}</SectionTitle>
      <div className="grid gap-2">
        <SearchField aria-label="Search Places" placeholder="Search Places" value={filter} onChange={setFilter} />
        <ul aria-label="Places" className="grid gap-1 text-label">
          {shown.map((place) => <li key={place} className="rounded px-2 py-1 hover:bg-accent">{place}</li>)}
        </ul>
        {shown.length === 0 && <Meta>No places match this search.</Meta>}
      </div>
      <div className="grid gap-2">
        <Meta>Compact</Meta>
        <SearchField aria-label="Filter Traits" placeholder="Filter Traits" size="sm" value={compact} onChange={setCompact} />
      </div>
    </section>
  );
}

/** The shared Search Field at both heights, in both themes. */
export function SearchFieldReference() {
  return (
    <Card role="region" aria-labelledby="search-field-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="search-field-reference-title" className="text-heading">Search Field Reference</CardTitle>
        <CardDescription>Type in a field to show the X. Select the X to clear the field.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ThemePanel mode="light" />
        <ThemePanel mode="dark" />
      </CardContent>
    </Card>
  );
}
