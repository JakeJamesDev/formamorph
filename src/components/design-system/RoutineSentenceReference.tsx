import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RoutineRow } from '@/managers/routine/RoutineRow';
import type { PlaceBook } from '@/managers/routine/RoutineFields';
import type { ScheduleRow } from '@/types';

const NAMES: Record<string, string> = { smithy: 'Smithy', inn: 'Inn', market: 'Market', wall: 'Wall', gate: 'Gate', farm: 'Farm' };
const BOOK: PlaceBook = {
  nameOf: (id) => NAMES[id] ?? id,
  all: Object.keys(NAMES),
  rowsOf: (ids) => ids.map((id) => ({ key: id, value: id, name: NAMES[id] ?? id, breadcrumb: id === 'farm' ? undefined : ['Village'] })),
};
// Farm is listed but not connected, so its row shows the warning.
const CONNECTED = ['smithy', 'inn', 'market', 'wall', 'gate'];

const ROWS: ScheduleRow[] = [
  { id: 'base', time: 'allDay', action: { kind: 'stay', place: 'inn' } },
  { id: 'work', time: { start: 475, end: 1022 }, strict: true, action: { kind: 'stay', place: 'smithy' } },
  { id: 'drift', time: { start: 1022, end: 1195 }, action: { kind: 'wander', places: [{ place: 'market', weight: 3 }, { place: 'farm', weight: 1 }], idle: 240 } },
  { id: 'round', time: { start: 0, end: 360 }, action: { kind: 'patrol', stops: [{ place: 'wall', idle: 60 }, { place: 'gate', idle: 30 }] } },
];

/** Routine sentences in local state: each part opens its own editor. */
export function RoutineSentenceReference() {
  const [rows, setRows] = useState(ROWS);
  return (
    <Card role="region" aria-labelledby="routine-sentence-reference-title" className="min-w-0">
      <CardHeader>
        <CardTitle id="routine-sentence-reference-title" className="text-heading">Routine Sentence Reference</CardTitle>
        <CardDescription>Click a time, a verb or the locations to edit that part</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="max-w-2xl space-y-0.5 border-l pl-2" aria-label="Routine">
          {rows.map((row) => (
            <RoutineRow
              key={row.id} row={row} startPlace="smithy" book={BOOK} connected={CONNECTED}
              others={rows.filter((r) => r.id !== row.id)}
              onChange={(next) => setRows((all) => all.map((r) => (r.id === next.id ? next : r)))}
              onDelete={() => setRows((all) => all.filter((r) => r.id !== row.id))}
            />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
