import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PanelCrashCardProps {
  onViewDetails: () => void;
  onTryAgain: () => void;
}

/** The card a crashed editor panel shows in its own place. The rest of the editor stays live. */
export function PanelCrashCard({ onViewDetails, onTryAgain }: PanelCrashCardProps) {
  return (
    <div role="alert" className="flex h-full min-h-48 items-center justify-center p-3">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border bg-card p-6 text-center text-card-foreground">
        <TriangleAlert className="h-8 w-8 text-warning" aria-hidden />
        <h2 className="text-title font-semibold">This Panel Stopped Working</h2>
        <p className="text-muted-foreground">
          Your unsaved edits are kept. Try again, or view the details to report the problem.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={onViewDetails}>View Details</Button>
          <Button onClick={onTryAgain}>Try Again</Button>
        </div>
      </div>
    </div>
  );
}
