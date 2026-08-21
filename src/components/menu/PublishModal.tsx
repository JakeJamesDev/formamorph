import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import WorldStorageService from "@/services/WorldStorageService";
import { type WorldRecord } from "@/components/WorldDetails";
import { KIND_LABELS } from "@/lib/catalogKinds";
import { PolicyDialog } from "@/components/menu/PolicyDialog";
import { usePublishPolicies } from "@/lib/usePublishPolicies";
import PolicyService, { TERMS_REQUIRED } from "@/services/PolicyService";
import { publishTags, type PublishPayload } from "@/lib/publishPayload";
import { remoteImagesInContent } from "@/lib/embedRemoteImages";
import { isExpiringImageHost } from "@/lib/imageBytes";
import { ContestEntryCard } from "@/components/menu/ContestEntryCard";
import { activeContestOf, entriesOf } from "@/lib/contests";
import { CONTEST_ALREADY_ENTERED, CONTEST_NOT_ACTIVE } from "@/services/WorldStorageService";
import { useContestWithdrawal } from "@/lib/useContestWithdrawal";
import { useDevEventSample } from "@/lib/useDevEventSample";
import { useDevRoute } from "@/lib/devRouter";
import { AlertTriangle } from "lucide-react";
import type { ServerEvent } from "@/types";

interface PublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  /** What to publish, built by the per-kind helpers in `lib/publishPayload`. */
  payload: PublishPayload | null;
  /** The events running right now, from the events poll. Only a contest among them is read here. */
  events?: ServerEvent[];
}

/**
 * Publish a world, character, or dictionary to the community server — as a new listing, or by replacing
 * one of the user's own. Kind-agnostic: it takes a ready payload and names itself from `payload.kind`, so
 * the mapping from each kind's fields lives in `lib/publishPayload` rather than here.
 *
 * The overwrite list is fetched per kind: your characters are never offered as targets for a world.
 */
export function PublishModal({ open, onOpenChange, isAuthenticated, payload, events = [] }: PublishModalProps) {
  const [userWorlds, setUserWorlds] = useState<WorldRecord[]>([]);
  const [selectedWorldToOverride, setSelectedWorldToOverride] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  // Whether this upload is also a contest entry, and what the server said if it refused to take it.
  const [enterContest, setEnterContest] = useState(false);
  const [contestError, setContestError] = useState('');

  const policies = usePublishPolicies(open, isAuthenticated);
  // Which popup is in the way, and what the publish was going to do once it clears.
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [tagNoticeOpen, setTagNoticeOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const kind = payload?.kind ?? 'world';
  // Pure inspection of the payload — no request, so this is right the moment the modal opens.
  const expiringCount = useMemo(
    () => (payload ? remoteImagesInContent(payload.contentData).filter(isExpiringImageHost).length : 0),
    [payload],
  );
  const noun = KIND_LABELS[kind].one.toLowerCase();

  // DEV: `#dev?view=mainMenu&modal=publish` serves a canned running contest instead of the events poll,
  // so the opt-in card is checkable without one really running (the ack modal's precedent).
  const devRoute = useDevRoute();
  const devFixture = import.meta.env.DEV && devRoute?.modal === 'publish';
  const samples = useDevEventSample(devFixture);
  const devEvents = useMemo(() => (samples ? [samples.devEventSample()] : []), [samples]);

  // Entering happens at publish time, so the opt-in belongs to a new listing only: a contest flag on an
  // overwrite would mean moving a listing that already exists into the contest, which nothing supports.
  const contest = activeContestOf(devFixture ? devEvents : events);
  const showContestCard = Boolean(contest) && kind === 'world' && selectedWorldToOverride === 'new';
  // The author's own listings are already on hand for the overwrite list, and they carry the column — so
  // an entry that would be refused is known before the upload rather than after it.
  const existingEntry = contest ? entriesOf(userWorlds, contest.id)[0] ?? null : null;
  const enteredName = existingEntry ? String(existingEntry.name ?? 'a world') : null;
  // What's open right now, readable from inside an async callback that captured an older `kind`.
  const kindRef = useRef(kind);
  kindRef.current = kind;

  // Fetch the user's listings of this kind — the only valid overwrite targets.
  const fetchUserWorlds = async () => {
    if (!isAuthenticated) return;

    try {
      const listings = await WorldStorageService.getUserWorlds(kind);
      // Only adopt a response that still matches what's open. Two publishes in quick succession (a world,
      // then a character) race: the world's slower request would otherwise resolve last and fill a
      // character dialog with worlds — every row then a wrong-kind overwrite target.
      if (kindRef.current !== kind) return;
      setUserWorlds(listings);
    } catch (error) {
      console.error('Error fetching user listings:', error);
      if (kindRef.current !== kind) return;
      setPublishError(`Failed to load your published ${KIND_LABELS[kind].many.toLowerCase()}`);
    }
  };

  // Withdrawing re-reads the listings this modal already fetched, which is what the card's preflight is
  // built from: the switch arms itself again in place, with no reopen and no reload.
  const withdrawal = useContestWithdrawal(() => { void fetchUserWorlds(); });

  /** Publish as a new listing, or replace `targetId` when given one. */
  const publish = async (targetId: string | null) => {
    if (!payload) return;
    setPublishError('');
    setContestError('');
    setIsPublishing(true);

    // Read at the upload, not captured when Publish was pressed: the upload gate can send this whole
    // path round again, and the entry has to survive that trip as surely as the target does.
    const entering = !targetId && enterContest && !enteredName && contest ? contest.id : null;

    try {
      await WorldStorageService.publishItem(payload, targetId, entering);

      // No refetch: the modal closes here and reloads its listings on the next open, so re-reading them
      // only to discard them is a round-trip the user waits on.
      onOpenChange(false);
      toast.success(`${KIND_LABELS[kind].one} ${targetId ? 'updated' : 'published'} successfully!`);
    } catch (error) {
      // The gate can be raised, or an acceptance reset, after this modal read its policy state. The
      // server is the authority, so its refusal reopens the popup rather than showing a dead error.
      const code = (error as { code?: string }).code;

      // A contest refusal is about the switch, so it is answered where the switch is — the card keeps the
      // contest's name beside it, and losing the whole publish to a toast would take that with it.
      if (code === CONTEST_ALREADY_ENTERED || code === CONTEST_NOT_ACTIVE) {
        setContestError((error as Error).message || 'This contest is not taking entries.');
        setEnterContest(false);
        return;
      }

      if (code === TERMS_REQUIRED) {
        await policies.refresh();
        policies.reopen();
        setPendingTarget(targetId);
        setShowGate(true);
        return;
      }

      setPublishError((error as Error).message || `Failed to publish ${noun}`);
    } finally {
      setIsPublishing(false);
    }
  };

  /**
   * Everything between pressing Publish and the upload: the gate first if it applies, then the tag
   * notice, then the publish itself.
   */
  const withTagNotice = async (targetId: string | null) => {
    if (!payload || !policies.tagNotice) return publish(targetId);

    try {
      const matched = await PolicyService.matchTags(publishTags(payload));
      if (matched.length > 0) {
        setPendingTarget(targetId);
        setTagNoticeOpen(true);
        return;
      }
    } catch (error) {
      // Advisory only — a failed check must never stop a publish the server would have allowed.
      console.error('Failed to check publish tags:', error);
    }

    return publish(targetId);
  };

  const handlePublish = () => {
    const targetId = selectedWorldToOverride && selectedWorldToOverride !== 'new' ? selectedWorldToOverride : null;

    if (policies.gateBlocks) {
      setPendingTarget(targetId);
      setShowGate(true);
      return;
    }

    return withTagNotice(targetId);
  };

  const handleGateAccept = async () => {
    setIsAccepting(true);
    try {
      await policies.accept();
      setShowGate(false);
      await withTagNotice(pendingTarget);
    } catch (error) {
      setPublishError((error as Error).message || 'Failed to record your acceptance');
      setShowGate(false);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleGateDecline = () => {
    policies.decline();
    setShowGate(false);
  };

  // Load the user's listings when the publish modal is opened, or when the kind changes under it.
  useEffect(() => {
    if (!open) return;
    // Reset before the fetch, not after it. The modal is mounted for the app's lifetime, so its state
    // outlives a close: a target picked for a previous publish would otherwise still be selected — and
    // selectable — until the network resolved, or forever if it failed. Publishing in that window PUT the
    // new content over the old target, across kinds.
    setSelectedWorldToOverride('new');
    setUserWorlds([]);
    setPublishError('');
    setEnterContest(false);
    setContestError('');
    fetchUserWorlds();
    // Fetch only when the modal opens, auth changes, or the kind changes — not on fetchUserWorlds identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated, kind]);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Bounded height + a scrolling middle: the list grows with every world the author has published,
          and an unbounded dialog would grow out of the viewport (it's centered) taking the Publish button
          with it, unreachable. Header and footer stay put; only the options scroll. */}
      <DialogContent className="sm:max-w-[500px] max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Publish {KIND_LABELS[kind].one}</DialogTitle>
          <DialogDescription>
            Publish your {noun} to share it with other players.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="py-4 pr-3">
            {publishError && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-label text-destructive">
                {publishError}
              </div>
            )}

            {policies.showBlockedNotice && (
              <div className="mb-4 p-3 bg-muted border rounded-md text-label">
                <p className="font-medium">{policies.gate?.title}</p>
                <p className="text-muted-foreground mt-1">
                  You declined these terms, so publishing is unavailable.
                </p>
                <Button
                  variant="link"
                  className="px-0 h-auto mt-1"
                  onClick={() => { policies.reopen(); setShowGate(true); }}
                >
                  Review the terms
                </Button>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-label font-medium">Select Publish Option</h3>

              <RadioGroup value={selectedWorldToOverride ?? undefined} onValueChange={setSelectedWorldToOverride}>
                {/* Publish as new option */}
                <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent">
                  <RadioGroupItem value="new" id="publish-new" />
                  <div className="grid gap-1">
                    <Label htmlFor="publish-new">Publish as new {noun}</Label>
                  </div>
                </div>

                {/* Existing worlds */}
                {userWorlds.length > 0 && (
                  <>
                    <div className="mt-4 mb-2">
                      <h4 className="text-label font-medium">Or update existing {noun}:</h4>
                    </div>

                    {userWorlds.map(world => {
                      // Get the ID (server uses _id)
                      const worldId = world._id || world.id;

                      // Create a unique ID for the radio item
                      const radioId = `world-${worldId}`;

                      // Extract the first 5 characters of the ID for display
                      const shortId = worldId ? worldId.substring(0, 5) : '';

                      // Get download count
                      const downloads = world.downloads || 0;

                      return (
                        <div key={worldId} className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent">
                          <RadioGroupItem value={worldId} id={radioId} />
                          <div className="grid gap-1">
                            <Label htmlFor={radioId}>
                              {world.name} ({shortId}, {downloads} downloads)
                            </Label>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </RadioGroup>
            </div>

            {/* Hidden rather than disabled when there is no contest, this isn't a world, or an existing
                listing is being replaced — a control nobody can use explains nothing. */}
            {showContestCard && contest && (
              <ContestEntryCard
                contest={contest}
                checked={enterContest}
                onCheckedChange={setEnterContest}
                enteredName={enteredName}
                onWithdraw={existingEntry
                  ? () => withdrawal.ask({ id: String(existingEntry._id || existingEntry.id), name: enteredName ?? 'That world' })
                  : undefined}
                withdrawing={withdrawal.busy}
                error={contestError || null}
              />
            )}
          </div>
        </ScrollArea>

        {/* Warn, don't block: the author may know, or may be publishing a draft. But this is the one moment
            the breakage lands on other people, so it says so plainly rather than only badging the editor. */}
        {expiringCount > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-label">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-500" />
            <p>
              {expiringCount === 1 ? 'One image uses' : `${expiringCount} images use`} a Discord link that will
              stop working. Anyone who downloads this will see {expiringCount === 1 ? 'it' : 'them'} disappear.
            </p>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancel
          </Button>

          <Button
            onClick={handlePublish}
            disabled={isPublishing || !payload || policies.showBlockedNotice}
          >
            {isPublishing ? 'Publishing...' : showContestCard && enterContest ? 'Publish & Enter' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {/* Siblings of the publish dialog, not children of it. Nested inside its root, a closed popup
          never finished unmounting — both dialogs sat at `data-state="closed"` and stayed on screen. */}
      {policies.gate && (
        <PolicyDialog
          open={showGate}
          title={policies.gate.title}
          body={policies.gate.body}
          confirmLabel="Accept"
          cancelLabel="Decline"
          busy={isAccepting}
          onConfirm={handleGateAccept}
          onCancel={handleGateDecline}
        />
      )}

      {policies.tagNotice && (
        <PolicyDialog
          open={tagNoticeOpen}
          title={policies.tagNotice.title}
          body={policies.tagNotice.body}
          confirmLabel="Continue"
          cancelLabel="Cancel"
          busy={isPublishing}
          onConfirm={() => { setTagNoticeOpen(false); publish(pendingTarget); }}
          // Backing out abandons this upload only — nothing is blocked and the acceptance stands.
          onCancel={() => setTagNoticeOpen(false)}
        />
      )}

      {withdrawal.dialog}
    </>
  );
}
