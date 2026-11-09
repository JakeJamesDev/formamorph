import { useEffect, useState, type ReactNode } from "react";
import { WorldInput } from "@/components/editor/WorldField";

/**
 * One picked slider's row in a two-column grid: its name, a "Not on this model" status when the known model
 * lacks it, an optional note, and a number field. The field keeps what is typed, so a lone minus sign or a
 * cleared field can stand mid-edit; leaving it cleared commits `undefined`.
 */
export function SliderNumberRow({ name, value, field, missing, note, disabled, onCommit }: {
  name: string;
  value: number;
  /** The number's label, as the column heading reads it. */
  field: string;
  missing: boolean;
  note?: ReactNode;
  disabled?: boolean;
  onCommit: (value: number | undefined) => void;
}) {
  const shown = String(value);
  const [text, setText] = useState(shown);
  // A change from outside the field (undo, a link reset) replaces what it shows; the field's own edit doesn't.
  useEffect(() => { setText((current) => (current.trim() !== "" && Number(current) === Number(shown) ? current : shown)); }, [shown]);
  const commit = (raw: string) => {
    const next = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(next)) onCommit(next);
  };
  const settle = () => {
    if (text.trim() === "") onCommit(undefined);
    setText(shown);
  };
  return (
    <>
      <div className="min-w-0">
        <div className="truncate text-body">{name}</div>
        {missing && <div className="text-helper text-muted-foreground">Not on this model</div>}
        {note}
      </div>
      <WorldInput
        type="number"
        step="any"
        aria-label={`${field} for ${name}`}
        value={text}
        disabled={disabled}
        onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
        onBlur={settle}
      />
    </>
  );
}
