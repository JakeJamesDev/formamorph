import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import PolicyService from "@/services/PolicyService";
import { setUploadTermsDeclined } from "@/lib/uploadTermsDeclined";
import type { UploadGateState } from "@/types";

interface TermsTabProps {
  /** Whether the tab is visible; the gate is only fetched while it is. */
  active: boolean;
  /** Called after accepting or declining, so the host can re-check whether the tab still applies. */
  onAnswered?: () => void;
}

/**
 * Profile → Terms. The contributor terms, and the decision on them.
 *
 * Unlike the publish-time popup this interrupts nothing, so it stays available after answering: the
 * reader is bound by what they accepted and has to be able to look it up.
 */
export function TermsTab({ active, onAnswered }: TermsTabProps) {
  const [gate, setGate] = useState<UploadGateState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Set when this session declined here, so the note explains what that cost without a refetch.
  const [justDeclined, setJustDeclined] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const state = await PolicyService.fetchPolicies();
      setGate(state.uploadGate);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load the terms');
      setGate(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const answer = async (accepted: boolean) => {
    setIsSaving(true);
    try {
      if (accepted) {
        await PolicyService.acceptUploadGate();
        setGate((prev) => (prev ? { ...prev, accepted: true } : prev));
        setJustDeclined(false);
      } else {
        await PolicyService.declineUploadGate();
        setJustDeclined(true);
      }

      // The publish flow reads this to decide between the full terms and its short blocked notice. Left
      // stale, accepting here would still be met with "you declined these terms" the next time they
      // tried to publish.
      setUploadTermsDeclined(!accepted);
      onAnswered?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to record your answer');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !gate) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!gate) {
    return <p className="py-8 text-center text-sm text-muted-foreground">There are no terms to show.</p>;
  }

  return (
    <div className="py-4 space-y-4 min-w-0">
      <div>
        <h3 className="font-medium">{gate.title}</h3>
        {gate.accepted && <p className="text-xs text-success">You have accepted these terms.</p>}
      </div>

      <div className="text-sm min-w-0"><MarkdownRenderer text={gate.body} /></div>

      {gate.accepted ? (
        <p className="text-sm text-muted-foreground">
          Publishing is open to you. If the terms change you&apos;ll be asked to accept the new wording.
        </p>
      ) : (
        <div className="space-y-3 rounded-md border p-4">
          {justDeclined ? (
            <p className="text-sm text-muted-foreground">
              You declined these terms, so publishing stays unavailable. You can accept them here whenever
              you change your mind &mdash; nothing else about your account is affected.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Accepting is only needed to publish worlds, characters or dictionaries. Everything else works
              either way.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => answer(true)} disabled={isSaving}>
              <Check className="mr-2 h-4 w-4" /> Accept
            </Button>
            {!justDeclined && (
              <Button size="sm" variant="outline" onClick={() => answer(false)} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" /> Decline
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
