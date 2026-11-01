import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { entryCapacity } from '@/lib/bodies';
import { boxLabel, type BoxRef } from '@/lib/bodyLayout';
import { BodyLayoutEditor } from '@/managers/BodyLayoutEditor';
import type { Body } from '@/types';

const NAMES: Record<string, string> = { head: 'Head', hand: 'Hand', ring: 'Ring' };
const SAMPLE: Body = {
  id: 'sample', name: 'Sample', backdrop: { kind: 'humanoid' }, aspect: 0.5,
  entries: [
    { slotId: 'head', boxes: [{ x: 0.36, y: 0.02, w: 0.28, h: 0.14 }] },
    { slotId: 'hand', capacity: 2, boxes: [{ x: 0.02, y: 0.44, w: 0.2, h: 0.12 }, { x: 0.78, y: 0.44, w: 0.2, h: 0.12 }] },
    { slotId: 'ring', boxes: [{ x: 0.08, y: 0.49, w: 0.08, h: 0.04 }] },
  ],
};

/** The production Body Layout editor on a local sample: move, resize, snap, change the aspect and the Backdrop. */
export function BodyLayoutReference() {
  const [body, setBody] = useState(SAMPLE);
  const [selected, setSelected] = useState<BoxRef | null>(null);
  const [snap, setSnap] = useState(true);
  const labelOf = ({ slotId, unit }: BoxRef) => {
    const entry = body.entries.find((e) => e.slotId === slotId);
    return boxLabel(NAMES[slotId], entry ? entryCapacity(entry) : 1, unit);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-heading">Body Layout</CardTitle>
        <CardDescription>Ring sits inside Hand 1, so a selected Hand 1 still leaves Ring clickable</CardDescription>
      </CardHeader>
      <CardContent>
        <BodyLayoutEditor body={body} onChange={setBody} labelOf={labelOf} selected={selected} onSelect={setSelected} focusRequest={0} snap={snap} onSnap={setSnap}>
          <span className="text-label">Slots</span>
          <p className="text-helper text-muted-foreground">{selected ? `Selected: ${labelOf(selected)}` : 'Nothing is selected.'}</p>
        </BodyLayoutEditor>
      </CardContent>
    </Card>
  );
}
