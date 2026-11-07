import { FolderInput } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hint, Meta } from '@/components/ui/typography';
import { SurfaceTab } from '@/components/ui/surface';
import { writesOf, type CategoryPlan, type CategoryResult, type MergeProgress } from '@/lib/profileMerge/engine';
import { formatModelSize } from '@/lib/localModels';
import { SETTINGS_KEY } from '@/lib/profileMerge/settings';
import type { ProfileMergeView } from './profileMergeView';

interface ProfileMergeDialogProps {
  /** Null keeps the dialog closed. */
  view: ProfileMergeView | null;
  onMerge: () => void;
  onNotNow: () => void;
  onDecline: () => void;
  onDone: () => void;
  /** Relaunches the app so it reads the settings the merge copied. */
  onRestart?: () => void;
}

/** Whether the merge copied a settings key: the app reads those once at load. */
const copiedSettings = (results: CategoryResult[]) => results.some((result) => result.key === SETTINGS_KEY && result.added > 0);

const counts = (parts: [number, string, string][]) =>
  parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`).join(' · ');

function OfferRows({ plans }: { plans: CategoryPlan[] }) {
  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {plans.filter((plan) => plan.add.length + plan.replace.length + plan.keep.length > 0).map((plan) => (
        <li key={plan.key} className="flex items-baseline justify-between gap-4 px-3 py-2">
          <span className="font-medium">{plan.label}</span>
          <Meta>
            {counts([
              [plan.add.length, 'new', 'new'],
              [plan.replace.length, 'replaces yours', 'replace yours'],
              [plan.keep.length, 'kept', 'kept'],
            ])}
          </Meta>
        </li>
      ))}
    </ul>
  );
}

function RunRows({ plans, progress }: { plans: CategoryPlan[]; progress: Record<string, MergeProgress> }) {
  return (
    <ul className="flex flex-col gap-3">
      {plans.filter((plan) => writesOf(plan).length > 0).map((plan) => {
        const at = progress[plan.key];
        const total = at?.total ?? writesOf(plan).length;
        const done = at?.done ?? 0;
        const percent = total ? Math.round((done / total) * 100) : 0;
        return (
          <li key={plan.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{plan.label}</span>
              <Meta>{plan.unit === 'items' ? `${done} of ${total}` : `${formatModelSize(done)} of ${formatModelSize(total)}`}</Meta>
            </div>
            <Progress value={percent} className="h-2" aria-label={`${plan.label} merged`} />
          </li>
        );
      })}
    </ul>
  );
}

function ResultRows({ results }: { results: CategoryResult[] }) {
  const skipped = results.flatMap((result) => result.skipped.map((item) => ({ ...item, category: result.label })));
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-md border">
        {results.filter((result) => result.added + result.replaced + result.kept + result.skipped.length > 0).map((result) => (
          <li key={result.key} className="flex items-baseline justify-between gap-4 px-3 py-2">
            <span className="font-medium">{result.label}</span>
            <Meta>
              {counts([
                [result.added, 'added', 'added'],
                [result.replaced, 'replaced', 'replaced'],
                [result.kept, 'kept', 'kept'],
                [result.skipped.length, 'not merged', 'not merged'],
              ])}
            </Meta>
          </li>
        ))}
      </ul>
      {skipped.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Hint>These items weren&apos;t merged:</Hint>
          <ScrollArea className="max-h-40 rounded-md border">
            <ul className="flex flex-col gap-1 p-3">
              {skipped.map((item, index) => (
                <li key={`${item.category}-${index}`} className="text-label">
                  <span className="font-medium">{item.label}</span>{' '}
                  <Meta>({item.category}): {item.reason}</Meta>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

/** The offer, the locked run, and the result of merging the AppData profile into the folder's profile. */
export function ProfileMergeDialog({ view, onMerge, onNotNow, onDecline, onDone, onRestart }: ProfileMergeDialogProps) {
  const running = view?.step === 'run';
  const needsRestart = !!onRestart && view?.step === 'result' && !view.error && copiedSettings(view.results);
  const handleOpenChange = (open: boolean) => {
    if (open || !view || running) return;
    if (view.step === 'offer') onNotNow();
    else onDone();
  };
  const blockWhileRunning = (event: Event) => {
    if (running) event.preventDefault();
  };

  return (
    <Dialog open={!!view} onOpenChange={handleOpenChange}>
      <DialogContent
        surface="profileMerge"
        className="sm:max-w-lg"
        hideClose={running}
        onEscapeKeyDown={blockWhileRunning}
        onInteractOutside={blockWhileRunning}
        data-merge-step={view?.step}
      >
        <SurfaceTab ledger="profileMerge" tab={view?.step} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-4 w-4" />
            {view?.step === 'offer' && 'Merge Your Other Data'}
            {view?.step === 'run' && 'Merging Your Data'}
            {view?.step === 'result' && (view.error ? 'Merge Stopped' : 'Merge Finished')}
          </DialogTitle>
          <DialogDescription>
            {view?.step === 'offer' &&
              'You have data from an earlier start of Formamorph in another folder. Merge copies it here. Where both copies hold an item, the newer one stays. Nothing is deleted.'}
            {view?.step === 'run' && 'Keep Formamorph open until the merge finishes.'}
            {view?.step === 'result' &&
              (view.error
                ? `The merge stopped: ${view.error}. You'll be asked again the next time you start Formamorph.`
                : needsRestart
                  ? 'Your data is merged. Restart Formamorph to use the settings that came over.'
                  : 'Your data is merged.')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {view?.step === 'offer' && <OfferRows plans={view.plans} />}
          {view?.step === 'run' && <RunRows plans={view.plans} progress={view.progress} />}
          {view?.step === 'result' && <ResultRows results={view.results} />}
        </div>

        {view?.step === 'offer' && (
          <DialogFooter>
            <Button variant="ghost" className="sm:mr-auto" onClick={onDecline}>
              Don&apos;t Merge
            </Button>
            <Button variant="outline" onClick={onNotNow}>
              Not Now
            </Button>
            <Button onClick={onMerge}>Merge</Button>
          </DialogFooter>
        )}
        {view?.step === 'result' && (
          <DialogFooter>
            {needsRestart ? (
              <>
                <Button variant="outline" onClick={onDone}>Done</Button>
                <Button onClick={onRestart}>Restart</Button>
              </>
            ) : (
              <Button onClick={onDone}>Done</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
