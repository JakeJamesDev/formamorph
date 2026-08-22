import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Ban, Calendar, CheckCircle2, Clock, Loader2, Megaphone, Pencil, Plus, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { EventFormDialog } from "@/components/menu/EventFormDialog";
import { PodiumDialog } from "@/components/menu/PodiumDialog";
import {
  ADMIN_EVENT_STATE_LABELS,
  ADMIN_EVENT_STATE_STYLES,
  adminEventActions,
  adminEventState,
  adminEventSummary,
  groupAdminEvents,
} from "@/lib/adminEvents";
import { isContestEvent } from "@/lib/serverEvents";
import { formatServerDate } from "@/lib/serverDate";
import { isAdmin } from "@/lib/roles";
import { useDevEventSample } from "@/lib/useDevEventSample";
import { useDevRoute } from "@/lib/devRouter";
import { refreshActiveEvents } from "@/lib/useActiveEvents";
import { invalidateEvents } from "@/lib/eventsCache";
import AuthService from "@/services/AuthService";
import EventService from "@/services/EventService";
import type { ServerEvent } from "@/types";

interface EventsTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
}

/**
 * How many finished events the Past group shows before folding the rest behind its expander.
 *
 * Nothing is dropped — the record is permanent — but this is the group staff read straight after a
 * contest ends, and at a monthly cadence it is years deep. Ten is a screenful of the recent ones.
 */
const PAST_SHOWN = 10;

/** The badge saying which state an event is in. */
function StateBadge({ event }: { event: ServerEvent }) {
  const state = adminEventState(event);

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-meta font-semibold shrink-0', ADMIN_EVENT_STATE_STYLES[state])}>
      {ADMIN_EVENT_STATE_LABELS[state]}
    </span>
  );
}

/** The badge saying which type it is. Unknown types read as announcements, which is how they behave. */
function TypeBadge({ event }: { event: ServerEvent }) {
  const contest = isContestEvent(event);

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-meta font-semibold shrink-0">
      {contest
        ? <><Trophy className="h-3 w-3" aria-hidden /> Contest</>
        : <><Megaphone className="h-3 w-3" aria-hidden /> Announcement</>}
    </span>
  );
}

/** The heading over each of the tab's three groups. */
function GroupHeading({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <h3 className="mt-4 mb-2 flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden /> {children}
    </h3>
  );
}

/**
 * Admin Panel → Events. The calendar of timed happenings, grouped by where each one stands.
 *
 * Staff-visible rather than an administrator's, but read-only for the moderation team: everything that
 * speaks to every player at once — scheduling, editing, calling off, and announcing a contest's results —
 * is an administrator's and is hidden from the rest.
 */
export function EventsTab({ active }: EventsTabProps) {
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<ServerEvent | null>(null);
  const [judging, setJudging] = useState<ServerEvent | null>(null);
  const [canceling, setCanceling] = useState<ServerEvent | null>(null);
  const [removing, setRemoving] = useState<ServerEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);

  const devRoute = useDevRoute();
  const devFixture = import.meta.env.DEV && devRoute?.modal === 'adminPanel' && devRoute.tab === 'events';
  // DEV: `subtab=staff` shows the read-only half without a second account. A real session decides for
  // itself, and the whole branch is dead code outside DEV.
  const devRoleView = devFixture ? devRoute?.subtab : undefined;
  const viewerIsAdmin = devRoleView ? devRoleView === 'admin' : isAdmin(AuthService.getCurrentUser());

  // Every mutation lands here, so the app-wide events poll is nudged alongside the tab's own list —
  // an extended deadline reopens the publish flow's contest card now, not at the next poll. The shared
  // events cache is dropped for the same reason: a podium just announced has to reach the archive and its
  // badges in this session, not the player's next launch.
  const refresh = useCallback(() => {
    setNonce((n) => n + 1);
    refreshActiveEvents();
    invalidateEvents();
  }, []);

  useEffect(() => {
    if (!active || devFixture) return;

    let current = true;
    setLoading(true);
    EventService.fetchList()
      .then((list) => { if (current) setEvents(list); })
      .catch((error) => {
        console.error('Failed to load events:', error);
        if (current) toast.error((error as Error).message || 'Failed to load events');
      })
      .finally(() => { if (current) setLoading(false); });

    return () => { current = false; };
  }, [active, nonce, devFixture]);

  // DEV: `#dev?modal=adminPanel&tab=events` serves a canned calendar — one of each state — so the tab,
  // its three groups and both role views are checkable without a live server.
  const samples = useDevEventSample(devFixture && active);
  const devEvents = useMemo(() => (samples ? samples.devAdminEventSamples() : []), [samples]);

  const shown = devFixture ? devEvents : events;
  const stillLoading = devFixture ? samples === null : loading;
  const groups = groupAdminEvents(shown, viewerIsAdmin);
  const nothing = !stillLoading && shown.length === 0;

  const handleCancel = async () => {
    if (!canceling) return;
    setBusy(true);
    try {
      await EventService.cancel(canceling.id);
      toast.success('Event canceled');
      setCanceling(null);
      refresh();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to cancel the event');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await EventService.remove(removing.id);
      toast.success('Event deleted');
      setRemoving(null);
      refresh();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete the event');
    } finally {
      setBusy(false);
    }
  };

  const actionsFor = (event: ServerEvent) => {
    const allowed = adminEventActions(event, viewerIsAdmin);

    return (
      <div className="flex flex-wrap gap-1.5">
        {allowed.announceResults && (
          <Button size="sm" onClick={() => setJudging(event)}>
            <Trophy className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Announce Results
          </Button>
        )}
        {allowed.editPodium && (
          <Button size="sm" variant="outline" onClick={() => setJudging(event)}>
            <Trophy className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Edit Podium
          </Button>
        )}
        {allowed.edit && (
          <Button size="sm" variant="outline" onClick={() => setEditing(event)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
        )}
        {allowed.cancel && (
          <Button size="sm" variant="destructive" onClick={() => setCanceling(event)}>
            <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Cancel
          </Button>
        )}
        {allowed.remove && (
          <Button size="sm" variant="destructive" onClick={() => setRemoving(event)}>
            <X className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Delete
          </Button>
        )}
      </div>
    );
  };

  const dates = (event: ServerEvent) =>
    `${formatServerDate(event.startsAt)} – ${formatServerDate(event.endsAt)}`;

  /** A row in the Scheduled or Past group: one line of what it is, one of where it stands. */
  const eventRow = (event: ServerEvent) => (
    <div
      key={event.id}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-2.5',
        adminEventState(event) === 'canceled' && 'opacity-60',
      )}
    >
      <div className="flex-1 min-w-[12rem]">
        <div className="text-label font-medium truncate">{event.title}</div>
        <div className="text-meta text-muted-foreground truncate">
          {dates(event)} · {adminEventSummary(event)}
        </div>
      </div>

      <TypeBadge event={event} />
      <StateBadge event={event} />
      {actionsFor(event)}
    </div>
  );

  /** A card in Happening Now: the same facts, given the room that a live event earns. */
  const eventCard = (event: ServerEvent) => (
    <div key={event.id} className="rounded-lg border bg-muted/40 p-3 space-y-2 mb-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label font-semibold flex-1 min-w-[10rem] truncate">{event.title}</span>
        <TypeBadge event={event} />
        <StateBadge event={event} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" aria-hidden /> {dates(event)}</span>
        <span>{adminEventSummary(event)}</span>
      </div>

      {actionsFor(event)}
    </div>
  );

  return (
    <div className="py-4 min-w-0">
      <div className="flex items-center justify-between gap-4">
        <p className="text-helper text-muted-foreground">
          {viewerIsAdmin
            ? 'Timed events shown to every player. Starting one posts its pinned announcement automatically.'
            : 'Timed events shown to every player. Scheduling, editing and announcing results are an administrator’s.'}
        </p>

        {viewerIsAdmin && (
          <Button size="sm" className="shrink-0" onClick={() => setComposing(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden /> New Event
          </Button>
        )}
      </div>

      {stillLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-label text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading events…
        </div>
      )}

      {nothing && (
        <p className="py-12 text-center text-label text-muted-foreground">
          {viewerIsAdmin
            ? 'No events yet. Schedule one to put a banner in front of every player.'
            : 'No events yet.'}
        </p>
      )}

      {!stillLoading && shown.length > 0 && (
        <>
          <GroupHeading icon={Clock}>Happening Now</GroupHeading>
          {groups.happeningNow.length > 0
            ? groups.happeningNow.map(eventCard)
            : <p className="text-meta text-muted-foreground">Nothing is running right now.</p>}

          <GroupHeading icon={Calendar}>Scheduled</GroupHeading>
          {groups.scheduled.length > 0
            ? groups.scheduled.map(eventRow)
            : <p className="text-meta text-muted-foreground">Nothing is scheduled.</p>}

          <GroupHeading icon={CheckCircle2}>Past</GroupHeading>
          {groups.past.length > 0
            ? (showAllPast ? groups.past : groups.past.slice(0, PAST_SHOWN)).map(eventRow)
            : <p className="text-meta text-muted-foreground">Nothing has finished yet.</p>}
          {groups.past.length > PAST_SHOWN && (
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowAllPast((shown) => !shown)}>
              {showAllPast
                ? 'Show Fewer'
                : `Show Older (${groups.past.length - PAST_SHOWN})`}
            </Button>
          )}
        </>
      )}

      {composing && (
        <EventFormDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) setComposing(false); }}
          onSaved={refresh}
        />
      )}

      {editing && (
        <EventFormDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) setEditing(null); }}
          editing={editing}
          onSaved={refresh}
        />
      )}

      {judging && (
        <PodiumDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) setJudging(null); }}
          contest={judging}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={Boolean(canceling)} onOpenChange={(isOpen) => { if (!isOpen) setCanceling(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel “{canceling?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The banner comes down, its announcement is recalled, and everyone is told it was called off.
              {canceling && isContestEvent(canceling) && ' Entries go back to being ordinary listings.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep It</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleCancel(); }} disabled={busy}>
              Cancel Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(isOpen) => { if (!isOpen) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{removing?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It never started, so nobody was told about it and nothing is left to explain. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep It</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleRemove(); }} disabled={busy}>
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
