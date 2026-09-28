import type { ReactNode } from 'react';
import { Link2 } from 'lucide-react';
import { originalsOf, useTraitStore } from '@/contexts/TraitStoreContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Hint } from '@/components/ui/typography';
import { Section } from '@/components/SettingsRows';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { linkedTraits, originalPath, setLinkField } from '@/lib/traitLinks';
import { hasStatEffects } from '@/lib/traitTree';
import type { Entity, TraitLink } from '@/types';

/** The line above a link's original: where the original lives, and that an edit reaches every link. Without
 *  `onOpen`, the original can't be edited from here, so the line names it only. */
export function LinkedFromLine({ originalId, onOpen }: { originalId: string; onOpen?: (id: string) => void }) {
  const store = useTraitStore();
  const path = originalPath(originalsOf(store), originalId).join(' › ');
  const text = <PlaceholderText text={path} placeholders={store.placeholders} />;
  return (
    <LinkNotice>
        Linked from{' '}
        {onOpen ? (
          <>
            <button
              type="button"
              className="font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              onClick={() => onOpen(originalId)}
            >
              {text}
            </button>
            . Edits change every link.
          </>
        ) : <><strong>{text}</strong> in this world.</>}
    </LinkNotice>
  );
}

/** The dashed box with a link icon that holds a line about a link. */
export function LinkNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed p-2">
      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-label">{children}</p>
    </div>
  );
}

/**
 * The link's own settings below its original's Details: default-on for each trait the row brings, written
 * as this link's override, and a note when its stat effects apply only while the player plays as the
 * entity, or never. The Custom Persona entity's links are the player's, so they get no note.
 */
export function ThisLinkSection({ entity, link, originalId }: { entity: Entity; link: TraitLink; originalId: string }) {
  const store = useTraitStore();
  const { placeholders, editEntity } = store;
  const persona = !!entity.customPersona;
  const defaultHint = persona ? 'Selected when a new game starts' : 'Selected for this entity when a new game starts';
  const originals = originalsOf(store);
  const rows = linkedTraits(originals, link, originalId);
  const single = rows.length === 1 && rows[0].id === originalId;
  const hasStats = !persona && rows.some(hasStatEffects);
  const set = (traitId: string, on: boolean) => editEntity(entity.id, (e) => setLinkField(originals, e, link.id, traitId, 'isDefault', on));

  return (
    <Section title="This Link">
      {single ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={!!rows[0].isDefault} onCheckedChange={(c) => set(originalId, c === true)} />
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
            {rows.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={!!t.isDefault} onCheckedChange={(c) => set(t.id, c === true)} />
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
