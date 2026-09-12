import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { planCodeRename, type CodeRenamePlan, type RenameRoot } from '@/lib/statCodeRename';
import { CodeRenameContext, type CodeRenameRequest, type OfferCodeRename } from '@/lib/useCodeRename';

/**
 * The offer to carry a rename into stat code, and the dialog that asks it.
 *
 * A commit is blur or Enter on a name field, or a find-and-replace pass over one. Keystrokes are not
 * commits: the offer would otherwise fire on every letter of a name being typed. A plan is built from the
 * code as it stands when the question is put, and applied to `code` alone, so the rename and the rewrite
 * both sit in the editor's normal write path and Discard rolls the pair back together.
 */

/** The noun each map's entries go by, for the question the dialog asks. */
const NOUNS: Record<RenameRoot, string> = { stats: 'stat', placeholders: 'placeholder', traits: 'trait' };

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** The question the dialog asks: whose code names the old name, how often, and what it would become. */
const renameQuestion = (plan: CodeRenamePlan) =>
  `The code of ${plan.edits.length} ${plural(plan.edits.length, 'stat', 'stats')} names the `
  + `${NOUNS[plan.root]} “${plan.oldName}” ${plan.references} ${plural(plan.references, 'time', 'times')}. `
  + `Update ${plural(plan.references, 'it', 'them')} to “${plan.newName}”?`;

/** Mount the offer and its dialog. Everything under it can ask through `useCodeRenameOffer`. */
export function CodeRenameProvider({ children }: { children: ReactNode }) {
  const world = useGameDataOptional();
  const stats = useMemo(() => world?.stats ?? [], [world?.stats]);
  const updateStat = world?.updateStat;
  // A queue, because one Replace All can rename several things at once. Requests are held rather than
  // plans: each answer rewrites code the next request has to read, so a plan is built only once its
  // request reaches the front.
  const [queue, setQueue] = useState<CodeRenameRequest[]>([]);

  const pending = useMemo(() => {
    for (let i = 0; i < queue.length; i += 1) {
      const plan = planCodeRename({ ...queue[i], stats });
      if (plan) return { plan, through: i };
    }
    return null;
  }, [queue, stats]);
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
  const latest = useRef({ stats, updateStat });
  latest.current = { stats, updateStat };

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
    const write = latest.current.updateStat;
    const byId = new Map(latest.current.stats.map((stat) => [stat.id, stat]));
    for (const edit of plan.edits) {
      const stat = byId.get(edit.id);
      if (stat && write) write({ ...stat, code: edit.code });
    }
    settle();
  };

  return (
    <CodeRenameContext.Provider value={offer}>
      {children}
      <AlertDialog open={plan !== null} onOpenChange={(open) => { if (!open) settle(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Code References</AlertDialogTitle>
            <AlertDialogDescription>
              {shown.current && renameQuestion(shown.current)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Leave Code</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Update Code</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CodeRenameContext.Provider>
  );
}
