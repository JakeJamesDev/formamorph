import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Meta } from '@/components/ui/typography';
import { TimeConditionControls } from '@/components/editor/TimeConditionControls';
import { timeText } from '@/lib/traitGates';
import type { TimeRequirement } from '@/types';

/** The segmented multi-select, through the time Condition chip's production controls, with local state. */
export function SegmentedMultiSelectReference() {
  const [requirement, setRequirement] = useState<TimeRequirement>({ kind: 'time', dayparts: ['evening', 'night'] });
  return (
    <Card role="region" aria-labelledby="segmented-multi-select-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="segmented-multi-select-title" className="text-heading">Segmented Multi-Select Reference</CardTitle>
        <CardDescription>Each segment turns on and off by itself. The last one on stays on.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <TimeConditionControls requirement={requirement} accepts={() => true} onChange={setRequirement} />
        <Meta>Reads: {timeText(requirement)}</Meta>
      </CardContent>
    </Card>
  );
}
