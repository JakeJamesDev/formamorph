import { Fragment, useId, useMemo, useState, type ReactElement, type ReactNode } from 'react';
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
import { splitRunLines, type TextOrigin } from '@/lib/markedText';
import { resolveTokenRuns } from '@/lib/promptTemplate';
import { AFFIX_FORBIDDEN, isValidAffix, toggleIsOn, toggleOptionFor, type PromptVariantAxis } from '@/lib/promptVariables';
import type { TokenValues } from '@/lib/promptValues';
import { cn } from '@/lib/utils';

const FULL = 'full'; // control value for an axis's default option (null id)

// A one-line input drops newlines, and a heading affix needs them, so the field shows each one as this mark.
const NEWLINE_MARK = '↵';

// Segmented up to this many options; a longer list is a dropdown.
const MAX_SEGMENTS = 3;

const MOOT_NAME_TIP = 'Name content sends no stats or traits';
const MOOT_STATS_TIP = 'Check Stats under Include to pick Stat Detail';
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

/** Lights `origin` in the right pane while the pointer is over the control or focus is inside it. */
type Light = (origin: TextOrigin | null) => void;

/** The handlers that light `origin` from a control, or none for a control that lights nothing. */
function lightProps(origin: TextOrigin | undefined, light: Light) {
  if (!origin) return {};
  return {
    onMouseEnter: () => light(origin), onMouseLeave: () => light(null),
    onFocus: () => light(origin), onBlur: () => light(null),
  };
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
  reads: TokenValues | undefined;
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
function OptionRows({ token, vocab, editable, update, hasActions, light }: Omit<ChipOptionsBodyProps, 'reads' | 'onRepick' | 'onEditValue' | 'twoPane'> & {
  hasActions: boolean;
  light: Light;
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

  // Name content sends no stats or traits, so only Only With stays live.
  const namesOnly = selection.content === 'name';
  const statsAxis = axes.find((a) => a.toggle && a.id === 'stats');
  const statsOff = !!statsAxis && !toggleIsOn(statsAxis, selection);
  const moot = (row: string) =>
    row !== 'Only With' && namesOnly ? MOOT_NAME_TIP : row === 'Stat Detail' && statsOff ? MOOT_STATS_TIP : undefined;

  const toggleRow = (name: string, group: PromptVariantAxis[]) => {
    const mootTip = moot(name);
    return (
      <Row key={name} label={name} tip={mootTip ?? group.find((a) => a.rowHelp)?.rowHelp}>
        <div role="group" aria-label={name} className="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-1">
          {group.map((axis) => {
            const isOn = toggleIsOn(axis, selection);
            // The last piece on in a lock group stays on, so a stat is never sent as a bare name.
            const lockedOn = isOn && !!axis.lockGroup
              && axes.filter((a) => a.toggle && a.lockGroup === axis.lockGroup && toggleIsOn(a, selection)).length === 1;
            const disabled = !editable || !!mootTip || lockedOn;
            return (
              <Tip key={axis.id} tip={axis.help} labelsChild={false}>
                <label className={cn('flex items-center gap-1.5 text-meta', disabled ? 'cursor-default' : 'cursor-pointer')}
                  {...lightProps(axis.lights, light)}>
                  <Checkbox checked={isOn} disabled={disabled} onCheckedChange={() => setAxis(axis.id, toggleOptionFor(axis, selection, !isOn))} />
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
  const placedRows = new Set<string>();
  for (const axis of axes) {
    if (axis.toggle) {
      const name = axis.row ?? axis.label;
      if (!placedRows.has(name)) rows.push(toggleRow(name, axes.filter((a) => a.toggle && (a.row ?? a.label) === name)));
      placedRows.add(name);
      continue;
    }
    const label = axis.label || 'Mode';
    rows.push(
      <Row key={axis.id} label={label}>
        <div {...lightProps(axis.lights, light)}>
          <PickOne axis={axis} label={label} active={selection[axis.id] ?? FULL} editable={editable}
            onPick={(optionId) => setAxis(axis.id, optionId)} />
        </div>
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
              <div {...lightProps('header', light)}>
                <Input aria-label="Header" value={header} disabled={!editable} className="h-7 text-meta"
                  onChange={(e) => { const next = e.target.value; update((t) => vocab.setHeader?.(t, next) ?? t); }} />
              </div>
            </Row>
          )}
          {affixes && (
            <>
              <Row label="Prepend" tip={PREPEND_TIP}>
                <div {...lightProps('prepend', light)}>
                  <AffixInput label="Prepend" value={affixes.pre} disabled={!editable} onChange={(v) => setAffix('pre', v)} />
                </div>
              </Row>
              <Row label="Append" tip={APPEND_TIP}>
                <div {...lightProps('append', light)}>
                  <AffixInput label="Append" value={affixes.post} disabled={!editable} onChange={(v) => setAffix('post', v)} />
                </div>
              </Row>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const PLACEMENT: readonly TextOrigin[] = ['header', 'prepend', 'append'];

/** The right pane of a prompt chip: what the token renders to in the field's own scene, header and affixes
 *  included, the placement text one shade dimmer than the chip's value. While a control is lit, the text it
 *  produces is highlighted and every line without it dims. */
function ReadsPane({ token, reads, lit }: { token: string; reads: TokenValues | undefined; lit: TextOrigin | null }) {
  const titleId = useId();
  const rendered = useMemo(() => (reads ? resolveTokenRuns(token, reads) : undefined), [token, reads]);
  // A value control lights only what its renderer reported; the placement fields always light their own text.
  const litOrigin = lit && rendered && (rendered.reported || PLACEMENT.includes(lit)) ? lit : null;
  const producesText = !!litOrigin && !!rendered?.runs.some((run) => run.origins.includes(litOrigin) && run.text.trim() !== '');
  // A control whose text the scene never produced dims nothing.
  const active = producesText ? litOrigin : null;
  return (
    <section aria-labelledby={titleId} className="flex min-h-0 flex-col gap-1.5">
      <p id={titleId} className="text-meta font-medium">What the AI Reads</p>
      <div className="min-h-32 flex-1 whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-label">
        {rendered && splitRunLines(rendered.runs).map((line, i) => {
          // A line break or indent alone never keeps its line lit.
          const lineLit = !!active && line.some((run) => run.origins.includes(active) && run.text.trim() !== '');
          return (
            <Fragment key={i}>
              {line.map((run, j) => {
                const placement = run.origins.some((origin) => PLACEMENT.includes(origin));
                const runLit = !!active && run.origins.includes(active);
                const className = cn(
                  placement && 'text-muted-foreground',
                  runLit && 'rounded-sm bg-primary/15 text-foreground',
                  active && !lineLit && 'opacity-40',
                );
                if (!className) return run.text;
                return (
                  <span key={j} data-placement={placement ? '' : undefined} data-lit={runLit ? '' : undefined} className={className}>
                    {run.text}
                  </span>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

/** Mounted with the dialog's content, so closing forgets a Re-Pick walk. */
function ChipOptionsBody({ token, vocab, editable, update, reads, onRepick, onEditValue, twoPane }: ChipOptionsBodyProps) {
  const [repicking, setRepicking] = useState(false);
  const [lit, setLit] = useState<TextOrigin | null>(null);

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
  const rows = <OptionRows token={token} vocab={vocab} editable={editable} update={update} hasActions={hasActions} light={setLit} />;
  return (
    <>
      <ScrollArea className="min-h-0">
        <div className="px-5 pb-5">
          {twoPane ? (
            // The panes stack on a narrow screen, controls first.
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div>{rows}</div>
              <ReadsPane token={token} reads={reads} lit={lit} />
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
  /** The values a prompt chip renders from: the Preview tab's lookup in a game, the authored world in the
   *  World Editor, the sample scene in Settings. The right pane shows none without it. */
  reads?: TokenValues;
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
export function ChipOptionsDialog({ open, onOpenChange, trigger, token, vocab, reads, editable, update, onRepick, onEditValue }: ChipOptionsProps) {
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
        <ChipOptionsBody token={token} vocab={vocab} reads={reads} editable={editable} update={update}
          onRepick={onRepick} onEditValue={onEditValue} twoPane={twoPane} />
      </DialogContent>
    </Dialog>
  );
}
