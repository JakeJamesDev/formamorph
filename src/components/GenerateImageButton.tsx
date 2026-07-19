import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import AiFieldToolbar from '@/components/AiFieldToolbar';
import { TagAutocomplete } from '@/components/TagAutocomplete';
import { useSettings } from '@/contexts/SettingsContext';
import { type ImageSubjectKind } from '@/lib/imagePrompt';
import { generateImage, resolveImageEndpoint } from '@/lib/imageGen';
import { type ImageCap } from '@/lib/imageOptim';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';

/**
 * "Generate with AI" affordance shown beside an ImageUpload. Opens a dialog that prefills an SD-style
 * prompt from the subject's description (via the text model), lets the user tweak it, generates an image
 * through the configured image provider, fits it to the field's cap, and hands it back via `onChange`.
 */
export function GenerateImageButton({ subject, cap, onChange, tags, onTagsChange }: {
  subject: { name: string; description: string; kind: ImageSubjectKind };
  cap: ImageCap;
  onChange: (dataUrl: string) => void;
  /** Authored booru tags to seed the prompt from (entities/locations). Absent ⇒ local scratch. */
  tags?: string;
  /** Persist prompt edits back to the authored tags field. Absent ⇒ prompt stays local (world thumbnail). */
  onTagsChange?: (t: string) => void;
}) {
  const {
    imageProvider, imageEndpoint, imageApiToken, imageModel,
    imagePositivePrompt, imageNegativePrompt, imageSteps, imageCfg, imageSampler,
    imagePortraitWidth, imagePortraitHeight, imageLandscapeWidth, imageLandscapeHeight, imageAdetailer,
    imageWorkflow, imageInvokeEncoder, imageInvokeVae,
    imageEndpointPresets, activeImageEndpointPresetId, selectImageEndpointPreset,
  } = useSettings();
  // Characters get portrait dimensions; locations and the world thumbnail get landscape.
  const [genWidth, genHeight] = subject.kind === 'character'
    ? [imagePortraitWidth, imagePortraitHeight]
    : [imageLandscapeWidth, imageLandscapeHeight];

  const { promptImage, dialog: downscaleDialog } = useDownscalePrompt();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negative, setNegative] = useState(imageNegativePrompt);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Re-seed the local negative field when the active preset changes (e.g. picked in this dialog), so it
  // reflects the newly active preset. Local edits to `negative` don't touch imageNegativePrompt, so they
  // won't retrigger this.
  useEffect(() => {
    if (open) setNegative(imageNegativePrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed only on preset switch, not on every keystroke
  }, [activeImageEndpointPresetId]);

  const openDialog = () => {
    abortRef.current?.abort(); // drop any run left in flight so the dialog never reopens mid-generation
    abortRef.current = null;
    setGenerating(false);
    setPreview(null);
    setPreviewFrame(null);
    setProgress(null);
    setNegative(imageNegativePrompt);
    setPrompt(tags ?? ''); // reflect the authored tags; never auto-generate over them
    setOpen(true);
  };

  // Prompt edits write back to the authored tags field when wired; otherwise stay local (world thumbnail).
  const handlePrompt = (t: string) => { setPrompt(t); onTagsChange?.(t); };

  const generate = async () => {
    if (!prompt.trim()) { toast.info('Enter a prompt first.'); return; }
    setGenerating(true);
    setPreview(null);
    setPreviewFrame(null);
    setProgress(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Prepend the global prefix (quality/style tags) to the per-subject prompt.
      const fullPrompt = [imagePositivePrompt.trim(), prompt.trim()].filter(Boolean).join(', ');
      const dataUrl = await generateImage(
        imageProvider,
        {
          prompt: fullPrompt, negativePrompt: negative,
          width: genWidth, height: genHeight, steps: imageSteps, cfg: imageCfg,
          sampler: imageSampler, seed: -1, model: imageModel, adetailer: imageAdetailer,
        },
        {
          endpointUrl: resolveImageEndpoint(imageProvider, imageEndpoint), apiToken: imageApiToken, workflow: imageWorkflow,
          invokeEncoder: imageInvokeEncoder, invokeVae: imageInvokeVae, signal: controller.signal,
          onProgress: (p) => {
            if (abortRef.current !== controller) return;
            setProgress(p.progress);
            if (p.preview) setPreviewFrame(p.preview);
          },
        },
      );
      if (abortRef.current === controller) setPreview(dataUrl); // ignore a superseded run; optimize on accept
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error((error as Error).message || 'Image generation failed.');
    } finally {
      if (abortRef.current === controller) { setGenerating(false); setProgress(null); setPreviewFrame(null); }
    }
  };

  const accept = async () => {
    if (!preview) return;
    // Ask before optimizing (same consent flow as uploads); within-cap resolves with no popup, Cancel keeps full-size.
    const finalUrl = await promptImage(preview, cap);
    onChange(finalUrl);
    setOpen(false);
  };

  const closeDialog = (o: boolean) => {
    if (!o) abortRef.current?.abort();
    setOpen(o);
  };

  return (
    <>
      {downscaleDialog}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openDialog}>
        <Sparkles className="h-4 w-4" /> Generate with AI
      </Button>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Generate image</DialogTitle>
            <DialogDescription>Uses your configured image provider (Settings → Image Gen).</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
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
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="gen-prompt">Prompt</Label>
                <AiFieldToolbar mode="tags" name={subject.name} kind={subject.kind} source={subject.description} value={prompt} onChange={handlePrompt} />
              </div>
              <TagAutocomplete id="gen-prompt" rows={3} value={prompt} onChange={handlePrompt} placeholder="comma-separated visual tags…" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gen-negative">Negative prompt</Label>
              <Textarea id="gen-negative" rows={2} value={negative} onChange={(e) => setNegative(e.target.value)} />
            </div>

            {/* Progress bar (A1111 only — progress stays null for providers that don't report). */}
            {generating && progress !== null && (
              <div className="grid gap-1">
                <Progress value={progress * 100} />
                <span className="text-xs text-muted-foreground text-right">{Math.round(progress * 100)}%</span>
              </div>
            )}
            {/* Live in-progress frame until the final image arrives. */}
            {generating && previewFrame && !preview && (
              <img src={previewFrame} alt="Generating…" className="mx-auto max-h-64 rounded-md border opacity-90" />
            )}

            {preview && (
              <img
                src={preview}
                alt="Generated preview"
                className="mx-auto max-h-64 rounded-md border cursor-zoom-in"
                onClick={() => setZoomOpen(true)}
              />
            )}
            {preview && <ImageZoomViewer src={preview} alt="Generated preview" open={zoomOpen} onOpenChange={setZoomOpen} />}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => closeDialog(false)}>Cancel</Button>
            <Button type="button" variant="secondary" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {preview ? 'Regenerate' : 'Generate'}
            </Button>
            <Button type="button" onClick={accept} disabled={!preview}>Use image</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
