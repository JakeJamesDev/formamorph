import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { ColorPicker } from "@/components/ui/color-picker";
import type { ColorChannel } from "@/types";

const CHANNEL_LABELS: Record<ColorChannel, string> = { skin: "Skin", eye: "Eye", hair: "Hair" };
const CHANNEL_OPTIONS = (Object.keys(CHANNEL_LABELS) as ColorChannel[]).map((value) => ({ label: CHANNEL_LABELS[value], value }));

interface ColorRow {
  channel: ColorChannel;
  color: string;
}

/**
 * The Colors field of a stat or a trait: a channel multi-select, then one row per picked channel with its color.
 * A picked channel keeps its color; a new one starts at `seedColor`. A row whose channel the known model lacks
 * reads "Not on this model".
 */
export function ColorRowsField<R extends ColorRow>({ id, label, hint, rows, column, lacksChannel, seedColor, note, disabled, onOpen, onChange }: {
  /** Remounts the uncontrolled multi-select when the edited record changes. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  rows: readonly R[];
  /** The color column's heading, also each picker's label. */
  column: string;
  lacksChannel: (channel: ColorChannel) => boolean;
  seedColor: (channel: ColorChannel) => string;
  note?: (channel: ColorChannel) => ReactNode;
  disabled?: boolean;
  onOpen?: () => void;
  onChange: (rows: ColorRow[]) => void;
}) {
  const pick = (channels: string[]) =>
    onChange((channels as ColorChannel[]).map((channel) => rows.find((r) => r.channel === channel) ?? { channel, color: seedColor(channel) }));
  const setColor = (channel: ColorChannel, color: string) =>
    onChange(rows.map((r) => (r.channel === channel ? { channel, color } : r)));
  return (
    <div className="space-y-2">
      {label}
      {hint}
      <MultiSelect
        key={id}
        options={CHANNEL_OPTIONS}
        defaultValue={rows.map((r) => r.channel)}
        onValueChange={pick}
        onOpenChange={(open) => { if (open) onOpen?.(); }}
        placeholder="Select colors"
        searchable={false}
        disabled={disabled}
      />
      {rows.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 pt-1">
          <span />
          <Label className="text-meta text-muted-foreground">{column}</Label>
          {rows.map(({ channel, color }) => (
            <div key={channel} className="contents">
              <div className="min-w-0">
                <div className="truncate text-body">{CHANNEL_LABELS[channel]}</div>
                {lacksChannel(channel) && <div className="text-helper text-muted-foreground">Not on this model</div>}
                {note?.(channel)}
              </div>
              {disabled ? (
                <span className="flex items-center gap-2 font-mono text-body">
                  <span aria-hidden className="h-5 w-5 rounded-sm border border-border" style={{ backgroundColor: color }} />
                  {color}
                </span>
              ) : (
                <ColorPicker value={color} aria-label={`${column} for ${CHANNEL_LABELS[channel]}`} onChange={(hex) => setColor(channel, hex)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
