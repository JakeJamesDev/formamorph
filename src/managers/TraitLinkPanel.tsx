import { Link2 } from 'lucide-react';
import { useTraitStore } from '@/contexts/TraitStoreContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Hint } from '@/components/ui/typography';
import { Section } from '@/components/SettingsRows';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { linkDefaultTraits, originalPath, setLinkDefault } from '@/lib/traitLinks';
import { CUSTOM_PERSONA_ID, hasStatEffects } from '@/lib/traitTree';
import { useEditBearer } from './useEditBearer';
import type { Entity, TraitLink } from '@/types';

/** The line above a link's original: where the original lives, and that an edit reaches every link. */
export function LinkedFromLine({ originalId, onOpen }: { originalId: string; onOpen: (id: string) => void }) {
  const { traits, traitGroups, placeholders } = useTraitStore();
  const path = originalPath({ traits, traitGroups }, originalId).join(' › ');
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed p-2">
      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-label">
        Linked from{' '}
        <button
          type="button"
          className="font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={() => onOpen(originalId)}
        >
          <PlaceholderText text={path} placeholders={placeholders} />
        </button>
        . Edits change every link.
      </p>
    </div>
  );
}

/**
 * The link's own settings below its original's Details: default-on for each trait the row brings, and a
 * note when its stat effects apply only while the player plays as the entity, or never. Custom Persona's
 * links are the player's, so they get no note.
 */
export function ThisLinkSection({ entity, link, originalId }: { entity: Entity; link: TraitLink; originalId: string }) {
  const { traits, traitGroups, placeholders } = useTraitStore();
  const editBearer = useEditBearer();
  const persona = entity.id === CUSTOM_PERSONA_ID;
  const defaultHint = persona ? 'Selected when a new game starts' : 'Selected for this entity when a new game starts';
  const rows = linkDefaultTraits({ traits, traitGroups }, link, originalId);
  const single = rows.length === 1 && rows[0].trait.id === originalId;
  const hasStats = !persona && rows.some(({ trait: t }) => hasStatEffects(t));
  const set = (traitId: string, on: boolean) => editBearer(entity.id, (e) => setLinkDefault(e, link.id, traitId, on));

  return (
    <Section title="This Link">
      {single ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={rows[0].on} onCheckedChange={(c) => set(originalId, c === true)} />
          <span>Enabled by Default</span>
          <Hint as="span">{defaultHint}</Hint>
        </label>
      ) : rows.length > 0 && (
        <div className="space-y-2">
          <div>
            <p className="text-label">Enabled by Default</p>
            <Hint>{defaultHint}</Hint>
          </div>
          <ul className="space-y-1" aria-label="Enabled by Default">
            {rows.map(({ trait: t, on }) => (
              <li key={t.id}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={on} onCheckedChange={(c) => set(t.id, c === true)} />
                  <PlaceholderText text={t.name} placeholders={placeholders} />
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasStats && (
        <Hint>{entity.persona ? 'Stat changes apply only when you play as them' : "Stat changes don't apply to entities"}</Hint>
      )}
    </Section>
  );
}
