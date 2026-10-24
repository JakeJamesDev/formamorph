import type { BackgroundPassKind } from "@/lib/backgroundPassQueue/backgroundPassQueue";
import { RequestStatusRow } from "./RequestStatusRow";
import { BACKGROUND_PASS_GLYPHS } from "./statusGlyphs/glyphMap";

// One label at a time, by fixed precedence.
const LABELS: ReadonlyArray<[BackgroundPassKind, string]> = [
  ["digest", "Summarizing turn…"],
  ["milestone", "Selecting memories…"],
  ["diary", "Writing diary…"],
  ["discover", "Describing character…"],
];

/** The status row for the background passes running between turns, or nothing when none runs. */
export function BackgroundPassStatus({ running }: { running: ReadonlySet<BackgroundPassKind> }) {
  const shown = LABELS.find(([kind]) => running.has(kind));
  if (!shown) return null;
  const [kind, label] = shown;
  return <RequestStatusRow label={label} glyph={BACKGROUND_PASS_GLYPHS[kind]} />;
}
