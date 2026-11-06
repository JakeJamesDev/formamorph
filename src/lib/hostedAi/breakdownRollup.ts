import { REQUEST_LABELS } from '@/lib/promptGroups';
import type { AIRequestType, EditorRequestType } from '@/types';

/** The server's name for spend with no known prompt type. */
const OTHER_TYPE = 'other';

const OTHER_LABEL = 'Other';

/** The prompt names the editor types carry, since AI settings has no row for them. */
const EDITOR_LABELS: Record<EditorRequestType, string> = {
  help: 'Help',
  descriptionSummary: 'Description Summary',
  descriptionBridge: 'Description Bridge',
  imageTags: 'Image Tags',
};

/** Every prompt type sits in exactly one group; the order here is the order shown. */
export const BREAKDOWN_GROUPS: readonly { id: string; label: string; types: readonly AIRequestType[] }[] = [
  { id: 'narration', label: 'Narration', types: ['narration'] },
  { id: 'planning', label: 'Story Planning', types: ['thinking', 'director', 'character', 'storyboard'] },
  { id: 'choices', label: 'Choices', types: ['choices'] },
  {
    id: 'tracking',
    label: 'Stats and World Tracking',
    types: ['statUpdates', 'locationChange', 'narratedMove', 'entityLocation', 'discoverEntity', 'timePassed', 'openingTime', 'sceneTags'],
  },
  { id: 'inventory', label: 'Inventory', types: ['inventory'] },
  { id: 'memory', label: 'Memory', types: ['summary', 'milestoneSelect', 'diary'] },
  { id: 'help', label: 'Help and Editor', types: ['help', 'descriptionSummary', 'descriptionBridge', 'imageTags'] },
];

const GROUP_OF = new Map<string, string>(
  BREAKDOWN_GROUPS.flatMap((group) => group.types.map((type) => [type, group.id] as const)),
);

/** The name a prompt carries in a breakdown: its AI settings name, or its own for an editor type. */
export function breakdownPromptLabel(type: AIRequestType): string {
  return type in EDITOR_LABELS ? EDITOR_LABELS[type as EditorRequestType] : REQUEST_LABELS[type];
}

export interface BreakdownPromptRow {
  type: AIRequestType;
  label: string;
  percent: number;
}

export interface BreakdownGroupRow {
  id: string;
  label: string;
  /** A whole percent; the rows total 100. */
  percent: number;
  /** The prompts at or above the threshold, in the group's order; empty for a one-prompt group. */
  prompts: BreakdownPromptRow[];
}

export interface BreakdownRollup {
  /** True when nothing is spent this week. */
  empty: boolean;
  groups: BreakdownGroupRow[];
}

/** Whole numbers that total `target`: each floors, then the largest remainders take the spare points. */
function largestRemainder(exact: number[], target = 100): number[] {
  const floors = exact.map(Math.floor);
  let spare = target - floors.reduce((sum, n) => sum + n, 0);
  const order = exact.map((value, index) => ({ index, rest: value - floors[index] })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (spare <= 0) break;
    floors[index] += 1;
    spare -= 1;
  }
  return floors;
}

/** Turns the server's per-type shares into group rows with the large prompts nested under them. */
export function rollupBreakdown(breakdown: Record<string, number>, threshold: number | null): BreakdownRollup {
  const groupSums = new Map<string, number>();
  let other = 0;
  let total = 0;
  for (const [type, share] of Object.entries(breakdown)) {
    if (!(share > 0)) continue;
    total += share;
    const group = type === OTHER_TYPE ? undefined : GROUP_OF.get(type);
    if (group) groupSums.set(group, (groupSums.get(group) ?? 0) + share);
    else other += share;
  }
  if (total <= 0) return { empty: true, groups: [] };

  const rows = BREAKDOWN_GROUPS.map((group) => ({ group, raw: groupSums.get(group.id) ?? 0 }));
  const raws = [...rows.map((row) => row.raw), ...(other > 0 ? [other] : [])];
  const percents = largestRemainder(raws.map((raw) => (raw / total) * 100));

  const groups: BreakdownGroupRow[] = rows.map(({ group, raw }, i) => {
    // The group's shown percent is split among its prompts, so nested rows never read above it.
    const split = largestRemainder(
      group.types.map((type) => (raw > 0 && breakdown[type] > 0 ? (breakdown[type] / raw) * percents[i] : 0)),
      percents[i],
    );
    return {
      id: group.id,
      label: group.label,
      percent: percents[i],
      prompts: group.types.length < 2 || threshold === null ? [] : group.types
        .map((type, t) => ({ type, label: breakdownPromptLabel(type), percent: split[t] }))
        .filter(({ type }) => (breakdown[type] ?? 0) >= threshold),
    };
  });
  if (other > 0) groups.push({ id: OTHER_TYPE, label: OTHER_LABEL, percent: percents[rows.length], prompts: [] });
  return { empty: false, groups };
}
