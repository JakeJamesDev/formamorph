import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import { useSettings } from '@/contexts/SettingsContext';
import { buildImagePrompt, type ImageSubjectKind } from '@/lib/imagePrompt';
import { generateImage } from '@/lib/imageGen';
import { isOversized, optimizeImageDataUrl, type ImageCap } from '@/lib/imageOptim';

/**
 * "Generate with AI" affordance shown beside an ImageUpload. Opens a dialog that prefills an SD-style
 * prompt from the subject's description (via the text model), lets the user tweak it, generates an image
 * through the configured image provider, fits it to the field's cap, and hands it back via `onChange`.
 */
export function GenerateImageButton({ subject, cap, onChange }: {
  subject: { name: string; description: string; kind: ImageSubjectKind };
  cap: ImageCap;
  onChange: (dataUrl: string) => void;
}) {
  const {
    activeEndpointUrl, activeApiToken, activeModelName,
    imageProvider, imageEndpoint, imageApiToken, imageModel, imageTagPrompt,
    imagePositivePrompt, imageNegativePrompt, imageSteps, imageCfg, imageSampler,
    imagePortraitWidth, imagePortraitHeight, imageLandscapeWidth, imageLandscapeHeight,
  } = useSettings();
  // Characters get portrait dimensions; locations and the world thumbnail get landscape.
  const [genWidth, genHeight] = subject.kind === 'character'
    ? [imagePortraitWidth, imagePortraitHeight]
    : [imageLandscapeWidth, imageLandscapeHeight];

  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negative, setNegative] = useState(imageNegativePrompt);
  const [refining, setRefining] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Which subject the current `prompt` was written for. This button stays mounted while the editor swaps
  // which entity/location is being edited, so prompt state would otherwise leak between subjects.
  const builtForRef = useRef<string | null>(null);

  const refinePrompt = async () => {
    if (!subject.description.trim()) { toast.info('Add a description first to auto-write a prompt.'); return; }
    setRefining(true);
    try {
      const p = await buildImagePrompt(subject, {
        endpointUrl: activeEndpointUrl, apiToken: activeApiToken, modelName: activeModelName, tagPrompt: imageTagPrompt,
      });
      setPrompt(p);
      builtForRef.current = subject.name;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error('Could not write a prompt from the description.');
    } finally {
      setRefining(false);
    }
  };

  const openDialog = () => {
    setPreview(null);
    setNegative(imageNegativePrompt);
    setOpen(true);
    // Re-write the prompt when opening for a different subject than the one it was built for.
    if (builtForRef.current !== subject.name) { setPrompt(''); void refinePrompt(); }
  };

  const generate = async () => {
    if (!prompt.trim()) { toast.info('Enter a prompt first.'); return; }
    setGenerating(true);
    setPreview(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Prepend the global prefix (quality/style tags) to the per-subject prompt.
      const fullPrompt = [imagePositivePrompt.trim(), prompt.trim()].filter(Boolean).join(', ');
      let dataUrl = await generateImage(
        imageProvider,
        {
          prompt: fullPrompt, negativePrompt: negative,
          width: genWidth, height: genHeight, steps: imageSteps, cfg: imageCfg,
          sampler: imageSampler, seed: -1, model: imageModel,
        },
        { endpointUrl: imageEndpoint, apiToken: imageApiToken, signal: controller.signal },
      );
      if (await isOversized(dataUrl, cap)) dataUrl = await optimizeImageDataUrl(dataUrl, cap);
      if (abortRef.current === controller) setPreview(dataUrl); // ignore a superseded run
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error((error as Error).message || 'Image generation failed.');
    } finally {
      if (abortRef.current === controller) setGenerating(false);
    }
  };

  const accept = () => {
    if (!preview) return;
    onChange(preview);
    setOpen(false);
  };

  const closeDialog = (o: boolean) => {
    if (!o) abortRef.current?.abort();
    setOpen(o);
  };

  return (
    <>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="gen-prompt">Prompt</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={refinePrompt} disabled={refining}>
                  {refining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Rewrite from description
                </Button>
              </div>
              <Textarea id="gen-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="comma-separated visual tags…" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gen-negative">Negative prompt</Label>
              <Textarea id="gen-negative" rows={2} value={negative} onChange={(e) => setNegative(e.target.value)} />
            </div>

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
