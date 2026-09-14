import { Fragment } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Meta } from '@/components/ui/typography';
import {
  allReferencesAnswered, CREATE_NEW,
  type ReferenceChoices, type ReferenceKind, type ReferenceRow,
} from '@/lib/worldReferences';

const GROUPS: { kind: ReferenceKind; heading: string }[] = [
  { kind: 'placeholder', heading: 'Placeholders' },
  { kind: 'location', heading: 'Locations' },
];

/** The values a placeholder holds, in one line. A reference with no values reads as empty rather than as a
 *  blank the author might take for a loading state. */
const valueLine = (values: string[]) => (values.length ? values.join(', ') : 'No values');

/**
 * One reference: what the content calls it and what this world answers with.
 *
 * Each candidate carries its values beside its name, so two Placeholders of the same name are two different
 * rows to choose between rather than one label written twice. The chosen one keeps them in the closed
 * selector, which is the preview of what this world would supply.
 */
const ReferenceRowFields = ({ row, choice, onChoose }: {
  row: ReferenceRow;
  choice: string | undefined;
  onChoose: (value: string) => void;
}) => (
  <div className="space-y-1 rounded-md border p-2">
    <div className="min-w-0">
      <Meta as="p">Reference</Meta>
      <p className="truncate text-label font-medium">{row.name}</p>
      {row.kind === 'placeholder' && <Meta as="p" className="truncate">{valueLine(row.expects)}</Meta>}
    </div>
    <Meta as="p" className="pt-1">Use in This World</Meta>
    <Select value={choice ?? ''} onValueChange={onChoose}>
      <SelectTrigger aria-label={`Use in This World for ${row.name}`}>
        <SelectValue placeholder="Select one" />
      </SelectTrigger>
      {/* The values a candidate carries can run long, so the list holds the selector's own width. */}
      <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
        {row.candidates.map((candidate) => (
          <SelectItem key={candidate.id} value={candidate.id} className="[&>span:last-child]:min-w-0">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0">{candidate.name}</span>
              {row.kind === 'placeholder' && (
                <span className="truncate text-muted-foreground">{valueLine(candidate.values)}</span>
              )}
            </span>
          </SelectItem>
        ))}
        <SelectItem value={CREATE_NEW}>Create New…</SelectItem>
      </SelectContent>
    </Select>
    {row.ambiguous && <Meta as="p">This world has more than one item with this name. Select the one to use.</Meta>}
  </div>
);

/**
 * Connect what a piece of linked content expects to what this world holds.
 *
 * A source names a Placeholder or a location by its own id, which means nothing here. Each row offers this
 * world's own, with the one carrying the same name preselected; two of that name preselect nothing. The
 * confirming button waits until every row carries an answer, so content never goes in half-connected.
 *
 * The same dialog repairs a copy already in the world, which is what `confirmLabel` and the absent Back
 * button distinguish.
 */
const ConnectReferencesModal = ({ rows, choices, confirmLabel, onChoose, onBack, onCancel, onConfirm }: {
  /** The open references, or an empty list while nothing is being connected. */
  rows: ReferenceRow[] | null;
  choices: ReferenceChoices;
  /** "Connect & Add" while adding, "Save Connections" while repairing. */
  confirmLabel: string;
  onChoose: (key: string, value: string) => void;
  /** Returns to the picker with the picks kept. Absent while repairing, which has nothing to go back to. */
  onBack?: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  if (!rows?.length) return null;
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Connect World References</DialogTitle>
          <DialogDescription>
            This content names world references. Select what each one is in this world.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50dvh] pr-2">
          <div className="space-y-2">
            {GROUPS.map(({ kind, heading }) => {
              const inGroup = rows.filter((row) => row.kind === kind);
              if (!inGroup.length) return null;
              return (
                <Fragment key={kind}>
                  <p className="pt-1 text-meta font-medium text-muted-foreground">{heading}</p>
                  {inGroup.map((row) => (
                    <ReferenceRowFields
                      key={row.key}
                      row={row}
                      choice={choices[row.key]}
                      onChoose={(value) => onChoose(row.key, value)}
                    />
                  ))}
                </Fragment>
              );
            })}
          </div>
        </ScrollArea>
        <DialogFooter>
          {onBack && <Button variant="outline" onClick={onBack}>Back</Button>}
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} disabled={!allReferencesAnswered(rows, choices)}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectReferencesModal;
