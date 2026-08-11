import { useCallback, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Sparkles, Loader2, SlidersHorizontal, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import AiGenerateButton from '@/components/AiGenerateButton';
import TagField from '@/components/prompt/TagField';
import { useSettings } from '@/contexts/SettingsContext';
import { type ImageSubjectKind } from '@/lib/imagePrompt';
import { generateImage, buildImageRequest } from '@/lib/imageGen';
import { type ImageCap } from '@/lib/imageOptim';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';
import { cn } from '@/lib/utils';

/** The preset's own prefix as hint text. Labelled, because an empty box showing tags reads as "nothing is
 *  being sent" rather than "this is what you already get on top of whatever you type". */
const alwaysSent = (presetPrompt: string) =>
  (presetPrompt.trim() ? `Always Sent: ${presetPrompt.trim()}` : undefined);

/** The shape the picture will come out as — the same split that picks the generation's dimensions. The
 *  frame is grown along whichever axis the pane binds on (a tall pane for a portrait, a wide one for a
 *  landscape) and capped on the other, so it fills the pane without ever overflowing it. */
const EMPTY_FRAME = {
  portrait: 'aspect-[3/4] h-full max-w-full',
  landscape: 'aspect-video w-full max-h-full',
};

/**
 * The dialog's right half: one picture at the height the dialog can give it, rather than the thumbnail a
 * single column had room for. Holds every state the run passes through — the empty frame, the in-progress
 * frames, the bar, and the finished picture — so the left half stays purely the controls.
 *
 * On a phone the two halves stack and this becomes a band beneath them: an empty frame at full aspect would
 * push the prompt fields off the screen before there is anything to look at.
 */
const PreviewPane = ({ shape, generating, progress, frame, preview, onZoom }: {
  shape: 'portrait' | 'landscape';
  generating: boolean;
  progress: number | null;
  frame: string | null;
  preview: string | null;
  onZoom: () => void;
}) => {
  // The finished picture wins; until it lands, whatever the provider last sent.
  const shown = preview ?? (generating ? frame : null);
  return (
    <div
      className={cn(
        'relative flex min-h-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30',
        shown ? 'max-sm:h-[45vh]' : 'border-dashed max-sm:h-48',
      )}
    >
      {shown ? (
        // Taken out of flow, so the picture is sized by the pane and never the other way about: in flow, a
        // tall result grows the row it sits in and the whole dialog steps sideways as each one lands.
        // `object-contain` fits it inside those bounds whatever shape it is, without cropping or distorting.
        <img
          src={shown}
          alt={preview ? 'Generated preview' : 'Generating…'}
          onClick={preview ? onZoom : undefined}
          className={cn(
            'absolute inset-0 h-full w-full object-contain',
            preview ? 'cursor-zoom-in' : 'opacity-90',
          )}
        />
      ) : (
        // Drawn at the shape the picture will be, so the empty dialog already reads as the frame it will fill.
        <div className={cn('flex max-h-full items-center justify-center rounded border border-dashed p-4 text-center', EMPTY_FRAME[shape])}>
          {generating ? (
            <span className="flex items-center gap-2 text-meta text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating…
            </span>
          ) : (
            <span className="text-meta text-muted-foreground">The image appears here.</span>
          )}
        </div>
      )}
      {/* Over the picture rather than beside it: a bar that reflowed the pane would move the frame it is
          reporting on. Providers that report nothing (OpenAI) leave `progress` null and get the spinner. */}
      {generating && progress !== null && (
        <div className="absolute inset-x-0 bottom-0 grid gap-1 bg-overlay/70 p-2">
          <Progress value={progress * 100} />
          <span className="text-right text-meta text-white">{Math.round(progress * 100)}%</span>
        </div>
      )}
    </div>
  );
};

/**
 * "Generate with AI" affordance shown beside an ImageUpload. Opens a dialog that prefills an SD-style
 * prompt from the subject's description (via the text model), lets the user tweak it, generates an image
 * through the configured image provider, fits it to the field's cap, and hands it back via `onChange`.
 */
export function GenerateImageButton({ subject, cap, onChange, tags, onTagsChange }: {
  subject: { description: string; kind: ImageSubjectKind };
  cap: ImageCap;
  /** Takes the finished picture. Returning `false` (or a promise of it) means the caller did not keep it, and
   *  this dialog stays open on its preview rather than closing over a picture that went nowhere. */
  onChange: (dataUrl: string) => void | boolean | Promise<void | boolean>;
  /** Authored booru tags to seed the prompt from (entities/locations). Absent ⇒ local scratch. */
  tags?: string;
  /** Persist prompt edits back to the authored tags field. Absent ⇒ prompt stays local (world thumbnail). */
  onTagsChange?: (t: string) => void;
}) {
  const settings = useSettings();
  const {
    imagePositivePrompt, imageNegativePrompt,
    imagePortraitWidth, imagePortraitHeight, imageLandscapeWidth, imageLandscapeHeight,
    imageEndpointPresets, activeImageEndpointPresetId, selectImageEndpointPreset,
    imageGenDisabled, requestSettings,
  } = settings;
  // Characters get portrait dimensions; locations and the world thumbnail get landscape.
  const [genWidth, genHeight] = subject.kind === 'character'
    ? [imagePortraitWidth, imagePortraitHeight]
    : [imageLandscapeWidth, imageLandscapeHeight];

  const { promptImage, dialog: downscaleDialog } = useDownscalePrompt();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  // Both fields hold only what this subject adds. The preset's Prompt Prefix / Negative Prompt are applied
  // on top at generation time and shown as hint text, so neither looks like something you have to retype.
  const [negative, setNegative] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  // An accepted picture the caller is still deciding what to do with. Its own dialog is on top; ours must not
  // take a second accept underneath it.
  const [placing, setPlacing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const openDialog = () => {
    abortRef.current?.abort(); // drop any run left in flight so the dialog never reopens mid-generation
    abortRef.current = null;
    setGenerating(false);
    setPlacing(false);
    setPreview(null);
    setPreviewFrame(null);
    setProgress(null);
    setNegative('');
    setPrompt(tags ?? ''); // reflect the authored tags; never auto-generate over them
    setOpen(true);
  };

  // Prompt edits write back to the authored tags field when wired; otherwise stay local (world thumbnail).
  const handlePrompt = useCallback((t: string) => { setPrompt(t); onTagsChange?.(t); }, [onTagsChange]);

  const generate = async () => {
    if (!prompt.trim()) { toast.info('Enter a prompt first.'); return; }
    setGenerating(true);
    setPreview(null);
    setPreviewFrame(null);
    setProgress(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // The preset's prefixes (quality/style tags, shared negatives) ride on top of the per-subject fields.
      const { provider, params, opts } = buildImageRequest(settings, {
        prompt, negative, width: genWidth, height: genHeight,
      });
      const dataUrl = await generateImage(provider, params, {
        ...opts,
        signal: controller.signal,
        onProgress: (p) => {
          if (abortRef.current !== controller) return;
          setProgress(p.progress);
          if (p.preview) setPreviewFrame(p.preview);
        },
      });
      if (abortRef.current === controller) setPreview(dataUrl); // ignore a superseded run; optimize on accept
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error((error as Error).message || 'Image generation failed.');
    } finally {
      if (abortRef.current === controller) { setGenerating(false); setProgress(null); setPreviewFrame(null); }
    }
  };

  // Cancel an in-flight run without closing the dialog; providers interrupt server-side where they can.
  const stop = () => abortRef.current?.abort();

  const accept = async () => {
    if (!preview) return;
    setPlacing(true);
    try {
      // Ask before optimizing (same consent flow as uploads); within-cap resolves with no popup, Cancel keeps full-size.
      const finalUrl = await promptImage(preview, cap);
      // The caller may ask something of its own first — which slot to overwrite — so this can take a while,
      // and can come back refused. Only a kept picture closes the dialog.
      if (await onChange(finalUrl) === false) return;
      setOpen(false);
    } finally {
      setPlacing(false);
    }
  };

  const closeDialog = (o: boolean) => {
    if (!o) abortRef.current?.abort();
    setOpen(o);
  };

  // Settings → Endpoints → Image → "Enable Image Generation" hides the affordance everywhere at once.
  if (imageGenDisabled) return null;

  return (
    <>
      {downscaleDialog}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openDialog}>
        <Sparkles className="h-4 w-4" /> Generate with AI
      </Button>

      <Dialog open={open} onOpenChange={closeDialog}>
        {/* Two columns wide enough for the picture to be worth looking at, and a height cap so the pane has
            something definite to stretch against. */}
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Generate image</DialogTitle>
            <div className="flex items-center justify-between gap-3">
              <DialogDescription>Uses your configured image provider.</DialogDescription>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 flex-shrink-0"
                onClick={() => requestSettings('endpoints', 'img-endpoint')}
              >
                <SlidersHorizontal className="h-4 w-4" /> Open Settings
              </Button>
            </div>
          </DialogHeader>

          {/* Controls left, picture right; stacked below `sm`, where two columns have no room. `min-h-0` on
              both the row and the column is what lets the left half scroll instead of forcing the dialog
              past its cap and squashing the pane. */}
          <div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2">
          <div className="grid min-h-0 content-start gap-3 overflow-y-auto">
            <div className="grid gap-1.5">
              <Label htmlFor="gen-preset">Preset</Label>
              <Select value={activeImageEndpointPresetId} onValueChange={selectImageEndpointPreset}>
                <SelectTrigger id="gen-preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {imageEndpointPresets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* The placeholder is the preset's own prefix, so an empty field reads as "this is what you
                already get" rather than "nothing is being sent". */}
            <TagField
              label="Prompt"
              value={prompt}
              onChange={handlePrompt}
              placeholder={alwaysSent(imagePositivePrompt) ?? 'comma-separated visual tags…'}
              aside={<AiGenerateButton mode="tags" kind={subject.kind} source={subject.description} onChange={handlePrompt} />}
            />
            {/* No generate button: the model writes what a picture should contain, never what it
                shouldn't — that list is the author's taste and the preset's shared negatives. */}
            <TagField
              label="Negative prompt"
              value={negative}
              onChange={setNegative}
              placeholder={alwaysSent(imageNegativePrompt) ?? 'tags to avoid…'}
            />

          </div>

          <PreviewPane
            shape={subject.kind === 'character' ? 'portrait' : 'landscape'}
            generating={generating}
            progress={progress}
            frame={previewFrame}
            preview={preview}
            onZoom={() => setZoomOpen(true)}
          />
          </div>
          {preview && <ImageZoomViewer src={preview} alt="Generated preview" open={zoomOpen} onOpenChange={setZoomOpen} />}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => closeDialog(false)}>Cancel</Button>
            {generating ? (
              <Button type="button" variant="destructive" onClick={stop} title="Stop generating">
                <Square className="h-4 w-4" /> Stop
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={generate} disabled={placing}>
                <Sparkles className="h-4 w-4" /> {preview ? 'Regenerate' : 'Generate'}
              </Button>
            )}
            <Button type="button" onClick={accept} disabled={!preview || placing}>Use image</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
