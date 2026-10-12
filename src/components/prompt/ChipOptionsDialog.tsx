import { useId, useState, type ReactElement, type ReactNode } from 'react';
import DrillPicker from './DrillPicker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import type { ChipVocabulary } from '@/lib/chipVocabulary';
import { HISTORY_OVERLAY_ATTRIBUTE } from '@/lib/historyField';
import { AFFIX_FORBIDDEN, isValidAffix, type PromptVariantAxis } from '@/lib/promptVariables';
import { cn } from '@/lib/utils';

const FULL = 'full'; // control value for an axis's default option (null id)

// A one-line input drops newlines, and a heading affix needs them, so the field shows each one as this mark.
const NEWLINE_MARK = '↵';

// Segmented up to this many options; a longer list is a dropdown.
const MAX_SEGMENTS = 3;

const LABEL_TIP = 'Tells this placement apart from others on the same placeholder. Stays with the chip when you move or copy it.';
const HEADER_TIP = 'Starts a section when the chip has a value';
const PREPEND_TIP = "Adds text before the value, only when the value isn't empty. Spaces count, so check Preview.";
const APPEND_TIP = "Adds text after the value, only when the value isn't empty. Spaces count, so check Preview.";

/** One affix field: the connective words that wrap a chip's value, stored literally. Leading and trailing
 *  spaces matter here and an input hides them, so the Preview tab is where you confirm the spacing. */
export function AffixInput({ label, value, disabled, onChange }: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  // The quote delimits the affix inside the token, so it's the one character that can't appear.
  // Stripped on entry rather than rejected, so typing never silently does nothing.
  const commit = (shown: string) =>
    onChange(shown.split(AFFIX_FORBIDDEN).join('').split(NEWLINE_MARK).join('\n'));
  return (
    <Input
      aria-label={label}
      value={value.split('\n').join(NEWLINE_MARK)}
      disabled={disabled}
      onChange={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const input = e.currentTarget;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        commit(`${input.value.slice(0, start)}${NEWLINE_MARK}${input.value.slice(end)}`);
      }}
      className="h-7 text-meta font-mono"
    />
  );
}

/** One short row: its name on the left, its control on the right. */
function Row({ label, tip, children }: { label: string; tip?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
      <Tip tip={tip} labelsChild={false}>
        <span className="text-meta font-medium">{label}</span>
      </Tip>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface ChipOptionsBodyProps {
  token: string;
  vocab: ChipVocabulary;
  editable: boolean;
  update: ChipOptionsProps['update'];
  onRepick?: ChipOptionsProps['onRepick'];
  onEditValue?: ChipOptionsProps['onEditValue'];
  twoPane: boolean;
}

/** A pick-one axis: segmented while short, a dropdown once its options outgrow a row. */
function PickOne({ axis, label, active, editable, onPick }: {
  axis: PromptVariantAxis;
  label: string;
  active: string;
  editable: boolean;
  onPick: (optionId: string | null) => void;
}) {
  const disabled = !editable || !!axis.readOnly;
  const pick = (value: string) => onPick(value === FULL ? null : value);
  const control = axis.options.length > MAX_SEGMENTS ? (
    <Select value={active} onValueChange={pick} disabled={disabled}>
      <SelectTrigger aria-label={label} className="h-7 text-meta">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {axis.options.map((opt) => (
          <Tip key={opt.id ?? FULL} tip={opt.help} side="right" labelsChild={false}>
            <SelectItem value={opt.id ?? FULL} className="text-meta">{opt.label}</SelectItem>
          </Tip>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={active}
      // A single ToggleGroup clears its value when the active item is clicked again; an axis always has a
      // mode, so an empty result is ignored rather than stored.
      onValueChange={(value) => { if (value) pick(value); }}
      className="grid h-7 w-full"
      style={{ gridTemplateColumns: `repeat(${axis.options.length}, minmax(0, 1fr))` }}
    >
      {axis.options.map((opt) => (
        <Tip key={opt.id ?? FULL} tip={opt.help} labelsChild={false}>
          <ToggleGroupItem value={opt.id ?? FULL} disabled={disabled} className="px-1.5 py-0 text-meta">
            {opt.label}
          </ToggleGroupItem>
        </Tip>
      ))}
    </ToggleGroup>
  );
  // A shut axis says why, except in a read-only field, which holds every control shut.
  if (!axis.readOnly || !editable) return control;
  return <Tip tip={axis.readOnlyHelp} labelsChild={false}><div>{control}</div></Tip>;
}

/** The controls face: one row per axis in the chip's order, then the placement fields below a rule. */
function OptionRows({ token, vocab, editable, update, hasActions }: Omit<ChipOptionsBodyProps, 'onRepick' | 'onEditValue' | 'twoPane'> & {
  hasActions: boolean;
}) {
  const axes = vocab.axes(token);
  const selection = vocab.selection(token);
  const affixes = vocab.affixes(token);
  const header = vocab.header?.(token) ?? null;
  const placementLabel = vocab.placementLabel?.(token) ?? null;

  const setAxis = (axisId: string, optionId: string | null) =>
    update((t) => vocab.setAxis(t, axisId, optionId));
  const setAffix = (which: 'pre' | 'post', value: string) => {
    if (!isValidAffix(value)) return;
    update((t) => {
      const current = vocab.affixes(t) ?? { pre: '', post: '' };
      return which === 'pre' ? vocab.setAffixes(t, value, current.post) : vocab.setAffixes(t, current.pre, value);
    });
  };

  // How many off-by-default toggles are on: the last one is locked so a stats block is never nameless.
  const toggleOnCount = axes.filter((a) => a.toggle && !a.onByDefault && selection[a.id] != null).length;
  // Today's off-by-default toggles are the Stats chip's pieces; registry lock groups replace this split.
  const toggleRow = (onByDefault: boolean) => {
    const label = onByDefault ? 'Include' : 'Stat Detail';
    const group = axes.filter((a) => a.toggle && !!a.onByDefault === onByDefault);
    return (
      <Row key={label} label={label}>
        <div role="group" aria-label={label} className="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-1">
          {group.map((axis) => {
            const stored = axis.options.find((o) => o.id != null)?.id ?? null;
            const holdsStored = selection[axis.id] != null;
            const isOn = holdsStored !== !!axis.onByDefault;
            const disabled = !editable || (!axis.onByDefault && isOn && toggleOnCount === 1);
            return (
              <Tip key={axis.id} tip={axis.help} labelsChild={false}>
                <label className={cn('flex items-center gap-1.5 text-meta', disabled ? 'cursor-default' : 'cursor-pointer')}>
                  <Checkbox checked={isOn} disabled={disabled} onCheckedChange={() => setAxis(axis.id, holdsStored ? null : stored)} />
                  {axis.label}
                </label>
              </Tip>
            );
          })}
        </div>
      </Row>
    );
  };

  const rows: ReactNode[] = [];
  const placedGroups = new Set<boolean>();
  for (const axis of axes) {
    if (axis.toggle) {
      const onByDefault = !!axis.onByDefault;
      if (!placedGroups.has(onByDefault)) rows.push(toggleRow(onByDefault));
      placedGroups.add(onByDefault);
      continue;
    }
    const label = axis.label || 'Mode';
    rows.push(
      <Row key={axis.id} label={label}>
        <PickOne axis={axis} label={label} active={selection[axis.id] ?? FULL} editable={editable}
          onPick={(optionId) => setAxis(axis.id, optionId)} />
      </Row>,
    );
  }
  if (placementLabel != null) {
    rows.push(
      <Row key="label" label="Label" tip={LABEL_TIP}>
        <Input aria-label="Label" value={placementLabel} disabled={!editable} className="h-7 text-meta"
          onChange={(e) => { const next = e.target.value; update((t) => vocab.setPlacementLabel?.(t, next) ?? t); }} />
      </Row>,
    );
  }

  const placement = header != null || affixes != null;
  if (!rows.length && !placement) {
    return hasActions ? null : <p className="text-meta text-muted-foreground">No options for this variable.</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows}
      {placement && (
        <div className={cn('space-y-2.5', rows.length > 0 && 'border-t pt-3')}>
          {header != null && (
            <Row label="Header" tip={HEADER_TIP}>
              <Input aria-label="Header" value={header} disabled={!editable} className="h-7 text-meta"
                onChange={(e) => { const next = e.target.value; update((t) => vocab.setHeader?.(t, next) ?? t); }} />
            </Row>
          )}
          {affixes && (
            <>
              <Row label="Prepend" tip={PREPEND_TIP}>
                <AffixInput label="Prepend" value={affixes.pre} disabled={!editable} onChange={(v) => setAffix('pre', v)} />
              </Row>
              <Row label="Append" tip={APPEND_TIP}>
                <AffixInput label="Append" value={affixes.post} disabled={!editable} onChange={(v) => setAffix('post', v)} />
              </Row>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The right pane of a prompt chip. */
function ReadsPane() {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex min-h-0 flex-col gap-1.5">
      <p id={titleId} className="text-meta font-medium">What the AI Reads</p>
      <div className="min-h-32 flex-1 rounded-md border bg-muted/40" />
    </section>
  );
}

/** Mounted with the dialog's content, so closing forgets a Re-Pick walk. */
function ChipOptionsBody({ token, vocab, editable, update, onRepick, onEditValue, twoPane }: ChipOptionsBodyProps) {
  const [repicking, setRepicking] = useState(false);

  if (repicking && onRepick) {
    return (
      <ScrollArea className="min-h-0">
        <div className="space-y-2 px-5 pb-5">
          <button
            type="button"
            onClick={() => setRepicking(false)}
            className="flex items-center gap-1 rounded text-meta text-muted-foreground hover:text-foreground"
          >
            <span aria-hidden>‹</span>
            Back
          </button>
          <DrillPicker vocab={vocab} token={token} onPick={onRepick} />
        </div>
      </ScrollArea>
    );
  }

  const hasActions = !!onRepick || !!onEditValue;
  const rows = <OptionRows token={token} vocab={vocab} editable={editable} update={update} hasActions={hasActions} />;
  return (
    <>
      <ScrollArea className="min-h-0">
        <div className="px-5 pb-5">
          {twoPane ? (
            // The panes stack on a narrow screen, controls first.
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div>{rows}</div>
              <ReadsPane />
            </div>
          ) : (
            rows
          )}
        </div>
      </ScrollArea>
      {hasActions && (
        <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-3">
          {onRepick && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-meta" onClick={() => setRepicking(true)}>
              Re-Pick…
            </Button>
          )}
          {onEditValue && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-meta" onClick={onEditValue}>
              Edit Value
            </Button>
          )}
        </div>
      )}
    </>
  );
}

export interface ChipOptionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The chip that opens the dialog. */
  trigger?: ReactElement;
  token: string;
  vocab: ChipVocabulary;
  /** False shows every control disabled. */
  editable: boolean;
  /** Writes the token that `change` makes of the live one. */
  update: (change: (token: string) => string) => void;
  /** Re-aims the chip at what the drill picker settled on. Absent where the chip cannot be re-aimed. */
  onRepick?: (picked: string) => void;
  /** Opens the chip's value for editing. Absent where the chip has no value to write. */
  onEditValue?: () => void;
}

/** Chip Options: a placed chip's settings in a centered dialog that nests in the dialog it opens from. */
export function ChipOptionsDialog({ open, onOpenChange, trigger, token, vocab, editable, update, onRepick, onEditValue }: ChipOptionsProps) {
  const color = vocab.color(token);
  const twoPane = vocab.promptChip?.(token) ?? false;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        surface="chipOptions"
        className={cn(twoPane ? 'max-w-3xl' : 'max-w-md', 'flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0')}
        // Portaled, but React still bubbles a click to the field's own tap handler.
        onClick={(event) => event.stopPropagation()}
        {...{ [HISTORY_OVERLAY_ATTRIBUTE]: '' }}
      >
        <DialogHeader className="shrink-0 px-5 pb-3 pt-5">
          <DialogTitle>Chip Options</DialogTitle>
          <DialogDescription className="flex items-center gap-2 sm:justify-start justify-center">
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm border" style={{ backgroundColor: color }} aria-hidden />
            {vocab.label(token)}
          </DialogDescription>
        </DialogHeader>
        <ChipOptionsBody token={token} vocab={vocab} editable={editable} update={update}
          onRepick={onRepick} onEditValue={onEditValue} twoPane={twoPane} />
      </DialogContent>
    </Dialog>
  );
}
