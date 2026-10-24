import type { BackgroundPassKind } from "@/lib/backgroundPassQueue/backgroundPassQueue";
import { RequestStatusRow } from "./RequestStatusRow";

// One label at a time, by fixed precedence.
const LABELS: ReadonlyArray<[BackgroundPassKind, string]> = [
  ["digest", "Summarizing turn…"],
  ["milestone", "Selecting memories…"],
  ["diary", "Writing diary…"],
  ["discover", "Describing character…"],
];

/** The status row for the background passes running between turns, or nothing when none runs. */
export function BackgroundPassStatus({ running }: { running: ReadonlySet<BackgroundPassKind> }) {
  const label = LABELS.find(([kind]) => running.has(kind))?.[1];
  if (!label) return null;
  return <RequestStatusRow label={label} />;
}
