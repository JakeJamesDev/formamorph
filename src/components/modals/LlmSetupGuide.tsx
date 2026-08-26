import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isCrossOriginEmbed, isLocalEndpoint, openInOwnTab } from "@/lib/localNetworkEmbed";
import { isDesktop } from "@/lib/imageGen/desktop";
import { Code } from "./guideBits";

/** Derive a browsable base (`http://host:port`) from the configured chat-completions URL, for the
 *  "open it in a tab" reachability check. Falls back to the raw string if it doesn't parse. */
const baseOf = (url?: string): string | null => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
};

/** Shown after the app can't reach the configured AI server. The failure is opaque in-page (a server
 *  that's off, a wrong URL, CORS-disabled and a denied local-network permission all look identical), so
 *  this walks the causes in likelihood order rather than asserting one. Shown on desktop too — the CORS
 *  shim should make the CORS step moot there, but users still report CORS-shaped desktop failures. */
const LlmSetupGuide = ({
  open,
  onOpenChange,
  endpointUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpointUrl?: string;
}) => {
  const base = baseOf(endpointUrl);
  const modelsUrl = base ? `${base}/v1/models` : null;
  // A checklist of candidate causes, not a verdict — so, like the three below it, the embed cause is
  // listed whenever it *could* apply. (The setup gate asserts a cause instead, and gates on a real
  // failed probe: `shouldOfferPopOut`.) Both conditions are false in the desktop app, which is never
  // framed and reaches local servers directly.
  const localEndpoint = !isDesktop() && isLocalEndpoint(endpointUrl ?? "");
  const embedBlocked = isCrossOriginEmbed() && localEndpoint;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Can&apos;t reach your AI server</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-label">
          <p className="text-muted-foreground">
            The browser can&apos;t tell exactly why, so check each of these:
          </p>

          <ol className="list-decimal list-outside space-y-3 pl-5">
            {embedBlocked && (
              <li>
                <strong>Playing inside another site&apos;s embed?</strong>
                <p className="text-muted-foreground">
                  Browsers don&apos;t let an embedded page reach servers on your machine or local network,
                  and the site embedding this game hasn&apos;t granted that. In a tab of its own the game
                  can ask your permission and connect — but the tab keeps storage of its own, so export
                  any worlds or saves you want to bring and import them there. The desktop app connects
                  to local servers directly, with none of this in the way.
                </p>
                <Button size="sm" className="mt-2" onClick={openInOwnTab}>
                  Open in a New Tab
                </Button>
              </li>
            )}
            <li>
              <strong>Is the server running?</strong>
              <p className="text-muted-foreground">
                {modelsUrl ? (
                  <>
                    Open{" "}
                    <a href={modelsUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">
                      {modelsUrl}
                    </a>{" "}
                    in a new tab — you should see a JSON list of models. Nothing there means the server is off or
                    on a different port.
                  </>
                ) : (
                  <>Open your server&apos;s <Code>/v1/models</Code> URL in a new tab — you should see JSON.</>
                )}
              </p>
            </li>
            <li>
              <strong>Is the Endpoint URL correct?</strong>
              <p className="text-muted-foreground">
                In <strong>Settings → Endpoints</strong> it should point at your server&apos;s address, e.g.{" "}
                <Code>http://localhost:1234</Code> — pasting what LM Studio or Ollama shows you is enough, we fill
                in the rest. Double-check the host and port.
              </p>
            </li>
            <li>
              <strong>Is CORS enabled?</strong>
              <p className="text-muted-foreground">
                Browsers block requests to servers that don&apos;t allow cross-origin calls, so you have to turn
                it on at the server:
              </p>
              <ul className="list-disc list-outside space-y-0.5 pl-5 text-muted-foreground">
                <li><strong>LM Studio:</strong> in the server settings, turn on <strong>Enable CORS</strong>, then restart the server.</li>
                <li><strong>Ollama:</strong> start it with <Code>OLLAMA_ORIGINS=*</Code> in the environment.</li>
                <li><strong>Other OpenAI-compatible servers:</strong> enable CORS / allow all origins in their config.</li>
              </ul>
            </li>
          </ol>

          {localEndpoint && (
            <p className="text-muted-foreground">
              <strong>One more thing your browser does:</strong> the first time a page reaches a server on
              your machine or local network, Chrome and Firefox ask your permission. Allow it when the
              prompt appears. If you dismissed or blocked it, re-allow it from the icon at the left of the
              address bar → <strong>Site settings</strong>, then reload.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LlmSetupGuide;
