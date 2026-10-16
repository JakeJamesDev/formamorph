import type { PlayerStat } from '@/types';

/** The Health a tick of `hours` costs: 5 an hour while the pre-turn Hunger sits at 20 or less. Both stats
 *  must be live, so a switched-off Hunger frozen low never drains Health. Null when no penalty applies. */
export function starvationLoss(
  thresholdStats: readonly PlayerStat[], enabled: Readonly<Record<string, boolean>>, hours: number,
): number | null {
  const live = (name: string) => {
    const stat = thresholdStats.find((s) => s.name === name);
    return stat && enabled[stat.id] !== false ? stat : undefined;
  };
  const hunger = live('Hunger');
  if (!live('Health') || !hunger || hunger.value > 20) return null;
  return 5 * hours;
}
