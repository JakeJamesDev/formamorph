import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { updateOwnedStat } from '@/lib/ownedStats';
import { updateOwnedTrait } from '@/lib/ownedTraits';
import { setTraitLinkScripts } from '@/lib/blueprints';
import { planCodeRename, type CodeRenamePlan, type RenameRoot } from '@/lib/statCodeRename';
import { setStatLinkScripts, withStatLinks } from '@/lib/statLinks';
import { traitOwnerMaps } from '@/lib/statCodeTraits';
import { scriptsOf, withScriptCode } from '@/lib/scripts';
import { withToolCode } from '@/lib/tools/worldTools';
import type { Stat, StatLink, Trait, TraitLink } from '@/types';
import { CodeRenameContext, type CodeRenameRequest, type OfferCodeRename } from '@/lib/useCodeRename';

/**
 * The offer to carry a rename into stat code, and the dialog that asks it.
 *
 * A commit is blur or Enter on a name field, or a find-and-replace pass over one. Keystrokes are not
 * commits: the offer would otherwise fire on every letter of a name being typed. A plan is built from both
 * of a stat's code boxes as they stand when the question is put, and applied through the editor's normal
 * write path, so the rename and the rewrite sit together and Discard rolls the pair back together.
 */

/** The noun each map's entries go by, for the question the dialog asks. */
const NOUNS: Record<RenameRoot, string> = { stats: 'stat', placeholders: 'placeholder', traits: 'trait', locations: 'location' };

/** What the dialog calls the thing that was renamed. An owner of placeholders is reached through the
 *  `placeholders` map but is an entity or a dictionary. "Placeholder" would name the wrong row. */
const renamedNoun = (plan: CodeRenamePlan) =>
  (plan.subject && plan.subject.kind !== 'placeholder' ? plan.subject.kind : NOUNS[plan.root]);

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Whose code the plan rewrites: its stats, its traits, the world's scripts, then its World Tools, each counted where there are any. */
function codeOwnersText(plan: CodeRenamePlan): string {
  const traits = plan.edits.filter(({ home }) => isTraitHome(home)).length;
  const stats = plan.edits.filter(({ home }) => isStatHome(home)).length;
  const world = plan.edits.find(({ home }) => home.kind === 'world');
  const scripts = world ? Object.keys(world.scripts).length : 0;
  const tools = plan.edits.filter(({ home }) => home.kind === 'tool').length;
  return [
    ...(stats ? [`${stats} ${plural(stats, 'stat', 'stats')}`] : []),
    ...(traits ? [`${traits} ${plural(traits, 'trait', 'traits')}`] : []),
    ...(scripts ? [`${scripts} world ${plural(scripts, 'script', 'scripts')}`] : []),
    ...(tools ? [`${tools} World ${plural(tools, 'Tool', 'Tools')}`] : []),
  ].join(' and ');
}

const isTraitHome = (home: CodeRenamePlan['edits'][number]['home']) =>
  home.kind === 'trait' || home.kind === 'entityTrait' || home.kind === 'traitLink';
const isStatHome = (home: CodeRenamePlan['edits'][number]['home']) =>
  home.kind === 'stat' || home.kind === 'entity' || home.kind === 'link';

/** The question the dialog asks: whose code names the old name, how often, and what it would become. */
const renameQuestion = (plan: CodeRenamePlan) =>
  `The code of ${codeOwnersText(plan)} names the `
  + `${renamedNoun(plan)} “${plan.oldName}” ${plan.references} ${plural(plan.references, 'time', 'times')}. `
  + `Update ${plural(plan.references, 'it', 'them')} to “${plan.newName}”?`;

/** Mount the offer and its dialog. Everything under it can ask through `useCodeRenameOffer`. */
export function CodeRenameProvider({ children }: { children: ReactNode }) {
  const world = useGameDataOptional();
  const stats = useMemo(() => world?.stats ?? [], [world?.stats]);
  const traits = useMemo(() => world?.traits ?? [], [world?.traits]);
  const entities = useMemo(() => world?.entities ?? [], [world?.entities]);
  const dictionaries = useMemo(() => world?.dictionaries ?? [], [world?.dictionaries]);
  const traitGroups = useMemo(() => world?.traitGroups ?? [], [world?.traitGroups]);
  const statGroups = useMemo(() => world?.statGroups ?? [], [world?.statGroups]);
  // The tree as code reads it, so a rename of one node follows every path that passes through it.
  const placeholders = useMemo(
    () => ({ list: world?.placeholders ?? [], owners: world?.placeholderOwners }),
    [world?.placeholders, world?.placeholderOwners],
  );
  const worldScripts = useMemo(() => world?.worldScripts ?? [], [world?.worldScripts]);
  const worldTools = useMemo(() => world?.worldTools ?? [], [world?.worldTools]);
  const updateStat = world?.updateStat;
  const updateTrait = world?.updateTrait;
  const editEntity = world?.editEntity;
  const setWorldScripts = world?.setWorldScripts;
  const setWorldTools = world?.setWorldTools;
  // A queue, because one Replace All can rename several things at once. Requests are held rather than
  // plans: each answer rewrites code the next request has to read, so a plan is built only once its
  // request reaches the front.
  const [queue, setQueue] = useState<CodeRenameRequest[]>([]);

  const pending = useMemo(() => {
    for (let i = 0; i < queue.length; i += 1) {
      const { traitId, ...request } = queue[i];
      const maps = traitId === undefined ? undefined
        : traitOwnerMaps({ traits, traitGroups, entities }, placeholders.list, traitId);
      const plan = planCodeRename({
        ...request, stats, statGroups, traits, traitGroups, entities, dictionaries, placeholders, worldScripts, worldTools, traitOwnerMaps: maps,
      });
      if (plan) return { plan, through: i };
    }
    return null;
  }, [queue, stats, statGroups, traits, traitGroups, entities, dictionaries, placeholders, worldScripts, worldTools]);
  const plan: CodeRenamePlan | null = pending?.plan ?? null;
  // What the dialog reads, kept past the answer: the plan goes as soon as the question is settled, and the
  // body would otherwise empty while the dialog is still animating out.
  const shown = useRef<CodeRenamePlan | null>(null);
  if (plan) shown.current = plan;

  // Requests nothing references ask nothing, so they are dropped rather than left to be rescanned.
  useEffect(() => {
    if (!pending && queue.length) setQueue([]);
  }, [pending, queue.length]);

  // Held in a ref so the callback the name fields take never changes identity.
  const latest = useRef({ stats, traits, worldScripts, worldTools, updateStat, updateTrait, editEntity, setWorldScripts, setWorldTools });
  latest.current = { stats, traits, worldScripts, worldTools, updateStat, updateTrait, editEntity, setWorldScripts, setWorldTools };

  const offer = useCallback<OfferCodeRename>((request) => {
    setQueue((waiting) => [...waiting, request]);
  }, []);

  /**
   * Drop the question just answered, and anything ahead of it nothing references.
   *
   * Keyed on the request itself rather than on its index, because answering arrives twice: Update Code runs
   * its own handler and then closes the dialog, which reports the close as well. Finding the request gone
   * makes the second call do nothing, where a second slice would swallow the next question whole.
   */
  const answered = pending ? queue[pending.through] : null;
  const settle = () => {
    if (!answered) return;
    setQueue((waiting) => {
      const at = waiting.indexOf(answered);
      return at < 0 ? waiting : waiting.slice(at + 1);
    });
  };

  const apply = () => {
    if (!plan) return;
    const {
      stats: worldStats, traits: worldTraits, worldScripts: ownScripts, worldTools: ownTools, updateStat: write, updateTrait: writeTrait,
      editEntity: edit, setWorldScripts: writeWorldScripts, setWorldTools: writeWorldTools,
    } = latest.current;
    const byId = new Map(worldStats.map((stat) => [stat.id, stat]));
    const traitById = new Map(worldTraits.map((trait) => [trait.id, trait]));
    // The Blueprint scripts this rename rewrites, so a link's snapshot of them moves with them.
    const blueprintAfter = new Map(plan.edits.flatMap(({ home, scripts }) => (home.kind === 'stat' ? [[home.statId, scripts]] : [])));
    const traitAfter = new Map(plan.edits.flatMap(({ home, scripts }) => (home.kind === 'trait' ? [[home.traitId, scripts]] : [])));
    // Only the scripts the plan rewrote, so a script the rename never read keeps whatever it holds.
    const rewritten = <T extends Stat | Trait>(item: T, scripts: Record<string, string>): T => ({ ...item, scripts: withScriptCode(scriptsOf(item), scripts) });
    for (const { home, scripts } of plan.edits) {
      if (home.kind === 'world') {
        writeWorldScripts?.(withScriptCode(ownScripts, scripts));
      } else if (home.kind === 'tool') {
        writeWorldTools?.(withToolCode(ownTools, scripts));
      } else if (home.kind === 'trait') {
        const trait = traitById.get(home.traitId);
        if (trait && writeTrait) writeTrait(rewritten(trait, scripts));
      } else if (home.kind === 'entityTrait') {
        edit?.(home.entityId, (entity) => {
          const trait = entity.traits?.find((entry) => entry.id === home.traitId);
          return trait ? updateOwnedTrait(entity, rewritten(trait, scripts)) : entity;
        });
      } else if (home.kind === 'traitLink') {
        const original = traitById.get(home.traitId);
        if (!original) continue;
        const rewrite = (link: TraitLink) => {
          const overridden = link.overrides?.[home.traitId]?.scripts?.value ?? [];
          const before = scriptsOf(original);
          const after = withScriptCode(before, traitAfter.get(home.traitId) ?? {});
          return setTraitLinkScripts(link, home.traitId, withScriptCode(overridden, scripts), before, after);
        };
        edit?.(home.entityId, (entity) => ({
          ...entity, traitLinks: (entity.traitLinks ?? []).map((link) => (link.id === home.linkId ? rewrite(link) : link)),
        }));
      } else if (home.kind === 'stat') {
        const stat = byId.get(home.statId);
        if (stat && write) write(rewritten(stat, scripts));
      } else if (home.kind === 'entity') {
        edit?.(home.entityId, (entity) => {
          const stat = entity.stats?.find((entry) => entry.id === home.statId);
          return stat ? updateOwnedStat(entity, rewritten(stat, scripts)) : entity;
        });
      } else {
        const original = byId.get(home.statId);
        if (!original) continue;
        const rewrite = (link: StatLink) => {
          const overridden = link.overrides?.[home.statId]?.scripts?.value ?? [];
          const before = scriptsOf(original);
          const after = withScriptCode(before, blueprintAfter.get(home.statId) ?? {});
          return setStatLinkScripts(link, home.statId, withScriptCode(overridden, scripts), before, after);
        };
        edit?.(home.entityId, (entity) =>
          withStatLinks(entity, (entity.statLinks ?? []).map((link) => (link.id === home.linkId ? rewrite(link) : link))));
      }
    }
    settle();
  };

  return (
    <CodeRenameContext.Provider value={offer}>
      {children}
      <CodeRenameDialog plan={shown.current} open={plan !== null} onApply={apply} onSettle={settle} />
    </CodeRenameContext.Provider>
  );
}

/** The question itself. `plan` is what the body reads, kept while the dialog animates out. */
export function CodeRenameDialog({ plan, open, onApply, onSettle }: {
  plan: CodeRenamePlan | null;
  open: boolean;
  onApply: () => void;
  onSettle: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onSettle(); }}>
      <AlertDialogContent surface="codeRename">
        <AlertDialogHeader>
          <AlertDialogTitle>Update Code References</AlertDialogTitle>
          <AlertDialogDescription>
            {plan && renameQuestion(plan)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Leave Code</AlertDialogCancel>
          <AlertDialogAction onClick={onApply}>Update Code</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
