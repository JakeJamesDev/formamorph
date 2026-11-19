import { useMemo } from 'react';
import { StatRowsEditor, type StatRowPicker, type StatRowTarget } from '@/components/editor/StatRowsEditor';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { BreadcrumbPicker, type BreadcrumbPickerNode, type BreadcrumbPickerRow } from '@/components/ui/breadcrumb-picker';
import { Meta } from '@/components/ui/typography';
import { useEditorMode } from '@/lib/editorMode';
import { labelPlaceholders } from '@/lib/placementLetters';
import { globalStatsOf, resolvedEntityStats } from '@/lib/statLinks';
import type { OptionStatRows, World } from '@/types';

type RowsWorld = Pick<World, 'stats' | 'statGroups' | 'placeholders' | 'entities'>;

/** One key per stat target, so a row and the picker row naming its stat compare by it. */
const targetKey = ({ statId, ownerId }: StatRowTarget) => JSON.stringify([ownerId ?? '', statId]);

/** The stats a row can name: a World page of global stats, then a page per entity holding its own and Blueprint
 *  stats, each named in the owner form ("Wolf: Health"). */
function statTree(world: RowsWorld): { tree: BreadcrumbPickerNode<string>[]; targets: Map<string, StatRowTarget> } {
  const targets = new Map<string, StatRowTarget>();
  const row = (target: StatRowTarget, name: string, place: string): BreadcrumbPickerRow<string> => {
    const key = targetKey(target);
    targets.set(key, target);
    return { key, value: key, name, breadcrumb: [place] };
  };
  const statWorld = { stats: world.stats, statGroups: world.statGroups ?? [] };
  const globals = globalStatsOf(world.stats, statWorld.statGroups).map((s) => row({ statId: s.id }, s.name, 'World'));
  const entityPages = (world.entities ?? []).flatMap((entity): BreadcrumbPickerNode<string>[] => {
    const rows = resolvedEntityStats(statWorld, entity).map((s) => row({ statId: s.id, ownerId: entity.id }, `${entity.name}: ${s.name}`, entity.name));
    return rows.length ? [{ kind: 'page', key: `entity:${entity.id}`, heading: entity.name, children: [{ kind: 'section', rows }] }] : [];
  });
  const tree: BreadcrumbPickerNode<string>[] = [
    ...(globals.length ? [{ kind: 'page' as const, key: 'world', heading: 'World', children: [{ kind: 'section' as const, rows: globals }] }] : []),
    ...entityPages,
  ];
  return { tree, targets };
}

/** One Option value's stat rows under its heading. The picker offers the global stats and each entity's own. */
export function OptionStatRowsField({ when, name, rows, onChange, valueId, world }: {
  /** The heading's tail, such as "When On". Absent for a choice value. */
  when?: string;
  /** What each control is named after. */
  name: string;
  rows: OptionStatRows;
  onChange: (rows: OptionStatRows) => void;
  valueId: string;
  world: RowsWorld;
}) {
  const { advanced } = useEditorMode();
  const { placeholders } = world;
  const { tree, targets } = useMemo(() => statTree(world), [world]);
  const heading = (text: string) => <Meta as="p" className="font-medium">{when ? `${text} ${when}` : text}</Meta>;
  const statPicker: StatRowPicker = (row, onPick, ariaLabel) => {
    const key = targetKey(row);
    return (
      <BreadcrumbPicker
        tree={tree}
        value={targets.has(key) ? key : undefined}
        onPick={(picked) => { const target = targets.get(picked); if (target) onPick(target); }}
        searchPlaceholder="Search stats"
        renderText={(text) => <PlaceholderText text={text} placeholders={placeholders ?? []} />}
        plainText={(text) => labelPlaceholders(text, placeholders)}
        placeholder="Select stat"
        ariaLabel={ariaLabel}
        className="w-full min-w-0"
      />
    );
  };
  return (
    <StatRowsEditor
      statChanges={rows.statChanges ?? []}
      onStatChanges={(next) => onChange({ ...rows, statChanges: next.length ? next : undefined })}
      statToggles={rows.statToggles ?? []}
      onStatToggles={(next) => onChange({ ...rows, statToggles: next.length ? next : undefined })}
      choices={[]}
      label={(statName) => labelPlaceholders(statName, placeholders)}
      statPicker={statPicker}
      showToggles={advanced}
      changesLabel={heading('Stat Changes')}
      togglesLabel={heading('Stat Availability')}
      framePrefix={['statRows', valueId]}
      ariaPrefix={name}
    />
  );
}
