import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Dices, Loader2, Square, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import TagField from '@/components/prompt/TagField';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';

/**
 * A turn's scene images, under its narration: the current picture, arrows to browse the ones drawn before
 * it, and the tag line it came from — editable and re-rollable, so a bad draw can be corrected without
 * touching the story. The tag row stays available on a turn with no image yet, because re-rolling tags is
 * the cheap way to judge them (one small text request) and shouldn't cost a render.
 */
export const SceneImagePanel = ({
  images,
  tags,
  ready,
  job,
  progress,
  preview,
  onGenerate,
  onRegenerateTags,
  onCancel,
  onDelete,
}: {
  images: string[];
  /** The tag line the last image was drawn from; seeds the editable field. */
  tags: string;
  /** The viewed page holds a committed turn — without one there is nothing to tag or draw. */
  ready: boolean;
  /** Which half of the pipeline is running: the tag pass, the render, or nothing. */
  job: 'tags' | 'image' | null;
  /** 0..1 while the provider reports it; null for providers that don't. */
  progress: number | null;
  /** The provider's live in-progress frame, shown in place of the finished image while it renders. */
  preview: string | null;
  /** Draw. A tag line means "use exactly this"; undefined re-runs the tag pass from the narration. */
  onGenerate: (tags?: string) => void;
  /** Re-write the tag line from the narration without drawing anything. */
  onRegenerateTags: () => void;
  onCancel: () => void;
  onDelete: (index: number) => void;
}) => {
  const [index, setIndex] = useState(Math.max(0, images.length - 1));
  const [draft, setDraft] = useState(tags);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const busy = job !== null;

  // Follow the newest image as ones arrive, and stay in range when one is deleted.
  useEffect(() => { setIndex(Math.max(0, images.length - 1)); }, [images.length]);
  // Adopt a freshly written line, but never overwrite an edit the player is in the middle of. A finished
  // re-roll is the exception: it was asked for, so it replaces the field — and it must key off the job
  // ending rather than the value changing, or a re-roll that happens to return the same line leaves the
  // field on whatever it held, which is exactly when it looks like nothing happened.
  const lastJob = useRef<'tags' | 'image' | null>(job);
  useEffect(() => {
    const finishedReroll = lastJob.current === 'tags' && job === null;
    lastJob.current = job;
    setDraft((prev) => (finishedReroll || !prev.trim() ? tags : prev));
  }, [job, tags]);

  if (!ready || (!images.length && !busy && !tags)) return null;

  const current = images[Math.min(index, images.length - 1)];
  const edited = draft.trim() !== tags.trim();

  return (
    <div className="mt-3 flex flex-col gap-2 border border-border rounded-md p-2 bg-background/40">
      {busy && (
        <div className="flex items-center gap-2">
          {job === 'tags' || progress === null ? (
            <span className="flex items-center gap-2 text-meta text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {job === 'tags' ? 'Writing tags…' : 'Drawing this scene…'}
            </span>
          ) : (
            <>
              <Progress value={progress * 100} className="h-1.5 flex-1" />
              <span className="text-meta text-muted-foreground whitespace-nowrap">{Math.round(progress * 100)}%</span>
            </>
          )}
          <Button variant="destructive" size="icon" className="h-7 w-7 shrink-0" onClick={onCancel} title="Stop">
            <Square className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* While a render is running its live frame takes the frame's place, so the picture is visibly
          forming rather than the last one sitting there looking finished. */}
      {job === 'image' && preview ? (
        <img src={preview} alt="Drawing…" className="mx-auto max-h-72 rounded-md border opacity-90" />
      ) : current && (
        <>
          <img
            src={current}
            alt={`Scene illustration${tags ? `: ${tags}` : ''}`}
            title={tags}
            className="mx-auto max-h-72 rounded-md border cursor-zoom-in"
            onClick={() => setZoomOpen(true)}
          />
          <ImageZoomViewer src={current} alt="Scene illustration" open={zoomOpen} onOpenChange={setZoomOpen} />
        </>
      )}

      <div className="flex items-center gap-1">
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              title="Previous image"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-meta text-muted-foreground tabular-nums">{Math.min(index, images.length - 1) + 1}/{images.length}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIndex((i) => Math.min(images.length - 1, i + 1))}
              disabled={index >= images.length - 1}
              title="Next image"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-meta" onClick={() => setShowTags((v) => !v)}>
          {showTags ? 'Hide tags' : 'Tags'}
        </Button>
        {current && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDelete(Math.min(index, images.length - 1))}
            title="Delete this image"
            aria-label="Delete this image"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showTags && (
        <div className="flex flex-col gap-1">
          {/* The same Danbooru autocomplete the editor's Image Tags field uses — this is where tags get
              hand-fixed, so it is exactly where completion is worth having. */}
          <TagField
            value={draft}
            onChange={setDraft}
            ariaLabel="Scene tags"
            placeholder="comma-separated tags…"
          />
          <div className="flex items-center gap-2">
            {/* Re-rolling the tags costs one small text request and no render — the loop for judging whether
                the tags themselves are any good, before spending a picture on them. */}
            <Button variant="outline" size="sm" disabled={busy} onClick={onRegenerateTags} title="Write a new tag line from this turn">
              <Dices className="h-4 w-4" /> Re-roll tags
            </Button>
            {/* An edited line is drawn exactly as written; an untouched one re-reads the narration, which is
                what the player wants when the tags were fine and the picture simply came out badly. */}
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => onGenerate(edited ? draft : undefined)}>
              <Sparkles className="h-4 w-4" /> {edited ? 'Draw these tags' : 'Draw again'}
            </Button>
            {edited && (
              <Button variant="ghost" size="sm" onClick={() => setDraft(tags)}>Revert</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
