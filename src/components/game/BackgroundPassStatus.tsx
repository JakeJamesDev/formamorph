import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { Meta } from "@/components/ui/typography";
import type { BackgroundPassKind } from "@/lib/backgroundPassQueue/backgroundPassQueue";

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
  return (
    <div className="flex items-center gap-2 mb-1">
      <Meta className="whitespace-nowrap">{label}</Meta>
      <div className="flex-grow">
        <IndeterminateProgress />
      </div>
    </div>
  );
}
