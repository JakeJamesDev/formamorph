import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useSyncExternalStore } from "react";
import type { ImageProviderId } from "@/lib/imageGen";
import { useDevRoute } from "@/lib/devRouter";
import {
  closeImageSetupGuide, getImageSetupGuideState, subscribeImageSetupGuide, toastImageFailure,
} from "@/lib/imageGen/failureToast";
import { imageConnectionError } from "@/lib/imageGen/http";
import { isDesktop } from "@/lib/imageGen/desktop";
import { Code, Snippet } from "./guideBits";

const TITLES: Record<ImageProviderId, string> = {
  a1111: "Set up Automatic1111 / Forge",
  comfyui: "Set up ComfyUI",
  invokeai: "Set up InvokeAI",
  novelai: "Set up NovelAI",
  openai: "Set up an OpenAI-compatible server",
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
    <DialogContent surface="imageSetup" aria-describedby={undefined} className="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>{TITLES[provider]}</DialogTitle>
      </DialogHeader>

      <div className="space-y-2 text-label">
        {provider !== "openai" && provider !== "novelai" && (
          <p className="text-muted-foreground">Install and start it first. This guide covers only the connection.</p>
        )}

        {provider === "a1111" && (
          <>
            <p>Add this line to <Code>webui-user.bat</Code>, then run that file to launch:</p>
            <Snippet>set COMMANDLINE_ARGS=--api --cors-allow-origins=*</Snippet>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>Optional: install the <strong>ADetailer</strong> extension to use <strong>Face Fix</strong>.</li>
            </ul>
          </>
        )}

        {provider === "comfyui" && (
          <>
            {isDesktop() ? (
              <p>The desktop app needs no setup. Start ComfyUI, then leave <strong>Endpoint URL</strong> empty or type your server&apos;s address.</p>
            ) : (
              <>
                <p>Add this flag to the start command in your <Code>run_*.bat</Code>, then run that file to launch:</p>
                <Snippet>{`--enable-cors-header ${window.location.origin}`}</Snippet>
              </>
            )}
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              {!isDesktop() && (
                <li>Keep the address after the flag. Without it, any website you visit can send ComfyUI work.</li>
              )}
              <li>The <strong>Model</strong> and <strong>Sampler</strong> lists load from the server. The <strong>Workflow</strong> field starts with a default you can edit.</li>
            </ul>
          </>
        )}

        {provider === "invokeai" && (
          <>
            <p>Add this app&apos;s address to <Code>allow_origins</Code> in <Code>invokeai.yaml</Code>, in the InvokeAI root folder. Then restart InvokeAI:</p>
            <Snippet>{`allow_origins: ["${window.location.origin}"]`}</Snippet>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>The default endpoint is <Code>http://localhost:9090</Code>. The <strong>Model</strong> list loads from the server. Pick an installed SDXL, SD1.5, SD2, Z-Image or Anima model.</li>
              <li>Z-Image also needs a Qwen3 encoder and a FLUX-type VAE. Installed ones are picked automatically. To pick others, use <strong>Qwen3 Encoder</strong> and <strong>Z-Image VAE</strong> in <strong>Advanced</strong> mode.</li>
              <li><strong>Face Fix</strong> needs no extension. The first image with it on waits while InvokeAI downloads its detector models, a few hundred MB, one time only.</li>
            </ul>
          </>
        )}

        {provider === "novelai" && (
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>Needs a NovelAI subscription. In NovelAI, open the <strong>cog icon</strong> → <strong>Account</strong> tab and scroll to <strong>Get Persistent API Token</strong>. Copy the token before you close the popup, because NovelAI shows it only once.</li>
            <li>Paste it into <strong>API Token</strong> in Settings. It stays on your machine. The endpoint is already set to <Code>https://image.novelai.net</Code>.</li>
            <li><strong>Opus</strong> subscribers get one free image per request at up to <strong>1024×1024</strong> and <strong>28 steps</strong>. This provider starts at those settings. Higher values spend Anlas.</li>
            <li>NovelAI can&apos;t stop a generation it has started. <strong>Stop</strong> frees the app, but that image can still cost Anlas.</li>
          </ul>
        )}

        {provider === "openai" && (
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>Works only in the <strong>Formamorph desktop app</strong>. Browsers can&apos;t call these APIs directly, so the desktop app sends the requests for you. You need no CORS setup.</li>
            <li><strong>Endpoint URL</strong>: your provider&apos;s base URL, for example <Code>https://api.openai.com</Code>.</li>
            <li>Paste your API key into <strong>API Token</strong>. It stays on your machine.</li>
          </ul>
        )}
      </div>
    </DialogContent>
  </Dialog>
);

/** The guide a failed image request's Fix connection link opens; mounted once, beside the toast container. */
export function ImageSetupGuideHost() {
  const { open, provider } = useSyncExternalStore(subscribeImageSetupGuide, getImageSetupGuideState);

  // DEV: `#dev?modal=imageSetup` raises a canned ComfyUI connection toast.
  const devRoute = useDevRoute();
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'imageSetup') {
      toastImageFailure(
        imageConnectionError('comfyui', 'http://localhost:8188', 'POST', 'http://localhost:8188/prompt', new TypeError('Failed to fetch')),
        '',
      );
    }
  }, [devRoute?.modal]);

  return <ImageSetupGuide provider={provider} open={open} onOpenChange={(next) => { if (!next) closeImageSetupGuide(); }} />;
}

export default ImageSetupGuide;
