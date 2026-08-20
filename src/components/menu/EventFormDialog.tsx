import { useState } from "react";
import { toast } from "react-toastify";
import { Megaphone, Plus, Save, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { adminEventState, fromLocalInputValue, toLocalInputValue } from "@/lib/adminEvents";
import EventService from "@/services/EventService";
import type { ServerEvent, ServerEventDraft, ServerEventType } from "@/types";

/** Mirrors the server's caps, so the counters and the field limits agree with what it will accept. */
const TITLE_MAX = 120;
const BANNER_MAX = 280;
const BODY_MAX = 4000;

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The event being rewritten; absent schedules a new one. */
  editing?: ServerEvent | null;
  /** Called after a successful save, so the list behind can pick the change up. */
  onSaved?: () => void;
}

/**
 * The one form both event types are authored in.
 *
 * A contest and an announcement are the same thing told twice — a title, a line for the banner, a body
 * to acknowledge and a window — so they share a form rather than a form each, and the type picker is a
 * full-width strip above the fields instead of a control hidden among them. The broadcast composer is
 * left alone: what goes out when this starts is written by the server from these fields.
 *
 * Only what the server would refuse is withheld: an event's type never changes, and a started event's
 * start cannot move. Both are shown as read-only rather than as absent fields, because the value is
 * still what an admin came to check.
 */
export function EventFormDialog({ open, onOpenChange, editing = null, onSaved }: EventFormDialogProps) {
  const [type, setType] = useState<ServerEventType>('contest');
  const [title, setTitle] = useState('');
  const [bannerText, setBannerText] = useState('');
  const [body, setBody] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset on open rather than on close: the dialog is still on screen while it fades out, and blanking
  // the fields in the close handler shows the reader an empty form for those frames.
  useResetOnOpen(open, () => {
    setType((editing?.type === 'announcement' ? 'announcement' : 'contest'));
    setTitle(editing?.title ?? '');
    setBannerText(editing?.bannerText ?? '');
    setBody(editing?.body ?? '');
    setRulesText(editing?.rulesText ?? '');
    setStartsAt(toLocalInputValue(editing?.startsAt));
    setEndsAt(toLocalInputValue(editing?.endsAt));
    setSaving(false);
  });

  const isContest = type === 'contest';
  const started = editing ? adminEventState(editing) !== 'scheduled' : false;

  const handleSave = async () => {
    const start = fromLocalInputValue(startsAt);
    const end = fromLocalInputValue(endsAt);

    if (!title.trim()) return toast.error('A title is required');
    if (!bannerText.trim()) return toast.error('Banner text is required');
    if (!body.trim()) return toast.error('Details are required');
    if (!start || !end) return toast.error('A start and an end are required');
    if (new Date(end) <= new Date(start)) return toast.error('The end has to come after the start');

    const draft: ServerEventDraft = {
      type,
      title: title.trim(),
      bannerText: bannerText.trim(),
      body: body.trim(),
      rulesText: isContest ? rulesText.trim() || null : null,
      startsAt: start,
      endsAt: end,
    };

    setSaving(true);
    try {
      if (editing) {
        // The start is sent only while it can still move. An edit reads the keys it is given, so
        // leaving it out is how a typo fix in the banner avoids being refused for touching the start.
        if (started) delete (draft as Partial<ServerEventDraft>).startsAt;
        await EventService.update(editing.id, draft);
        toast.success('Event saved');
      } else {
        await EventService.create(draft);
        toast.success('Event scheduled');
      }

      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save the event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Event' : 'New Event'}</DialogTitle>
          <DialogDescription>
            A timed banner and announcement every player sees. Starting it posts a pinned broadcast
            automatically, written from the title and banner — polish its wording afterward under Broadcasts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* The same full-width strip the Feedback tab's branches use: two things of equal weight, not
              a setting with a default. An edit says which one this is instead of offering the choice —
              the type decides what a client unlocks, and it is already out in a broadcast by the time
              anyone could want it changed. */}
          {editing ? (
            <div className="flex items-center gap-2 text-label font-medium">
              {isContest
                ? <><Trophy className="h-4 w-4 text-warning" aria-hidden /> Contest</>
                : <><Megaphone className="h-4 w-4 text-info" aria-hidden /> Announcement</>}
            </div>
          ) : (
            <Tabs value={type} onValueChange={(value) => setType(value as ServerEventType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="contest">
                  <Trophy className="mr-2 h-4 w-4" aria-hidden /> Contest
                </TabsTrigger>
                <TabsTrigger value="announcement">
                  <Megaphone className="mr-2 h-4 w-4" aria-hidden /> Announcement
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="space-y-2">
            <label htmlFor="eventTitle" className="text-label font-medium">Title</label>
            <Input
              id="eventTitle"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isContest ? 'Autumn Hauntings Contest' : 'Update Preview'}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="eventBanner" className="text-label font-medium">Banner Text</label>
            <Input
              id="eventBanner"
              value={bannerText}
              maxLength={BANNER_MAX}
              onChange={(e) => setBannerText(e.target.value)}
              placeholder="One line, shown on the main menu while the event runs"
            />
            <p className="text-meta text-muted-foreground">
              One line, on the main menu and in Community Creations while the event runs.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor="eventBody" className="text-label font-medium">Details</label>
              <span className="text-meta text-muted-foreground">{body.length} / {BODY_MAX}</span>
            </div>
            <Textarea
              id="eventBody"
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What players read in the announcement they acknowledge"
              className="h-32"
            />
          </div>

          {isContest && (
            <div className="space-y-2">
              <label htmlFor="eventRules" className="text-label font-medium">Rules</label>
              <Textarea
                id="eventRules"
                value={rulesText}
                maxLength={BODY_MAX}
                onChange={(e) => setRulesText(e.target.value)}
                placeholder="What entrants are agreeing to"
                className="h-24"
              />
              <p className="text-meta text-muted-foreground">
                Shown where authors enter and where entries are browsed. Only contests have rules.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="eventStarts" className="text-label font-medium">Starts</label>
              <Input
                id="eventStarts"
                type="datetime-local"
                value={startsAt}
                readOnly={started}
                onChange={(e) => setStartsAt(e.target.value)}
              />
              {started && (
                <p className="text-meta text-muted-foreground">
                  Already open — people have been told when this began.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="eventEnds" className="text-label font-medium">Ends</label>
              <Input
                id="eventEnds"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {editing
              ? <><Save className="mr-2 h-4 w-4" aria-hidden /> Save Event</>
              : <><Plus className="mr-2 h-4 w-4" aria-hidden /> Create Event</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
