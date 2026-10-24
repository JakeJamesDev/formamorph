import type { BackgroundPassKind } from "@/lib/backgroundPassQueue/backgroundPassQueue";
import { RequestStatusRow } from "./RequestStatusRow";
import { BACKGROUND_PASS_STATUS } from "./statusGlyphs/glyphMap";

/** The status row for the background passes running between turns, or nothing when none runs. */
export function BackgroundPassStatus({ running }: { running: ReadonlySet<BackgroundPassKind> }) {
  const kind = (Object.keys(BACKGROUND_PASS_STATUS) as BackgroundPassKind[]).find((k) => running.has(k));
  if (!kind) return null;
  const { label, glyph } = BACKGROUND_PASS_STATUS[kind];
  return <RequestStatusRow label={label} glyph={glyph} />;
}
