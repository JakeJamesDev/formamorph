import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ImageProviderId } from "@/lib/imageGen";
import { Code, Snippet } from "./guideBits";

const TITLES: Record<ImageProviderId, string> = {
  a1111: "Set up Automatic1111 / Forge",
  comfyui: "Set up ComfyUI",
  invokeai: "Set up InvokeAI",
  openai: "Set up OpenAI-compatible (cloud)",
};

/** Connection guide for the currently-selected image provider. Assumes the tool is already installed and
 *  running — it only covers the one step needed to let Formamorph reach it. */
const ImageSetupGuide = ({
  provider,
  open,
  onOpenChange,
}: {
  provider: ImageProviderId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>{TITLES[provider]}</DialogTitle>
      </DialogHeader>

      <div className="space-y-2 text-sm">
        {provider !== "openai" && (
          <p className="text-muted-foreground">Assumes it&apos;s already installed.</p>
        )}

        {provider === "a1111" && (
          <>
            <p>Add this line to <Code>webui-user.bat</Code>, then run that file to launch:</p>
            <Snippet>set COMMANDLINE_ARGS=--api --cors-allow-origins=*</Snippet>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Optional: install the <strong>ADetailer</strong> extension to use the face/hand-fix toggle.</li>
            </ul>
          </>
        )}

        {provider === "comfyui" && (
          <>
            <p>Add this flag to the start command in your <Code>run_*.bat</Code>, then run that file to launch:</p>
            <Snippet>--enable-cors-header</Snippet>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>The Model &amp; Sampler lists load from the server automatically; the Workflow field ships an editable default.</li>
            </ul>
          </>
        )}

        {provider === "invokeai" && (
          <>
            <p>Let InvokeAI accept the app&apos;s origin. Add it to <Code>allow_origins</Code> in your <Code>invokeai.yaml</Code> (in the InvokeAI root folder), then restart InvokeAI:</p>
            <Snippet>{`allow_origins: ["${window.location.origin}"]`}</Snippet>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Default endpoint is <Code>http://127.0.0.1:9090</Code>. The Model list loads from the server automatically — pick an installed SDXL, SD1.5, or Z-Image model.</li>
              <li>Z-Image also needs a Qwen3 encoder and a FLUX-type VAE; Formamorph auto-picks installed ones (override in Settings if needed).</li>
              <li><strong>Face Fix</strong> needs no extension, but the first image you generate with it on pauses while InvokeAI downloads its detector models (a few hundred MB, once).</li>
            </ul>
          </>
        )}

        {provider === "openai" && (
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>Available only in the <strong>Formamorph desktop app</strong> — browsers can&apos;t call these APIs directly, so the app proxies them (no CORS setup).</li>
            <li>Endpoint: your provider&apos;s base URL, e.g. <Code>https://api.openai.com</Code>.</li>
            <li>Paste your API key — it stays on your machine.</li>
          </ul>
        )}
      </div>
    </DialogContent>
  </Dialog>
);

export default ImageSetupGuide;
