import { useMemo, type ReactNode } from 'react';
import { Link2, Pencil } from 'lucide-react';
import { originalsOf, useTraitStore } from '@/contexts/TraitStoreContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Hint } from '@/components/ui/typography';
import { Section } from '@/components/SettingsRows';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { BlueprintFooter, FieldReset, LabelRow } from '@/components/editor/BlueprintReset';
import { effectiveLinkTrait, linkTraitState } from '@/lib/blueprints';
import { editLinkTrait, linkedTraits, originalPath, resetLink, resetLinkField, resetLinkTrait, setLinkField } from '@/lib/traitLinks';
import { labelPlaceholders } from '@/lib/placementLetters';
import { hasStatEffects } from '@/lib/traitTree';
import type { LinkRow } from '@/lib/traitTree';
import type { Entity, Trait, TraitLink } from '@/types';
import TraitManager, { BearerStatNote, type TraitLinkEdit } from './TraitManager';

/** The line above a link's original: where the original lives. */
export function LinkedFromLine({ originalId }: { originalId: string }) {
  const store = useTraitStore();
  const path = originalPath(originalsOf(store), originalId).join(' › ');
  return (
    <LinkNotice>
      Linked from <strong><PlaceholderText text={path} placeholders={store.placeholders} /></strong>
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

/** The Enabled by Default hint on a link: the Custom Persona entity's links are the player's. */
const defaultHintFor = (bearer: Entity) =>
  (bearer.customPersona ? 'Selected when a new game starts' : 'Selected for this entity when a new game starts');

/** The bearer's stat note on a link that brings stat effects. */
function LinkStatNote({ bearer, traits }: { bearer: Entity; traits: readonly Trait[] }) {
  return traits.some(hasStatEffects) ? <BearerStatNote bearer={bearer} /> : null;
}

/**
 * The trait panel for one trait a link brings, as that link reads it. Edits write the link's overrides on the
 * bearer; the original is untouched.
 */
export function LinkedTraitManager({ bearer, link, original, ...panel }: {
  bearer: Entity;
  link: TraitLink;
  original: Trait;
} & Omit<Parameters<typeof TraitManager>[0], 'trait' | 'owner' | 'link' | 'detailsHeader' | 'availabilityFooter'>) {
  const store = useTraitStore();
  const { editEntity } = store;
  const originals = originalsOf(store);
  const trait = useMemo(() => effectiveLinkTrait(original, link), [original, link]);
  const { overridden, stale } = useMemo(() => linkTraitState(original, link), [original, link]);
  const edit: TraitLinkEdit = {
    bearerId: bearer.id,
    overridden,
    stale,
    write: (next) => editEntity(bearer.id, (e) => editLinkTrait(originals, e, link.id, original.id, next)),
    reset: (field) => editEntity(bearer.id, (e) => resetLinkField(e, link.id, original.id, field)),
    defaultHint: defaultHintFor(bearer),
  };
  return (
    <TraitManager
      {...panel}
      trait={trait}
      link={edit}
      detailsHeader={<LinkedFromLine originalId={original.id} />}
      availabilityFooter={<LinkStatNote bearer={bearer} traits={[trait]} />}
    />
  );
}

/**
 * A linked group's own settings below its original's Details: default-on for each trait the row brings,
 * written as this link's override with a Reset while overridden, and the stat note.
 */
export function ThisLinkSection({ entity, link, originalId }: { entity: Entity; link: TraitLink; originalId: string }) {
  const store = useTraitStore();
  const { placeholders, editEntity } = store;
  const originals = originalsOf(store);
  const rows = linkedTraits(originals, link, originalId);
  const set = (traitId: string, on: boolean) => editEntity(entity.id, (e) => setLinkField(originals, e, link.id, traitId, 'isDefault', on));
  const reset = (traitId: string) => editEntity(entity.id, (e) => resetLinkField(e, link.id, traitId, 'isDefault'));
  const stateOf = (traitId: string) => {
    const original = originals.traits.find((t) => t.id === traitId);
    return original ? linkTraitState(original, link) : null;
  };

  return (
    <Section title="This Link">
      {rows.length > 0 && (
        <div className="space-y-2">
          <div>
            <p className="text-label">Enabled by Default</p>
            <Hint>{defaultHintFor(entity)}</Hint>
          </div>
          <ul className="space-y-1" aria-label="Enabled by Default">
            {rows.map((t) => {
              const state = stateOf(t.id);
              return (
                <li key={t.id}>
                  <LabelRow
                    reset={state?.overridden.includes('isDefault') && (
                      <FieldReset field={`${labelPlaceholders(t.name, placeholders)} Enabled by Default`} stale={state.stale.includes('isDefault')} onReset={() => reset(t.id)} />
                    )}
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={!!t.isDefault} onCheckedChange={(c) => set(t.id, c === true)} />
                      <PlaceholderText text={t.name} placeholders={placeholders} />
                    </label>
                  </LabelRow>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <LinkStatNote bearer={entity} traits={rows} />
    </Section>
  );
}

/**
 * The footer under a selected link row. Reset to Blueprint drops every override the link holds on its own
 * row, and one trait's on a row of a linked group's subtree; a subgroup row has nothing of its own to reset.
 * `onEditBlueprint` selects the original, where the host can; `children` sit beside it.
 */
export function LinkFooter({ bearer, row, onEditBlueprint, children }: {
  bearer: Entity;
  row: LinkRow;
  onEditBlueprint?: () => void;
  children?: ReactNode;
}) {
  const store = useTraitStore();
  const { link, originalId } = row;
  const traitRow = !row.root && originalsOf(store).traits.some((t) => t.id === originalId);
  const canReset = row.root ? !!link.overrides : traitRow && !!link.overrides?.[originalId];
  const onReset = () => store.editEntity(bearer.id, (e) => (row.root ? resetLink(e, link.id) : resetLinkTrait(e, link.id, originalId)));
  const actions = (
    <>
      {children}
      {onEditBlueprint && (
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onEditBlueprint}>
          <Pencil className="h-4 w-4" aria-hidden />
          Edit Blueprint
        </Button>
      )}
    </>
  );
  if (!row.root && !traitRow) {
    return onEditBlueprint || children ? <div className="flex items-center justify-end gap-2 border-t p-3">{actions}</div> : null;
  }
  return <BlueprintFooter canReset={canReset} onReset={onReset}>{actions}</BlueprintFooter>;
}
