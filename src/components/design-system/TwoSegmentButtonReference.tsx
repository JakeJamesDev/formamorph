import { useState } from 'react';
import { FolderOpen, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TwoSegmentButton } from '@/components/ui/two-segment-button';

/** The game header's Save and Load pair. Each half reports its own click. */
export function TwoSegmentButtonReference() {
  const [last, setLast] = useState('None');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Segment Button</CardTitle>
        <CardDescription>Two related actions as one round pill. Each half takes one click.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <TwoSegmentButton
          segments={[
            { label: 'Save Game', icon: Save, onClick: () => setLast('Save Game') },
            { label: 'Load Game', icon: FolderOpen, onClick: () => setLast('Load Game') },
          ]}
        />
        <span className="text-label text-muted-foreground">Last clicked: {last}</span>
      </CardContent>
    </Card>
  );
}
