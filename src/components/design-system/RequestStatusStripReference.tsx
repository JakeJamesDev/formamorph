import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pager } from '@/components/ui/pagination';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { RequestStatusRow, RequestStatusStrip } from '@/components/game/RequestStatusRow';

const NARRATION = [
  'The ferry scrapes against the landing. Rain runs off the rope rail and into the black water below.',
  'A lantern swings at the far end of the pier. Someone holds it high and waits.',
  'The ferryman points at the lantern and does not speak.',
].join('\n\n');

const ROWS = {
  turn: 'Generating Narration…',
  tool: 'Calling roll_dice…',
  background: 'Summarizing turn…',
  none: null,
} as const;
type RowKey = keyof typeof ROWS;

export function RequestStatusStripReference() {
  const [row, setRow] = useState<RowKey>('turn');
  const [startedAt] = useState(() => Date.now() - 12_000);
  const label = ROWS[row];
  return (
    <Card role="region" aria-labelledby="status-strip-title">
      <CardHeader>
        <CardTitle id="status-strip-title" className="text-heading">Request Status Strip</CardTitle>
        <CardDescription>
          The production status row in its strip over a sample narration frame. Pick a row to show it. The footer stays still.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ToggleGroup
          type="single"
          aria-label="Status row"
          className="justify-start"
          value={row}
          onValueChange={(next) => { if (next) setRow(next as RowKey); }}
        >
          <ToggleGroupItem value="turn">Turn</ToggleGroupItem>
          <ToggleGroupItem value="tool">Tool</ToggleGroupItem>
          <ToggleGroupItem value="background">Background</ToggleGroupItem>
          <ToggleGroupItem value="none">None</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex h-48 flex-col gap-2">
          <div className="narration-text min-h-0 flex-grow overflow-hidden border border-border bg-muted/80 p-2">
            <MarkdownRenderer text={NARRATION} />
          </div>
          <div className="relative flex flex-col gap-2">
            {label && (
              <RequestStatusStrip>
                <RequestStatusRow label={label} startedAt={row === 'background' ? undefined : startedAt} />
              </RequestStatusStrip>
            )}
            <Pager page={3} pageCount={3} onPageChange={() => {}} className="justify-center" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
