import { useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ImagePlus, Megaphone, Plus, Save, Trophy } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/date-time-field";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { EventPosterBand } from "@/components/events/EventPosterBand";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { adminEventState, fromLocalInputValue, toLocalInputValue } from "@/lib/adminEvents";
import { parsePosterColor } from "@/lib/posterStyle";
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/avatar";
import EventService from "@/services/EventService";
import type { ServerEvent, ServerEventDraft, ServerEventType } from "@/types";

/** Mirrors the server's caps, so the counters and the field limits agree with what it will accept. */
const TITLE_MAX = 120;
const BANNER_MAX = 280;
const BODY_MAX = 4000;

/** The largest artwork the server will take. Matches its own cap, so the refusal happens before the upload. */
const POSTER_MAX_BYTES = 2 * 1024 * 1024;

/** Where the color picker starts before an organizer has chosen anything — the app's own info blue. */
const COLOR_PICKER_START = '#3b82f6';

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
 * The prose fields are the same markdown editor world prose is written in, and the poster band is
 * composed live under them, so what an organizer writes and styles is what players are shown.
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
  // The band: the chosen color, whatever artwork the server already holds, and the picked replacement.
  // `imageChanged` is what tells "left alone" from "cleared" on an edit, which the two nulls cannot.
  const [posterColor, setPosterColor] = useState<string | null>(null);
  const [storedImage, setStoredImage] = useState<string | null>(null);
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const filePicker = useRef<HTMLInputElement | null>(null);

  // No placeholders in an event: a `{{ph…}}` an organizer types stays inert text, exactly as it reads.
  const plainVocab = useMemo(() => plainVocabulary(), []);

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
    setPosterColor(parsePosterColor(editing?.posterColor));
    setStoredImage(editing?.posterImageUrl ?? null);
    setPickedImage(null);
    setImageChanged(false);
    setSaving(false);
  });

  const isContest = type === 'contest';
  const started = editing ? adminEventState(editing) !== 'scheduled' : false;
  const previewImage = pickedImage ?? storedImage;

  /** Read the picked file as the data URI the server stores it from. */
  const takeImage = (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > POSTER_MAX_BYTES) return toast.error('That image is larger than 2MB');

    const reader = new FileReader();
    reader.onload = () => {
      setPickedImage(String(reader.result));
      setImageChanged(true);
    };
    reader.onerror = () => toast.error('That image could not be read');
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setPickedImage(null);
    setStoredImage(null);
    setImageChanged(true);
  };

  const handleSave = async () => {
    const start = fromLocalInputValue(startsAt);
    const end = fromLocalInputValue(endsAt);

    if (!title.trim()) return toast.error('A title is required');
    if (!bannerText.trim()) return toast.error('Banner text is required');
    if (!body.trim()) return toast.error('Details are required');
    if (!start || !end) return toast.error('A start and an end are required');
    if (new Date(end) <= new Date(start)) return toast.error('The end has to come after the start');

    const authored = {
      type,
      title: title.trim(),
      bannerText: bannerText.trim(),
      body: body.trim(),
      rulesText: isContest ? rulesText.trim() || null : null,
      posterColor,
      endsAt: end,
    };
    // The artwork rides along only when it moved: an edit that never opened the picker must leave the
    // stored file where it is, and sending null for "unchanged" would delete it.
    const styled = imageChanged ? { ...authored, posterImage: pickedImage } : authored;
    // The start rides along only while it can still move. An edit reads the keys it is given, so
    // omitting it is how a typo fix in the banner avoids being refused for touching the start.
    const draft: Partial<ServerEventDraft> = started ? styled : { ...styled, startsAt: start };

    setSaving(true);
    try {
      if (editing) {
        await EventService.update(editing.id, draft);
        toast.success('Event saved');
      } else {
        await EventService.create({ ...authored, posterImage: pickedImage, startsAt: start });
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
            <Label htmlFor="eventTitle">Title</Label>
            <Input
              id="eventTitle"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isContest ? 'Autumn Hauntings Contest' : 'Update Preview'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventBanner">Banner Text</Label>
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

          {/* Players read these rendered, so they are authored the way the world editor's prose is —
              the same toolbar, the same Preview tab. Lexical renders a div, so the caption names the
              field through `ariaLabel` rather than `htmlFor`. */}
          <div className="space-y-2">
            <PromptField
              value={body}
              onChange={(next) => setBody(next.slice(0, BODY_MAX))}
              vocabulary={plainVocab}
              markdown
              ariaLabel="Details"
              label="Details"
              labelAside={<span className="text-meta text-muted-foreground">{body.length} / {BODY_MAX}</span>}
              placeholder="What players read in the announcement they acknowledge"
              className="h-[300px]"
            />
          </div>

          {isContest && (
            <div className="space-y-2">
              <PromptField
                value={rulesText}
                onChange={(next) => setRulesText(next.slice(0, BODY_MAX))}
                vocabulary={plainVocab}
                markdown
                ariaLabel="Rules"
                label="Rules"
                placeholder="What entrants are agreeing to"
                className="h-[260px]"
              />
              <p className="text-meta text-muted-foreground">
                Shown where authors enter and where entries are browsed. Only contests have rules.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Poster</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                aria-label="Poster color"
                className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                value={posterColor ?? COLOR_PICKER_START}
                onChange={(e) => setPosterColor(parsePosterColor(e.target.value))}
              />
              <Button variant="outline" size="sm" disabled={!posterColor} onClick={() => setPosterColor(null)}>
                Default Color
              </Button>
              <Button variant="outline" size="sm" onClick={() => filePicker.current?.click()}>
                <ImagePlus className="mr-2 h-4 w-4" aria-hidden /> Upload Image
              </Button>
              <Button variant="outline" size="sm" disabled={!previewImage} onClick={clearImage}>
                Remove Image
              </Button>
              <input
                ref={filePicker}
                type="file"
                accept={IMAGE_UPLOAD_ACCEPT}
                aria-label="Poster image"
                className="hidden"
                onChange={(e) => { takeImage(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
            <p className="text-meta text-muted-foreground">
              Both are optional — an event with neither keeps the default band. Images up to 2MB.
            </p>

            {/* The same band players are shown, composed from what is in the form right now. */}
            <div className="overflow-hidden rounded-lg border" data-testid="poster-preview">
              <EventPosterBand
                event={{ posterColor, posterImageUrl: previewImage, startsAt, endsAt }}
                icon={isContest ? Trophy : Megaphone}
                eyebrow={isContest ? 'A Contest Has Started' : 'An Announcement'}
                title={<div className="text-display font-semibold text-balance">{title || 'Your event title'}</div>}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventStarts">Starts</Label>
              <DateTimeField id="eventStarts" label="Starts" value={startsAt} onChange={setStartsAt} readOnly={started} />
              {started && (
                <p className="text-meta text-muted-foreground">
                  Already open — people have been told when this began.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventEnds">Ends</Label>
              <DateTimeField id="eventEnds" label="Ends" value={endsAt} onChange={setEndsAt} />
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
