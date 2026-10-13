import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { updateOwnedStat } from '@/lib/ownedStats';
import { planCodeRename, type CodeRenamePlan, type RenameRoot } from '@/lib/statCodeRename';
import { setStatLinkCode, withStatLinks } from '@/lib/statLinks';
import { traitHolders } from '@/lib/statCodeTraits';
import { boxCode, CODE_FIELD, STAT_CODE_TIMINGS, type StatCodeTiming } from '@/lib/statCodeTiming';
import type { StatLink } from '@/types';
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
const NOUNS: Record<RenameRoot, string> = { stats: 'stat', placeholders: 'placeholder', traits: 'trait' };

/** What the dialog calls the thing that was renamed. An owner of placeholders is reached through the
 *  `placeholders` map but is an entity or a dictionary. "Placeholder" would name the wrong row. */
const renamedNoun = (plan: CodeRenamePlan) =>
  (plan.subject && plan.subject.kind !== 'placeholder' ? plan.subject.kind : NOUNS[plan.root]);

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The question the dialog asks: whose code names the old name, how often, and what it would become. */
const renameQuestion = (plan: CodeRenamePlan) =>
  `The code of ${plan.edits.length} ${plural(plan.edits.length, 'stat', 'stats')} names the `
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
  const updateStat = world?.updateStat;
  const editEntity = world?.editEntity;
  // A queue, because one Replace All can rename several things at once. Requests are held rather than
  // plans: each answer rewrites code the next request has to read, so a plan is built only once its
  // request reaches the front.
  const [queue, setQueue] = useState<CodeRenameRequest[]>([]);

  const pending = useMemo(() => {
    for (let i = 0; i < queue.length; i += 1) {
      const { traitId, ...request } = queue[i];
      const holders = traitId === undefined ? undefined
        : traitHolders({ traits, traitGroups, entities }, placeholders.list, traitId);
      const plan = planCodeRename({
        ...request, stats, statGroups, traits, entities, dictionaries, placeholders, traitHolders: holders,
      });
      if (plan) return { plan, through: i };
    }
    return null;
  }, [queue, stats, statGroups, traits, traitGroups, entities, dictionaries, placeholders]);
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
  const latest = useRef({ stats, updateStat, editEntity });
  latest.current = { stats, updateStat, editEntity };

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
    const { stats: worldStats, updateStat: write, editEntity: edit } = latest.current;
    const byId = new Map(worldStats.map((stat) => [stat.id, stat]));
    // The Blueprint boxes this rename rewrites, so a link's snapshot of them moves with them.
    const blueprintAfter = new Map(plan.edits.flatMap(({ home, boxes }) => (home.kind === 'stat' ? [[home.statId, boxes]] : [])));
    for (const { home, boxes } of plan.edits) {
      // Only the boxes the plan rewrote, so a box the rename never read keeps whatever it holds.
      const fields = Object.fromEntries(
        Object.entries(boxes).map(([timing, code]) => [CODE_FIELD[timing as StatCodeTiming], code]),
      );
      if (home.kind === 'stat') {
        const stat = byId.get(home.statId);
        if (stat && write) write({ ...stat, ...fields });
      } else if (home.kind === 'entity') {
        edit?.(home.entityId, (entity) => {
          const stat = entity.stats?.find((entry) => entry.id === home.statId);
          return stat ? updateOwnedStat(entity, { ...stat, ...fields }) : entity;
        });
      } else {
        const original = byId.get(home.statId);
        if (!original) continue;
        const rewrite = (link: StatLink) => STAT_CODE_TIMINGS.reduce((next, timing) => {
          const code = boxes[timing];
          const before = boxCode(original, timing);
          const after = blueprintAfter.get(home.statId)?.[timing] ?? before;
          return code === undefined ? next : setStatLinkCode(next, home.statId, CODE_FIELD[timing], code, before, after);
        }, link);
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
