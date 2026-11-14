import { useMemo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { HostRuleRows, LOCATION_RULE_HOST, useEntityRuleHost, type RuleHost } from '@/components/editor/ImageRuleCog';
import { useGameData } from '@/contexts/GameDataContext';
import { ownGateIds, selfLocked } from '@/lib/inPlayGates';
import { resolvedEntityStats } from '@/lib/statLinks';
import type { Entity, TraitRequirementRow } from '@/types';

/** A gate's Requirement Rows on `host`, such as an entity's or a location's Enabled gate, with an optional
 *  warning under it. */
export function HostGateField({ host, rows, onChange, label, hint, warning }: {
  host: RuleHost;
  rows: TraitRequirementRow[];
  onChange: (rows: TraitRequirementRow[]) => void;
  label: string;
  hint: ReactNode;
  warning?: ReactNode;
}) {
  return (
    <div data-host-gate="" className="space-y-2">
      <HostRuleRows host={host} rows={rows} onChange={onChange} label={label} hint={hint} />
      {warning && (
        <p role="status" data-host-gate-warning="" className="flex items-start gap-1 text-helper text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {warning}
        </p>
      )}
    </div>
  );
}

/** An entity's Enabled gate, warning when its rows read only the entity's own traits and stats (Q48). */
export function EntityEnabledField({ entity, onChange }: { entity: Entity; onChange: (entity: Entity) => void }) {
  const { stats, statGroups } = useGameData();
  const host = useEntityRuleHost(entity.id);
  const locked = useMemo(
    () => selfLocked(entity.id, entity.enabledWhen, ownGateIds(entity, resolvedEntityStats({ stats, statGroups }, entity))),
    [entity, stats, statGroups],
  );
  const rows = entity.enabledWhen ?? [];
  if (!host) return null;
  const write = (next: TraitRequirementRow[]) => {
    const { enabledWhen: _old, ...rest } = entity;
    onChange(next.length ? { ...rest, enabledWhen: next } : rest);
  };
  return (
    <HostGateField
      host={host}
      rows={rows}
      onChange={write}
      label="Enabled"
      hint="Keeps this entity on while any row holds. With no rows, it’s always on."
      warning={locked && 'These rows check only this entity’s own traits and stats, which pause while it’s off. Once it turns off, it can’t turn back on.'}
    />
  );
}

/** A location's Enabled gate. A Condition with no owner reads the played persona (Q29). */
export function LocationEnabledField({ rows, onChange }: { rows: TraitRequirementRow[]; onChange: (rows: TraitRequirementRow[]) => void }) {
  return (
    <HostGateField
      host={LOCATION_RULE_HOST}
      rows={rows}
      onChange={onChange}
      label="Enabled"
      hint="Keeps this location and the locations inside it on while any row holds. With no rows, it’s always on."
    />
  );
}

/** A location's Lock gate: the player may travel in while any row holds (Q3). A Condition with no owner reads the
 *  played persona. */
export function LocationLockField({ rows, onChange }: { rows: TraitRequirementRow[]; onChange: (rows: TraitRequirementRow[]) => void }) {
  return (
    <HostGateField
      host={LOCATION_RULE_HOST}
      rows={rows}
      onChange={onChange}
      label="Unlocked"
      hint="Lets the player travel into this location and the locations inside it while any row holds. With no rows, it’s never locked."
    />
  );
}
