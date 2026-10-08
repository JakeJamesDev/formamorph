import { useMemo, useState } from 'react';
import { FlaskConical, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tip } from '@/components/ui/tooltip';
import { HistoryControls, type HistoryView } from '@/components/editor/HistoryControls';
import type { StepLabelParts } from '@/lib/editorHistoryLabels';

const SAMPLE_STEPS: StepLabelParts[] = [
  { verb: 'Add', type: 'Stat', slice: 'stats', name: 'Hunger' },
  { verb: 'Edit', type: 'Stat', slice: 'stats', name: 'Hunger', field: 'Description' },
  { verb: 'Add', type: 'Location', slice: 'locations', name: 'Docks' },
  { verb: 'Edit', type: 'Locations', slice: 'locations' },
  { verb: 'Edit', type: 'World', slice: 'worldOverview', field: 'Thumbnail' },
  { verb: 'Remove', type: 'Trait', slice: 'traits', name: 'Brave' },
  { verb: 'Edit', type: 'Entity', slice: 'entities', name: 'Mara', field: 'Image Tags' },
  { verb: 'Edit', type: 'Location', slice: 'locations', name: 'Docks', field: 'Travel Hint' },
  { verb: 'Add', type: 'Connection', slice: 'connections', name: 'Docks → Market' },
];
const START = { count: 7, cursor: 7, saved: 5 as number | null };

/** The sample's history: the same view the World Editor's controls read, held in local state. */
function useSampleHistory(): { history: HistoryView; addStep(): void; markSaved(): void; reset(): void } {
  const [count, setCount] = useState(START.count);
  const [cursor, setCursor] = useState(START.cursor);
  const [saved, setSaved] = useState<number | null>(START.saved);
  const rows = useMemo(
    () => Array.from({ length: count }, (_, i) => SAMPLE_STEPS[i % SAMPLE_STEPS.length]),
    [count],
  );
  const history: HistoryView = {
    canUndo: cursor > 0,
    canRedo: cursor < count,
    rows,
    cursor,
    saved,
    undo: () => setCursor((c) => Math.max(0, c - 1)),
    redo: () => setCursor((c) => Math.min(count, c + 1)),
    jump: (position) => setCursor(Math.max(0, Math.min(count, position))),
  };
  return {
    history,
    // A new Step drops the undone ones, as the editor does, and a marker past the cursor goes with them.
    addStep: () => {
      setCount(cursor + 1);
      setCursor(cursor + 1);
      setSaved((marker) => (marker !== null && marker > cursor ? null : marker));
    },
    markSaved: () => setSaved(cursor),
    reset: () => { setCount(START.count); setCursor(START.cursor); setSaved(START.saved); },
  };
}

/** The History control over a sample history, on a desktop bar and a mobile header. Nothing here touches a world. */
export function HistoryControlsReference() {
  const sample = useSampleHistory();
  return (
    <Card role="region" aria-labelledby="history-controls-title">
      <CardHeader>
        <CardTitle id="history-controls-title" className="text-heading">History Controls</CardTitle>
        <CardDescription>
          The World Editor&apos;s Undo, Redo and History list over a sample history. Both layouts read the same
          history, so a move in one shows in the other.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={sample.addStep}>Add Sample Step</Button>
          <Button variant="outline" size="sm" onClick={sample.markSaved}>Mark Saved</Button>
          <Button variant="outline" size="sm" onClick={sample.reset}>Reset Sample</Button>
        </div>
        <section className="grid gap-2" aria-label="Desktop sample">
          <p className="text-meta font-medium text-muted-foreground">Desktop</p>
          <div className="overflow-x-auto rounded-md border border-border">
            <div className="flex min-h-14 min-w-[28rem] items-center justify-end gap-1 px-3">
              <HistoryControls history={sample.history} layout="pill" />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <Button size="sm" disabled>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        </section>
        <section className="grid gap-2" aria-label="Mobile sample">
          <p className="text-meta font-medium text-muted-foreground">Mobile</p>
          <div className="w-full max-w-[390px] rounded-md border border-border">
            <div className="flex items-center gap-2 px-3 py-2 [&>*]:shrink-0">
              <span className="text-label">Advanced</span>
              <span className="ml-auto" />
              <HistoryControls history={sample.history} layout="icon" />
              <Tip tip="Test Bench" labelsChild={false}>
                <Button variant="ghost" size="icon" aria-label="Sample Test Bench"><FlaskConical className="h-4 w-4" /></Button>
              </Tip>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
// scroll-guard: allow horizontal: the desktop-width bar scrolls sideways in a narrow showcase
