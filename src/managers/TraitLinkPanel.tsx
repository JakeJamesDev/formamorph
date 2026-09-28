import type { ReactNode } from 'react';
import { Link2 } from 'lucide-react';
import { originalsOf, useTraitStore } from '@/contexts/TraitStoreContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Hint } from '@/components/ui/typography';
import { Section } from '@/components/SettingsRows';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { describePlaceholders } from '@/lib/placeholders';
import { linkPinRows, pinValueOf } from '@/lib/placeholderPins';
import { linkDefaultTraits, originalPath, setLinkDefault, setLinkPinValue } from '@/lib/traitLinks';
import { CUSTOM_PERSONA_ID, hasStatEffects } from '@/lib/traitTree';
import { useEditBearer } from './useEditBearer';
import type { Entity, TraitLink, TraitLinkPinValue } from '@/types';

const NO_VALUE = '__none__';

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
 * The link's own settings below its original's Details: default-on for each trait the row brings, the
 * value for each bearer-relative pin those traits carry, and a note when its stat effects apply only while
 * the player plays as the entity, or never. Custom Persona's links are the player's, so they get no note.
 */
export function ThisLinkSection({ entity, link, originalId }: { entity: Entity; link: TraitLink; originalId: string }) {
  const store = useTraitStore();
  const { placeholders, placeholderOwners } = store;
  const editBearer = useEditBearer();
  const persona = entity.id === CUSTOM_PERSONA_ID;
  const defaultHint = persona ? 'Selected when a new game starts' : 'Selected for this entity when a new game starts';
  const rows = linkDefaultTraits(originalsOf(store), link, originalId);
  const single = rows.length === 1 && rows[0].trait.id === originalId;
  const hasStats = !persona && rows.some(({ trait: t }) => hasStatEffects(t));
  const set = (traitId: string, on: boolean) => editBearer(entity.id, (e) => setLinkDefault(e, link.id, traitId, on));
  // A root entity's fallback targets are its world's placeholders, not its own carried pool.
  const pinTargets = store.entityRoot?.world ? [...store.entityRoot.world.placeholders] : placeholders;
  const pinRows = linkPinRows({ placeholders: pinTargets, placeholderOwners }, rows.map((r) => r.trait), link, persona ? [] : entity.placeholders ?? []);
  const setPin = (traitId: string, name: string, value: TraitLinkPinValue | null) =>
    editBearer(entity.id, (e) => setLinkPinValue(e, link.id, traitId, name, value));

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
      {pinRows.length > 0 && (
        <ul className="space-y-2" aria-label="Pinned Values">
          {pinRows.map(({ trait: t, name, target, value }) => {
            const listed = target.values.some((v) => v.text === value?.value);
            return (
              <li key={`${t.id}:${name}`} className="flex items-center gap-2">
                <span className="min-w-0 shrink truncate text-label">
                  {!single && <><PlaceholderText text={t.name} placeholders={placeholders} />: </>}
                  {name} →
                </span>
                <Select
                  value={value?.value ?? NO_VALUE}
                  onValueChange={(text) => {
                    const valueId = target.values.find((v) => v.text === text)?.id;
                    setPin(t.id, name, text === NO_VALUE ? null : pinValueOf({ value: text, valueId }));
                  }}
                >
                  <SelectTrigger className="min-w-0 flex-1" aria-label={`${name} Value`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VALUE}>No Value</SelectItem>
                    {target.values.map((v) => (
                      <SelectItem key={v.id} value={v.text}>{describePlaceholders(v.text, placeholders)}</SelectItem>
                    ))}
                    {value && !listed && <SelectItem value={value.value}>{describePlaceholders(value.value, placeholders)}</SelectItem>}
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
      )}
      {hasStats && (
        <Hint>{entity.persona ? 'Stat changes apply only when you play as them' : "Stat changes don't apply to entities"}</Hint>
      )}
    </Section>
  );
}
