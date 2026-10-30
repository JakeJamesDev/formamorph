import type { DiscoveredEntity } from '@/types';
import type { SearchTarget } from '@/lib/worldSearch';

/** The text fields of an entity in the Game Editor, with their captions, in panel order. */
const TEXT_FIELDS = [
  ['name', 'Name'], ['pronouns', 'Pronouns'], ['playerDescription', 'Player-Facing Description'],
  ['aiDescription', 'AI-Facing Description'], ['aiSummary', 'AI-Facing Summary'],
] as const;

type TextField = (typeof TEXT_FIELDS)[number][0];

/** The panel tab that holds a search target's field. */
export function gameEntityTabFor(fieldKey: string): 'profile' | 'descriptions' {
  if (fieldKey === 'playerDescription' || fieldKey === 'aiDescription' || fieldKey === 'aiSummary') return 'descriptions';
  return 'profile';
}

export interface GameSearchSources {
  /** The entities as the editor shows them, the played one left out. */
  entities: readonly DiscoveredEntity[];
  onEntity: (record: DiscoveredEntity) => void;
}

/** Every text the Game Editor can find and replace: each entity's fields and its aliases. */
export function gameSearchTargets(src: GameSearchSources): SearchTarget[] {
  const out: SearchTarget[] = [];
  const fieldsOf = (
    itemId: string, itemLabel: string, fields: Partial<Record<TextField, string>> & { aliases?: string[] },
    commit: (patch: Record<string, unknown>) => void,
  ) => {
    const itemKey = `entity:${itemId}`;
    const record = { ...fields };
    const base = { itemKey, record, tab: 'entities', itemId, itemLabel, chipCapable: false };
    for (const [key, label] of TEXT_FIELDS) {
      const value = fields[key];
      if (!value) continue;
      const applyTo = (rec: object, next: string) => ({ ...rec, [key]: next });
      out.push({
        ...base, fieldKey: key, fieldLabel: label, inChipList: false, value, applyTo,
        commit: (rec) => commit(rec as Record<string, unknown>),
        write: (next) => commit(applyTo(record, next)),
      });
    }
    (fields.aliases ?? []).forEach((alias, i) => {
      const applyTo = (rec: object, next: string) => {
        const list = [...((rec as { aliases?: string[] }).aliases ?? [])];
        list[i] = next;
        return { ...rec, aliases: list };
      };
      out.push({
        ...base, fieldKey: `aliases[${i}]`, fieldLabel: 'Aliases', inChipList: true, value: alias, applyTo,
        commit: (rec) => commit(rec as Record<string, unknown>),
        write: (next) => commit(applyTo(record, next)),
      });
    });
  };
  for (const d of src.entities) {
    fieldsOf(d.entity.id, d.entity.name, d.entity, (patch) => src.onEntity({ ...d, entity: { ...d.entity, ...patch } }));
  }
  return out;
}
