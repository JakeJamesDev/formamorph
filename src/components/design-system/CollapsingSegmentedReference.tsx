import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsingToggleGroup } from '@/components/ui/collapsing-toggle-group';
import { Meta } from '@/components/ui/typography';
import { MAIN_MENU_CARD_OPTIONS, type MainMenuCardTab } from '@/views/mainMenuTabs';

const FRAMES = [
  { width: 480, note: 'Room for every label' },
  { width: 280, note: 'Room for the widest label alone: only the selected tab keeps its label' },
  { width: 200, note: 'Narrower still: icons only' },
];

/** The collapsing segmented control, through the main menu's library tabs, in a wide and a narrow cell. */
export function CollapsingSegmentedReference() {
  const [value, setValue] = useState<MainMenuCardTab>('worlds');
  return (
    <Card role="region" aria-labelledby="collapsing-segmented-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="collapsing-segmented-title" className="text-heading">Collapsing Segmented Control Reference</CardTitle>
        <CardDescription>Every label shows while they fit, then only the selected label, then icons only. The pill slides to the selection.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {FRAMES.map(({ width, note }) => (
          <div key={width} className="space-y-1">
            <div className="rounded-md border border-dashed p-2" style={{ width, maxWidth: '100%' }}>
              <CollapsingToggleGroup options={MAIN_MENU_CARD_OPTIONS} value={value} onValueChange={setValue} aria-label={`Library, ${width}px cell`} />
            </div>
            <Meta>{width}px cell. {note}.</Meta>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
