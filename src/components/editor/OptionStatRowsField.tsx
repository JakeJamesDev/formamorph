import { useMemo } from 'react';
import { StatRowsEditor } from '@/components/editor/StatRowsEditor';
import { Meta } from '@/components/ui/typography';
import { useEditorMode } from '@/lib/editorMode';
import { labelPlaceholders } from '@/lib/placementLetters';
import { globalStatsOf } from '@/lib/statLinks';
import type { OptionStatRows, World } from '@/types';

/** One Option value's stat rows under its heading. The picker offers the global stats. */
export function OptionStatRowsField({ when, name, rows, onChange, valueId, world }: {
  /** The heading's tail, such as "When On". Absent for a choice value. */
  when?: string;
  /** What each control is named after. */
  name: string;
  rows: OptionStatRows;
  onChange: (rows: OptionStatRows) => void;
  valueId: string;
  world: Pick<World, 'stats' | 'statGroups' | 'placeholders'>;
}) {
  const { advanced } = useEditorMode();
  const { stats, statGroups, placeholders } = world;
  const choices = useMemo(() => [{ stats: globalStatsOf(stats, statGroups ?? []) }], [stats, statGroups]);
  const heading = (text: string) => <Meta as="p" className="font-medium">{when ? `${text} ${when}` : text}</Meta>;
  return (
    <StatRowsEditor
      statChanges={rows.statChanges ?? []}
      onStatChanges={(next) => onChange({ ...rows, statChanges: next.length ? next : undefined })}
      statToggles={rows.statToggles ?? []}
      onStatToggles={(next) => onChange({ ...rows, statToggles: next.length ? next : undefined })}
      choices={choices}
      label={(statName) => labelPlaceholders(statName, placeholders)}
      showToggles={advanced}
      changesLabel={heading('Stat Changes')}
      togglesLabel={heading('Stat Availability')}
      framePrefix={['statRows', valueId]}
      ariaPrefix={name}
    />
  );
}
