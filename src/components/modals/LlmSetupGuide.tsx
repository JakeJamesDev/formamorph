import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

/** Shown after a browser build can't reach the configured AI server. The failure is opaque in-page (a
 *  server that's off, a wrong URL, and CORS-disabled all look identical), so this walks the three causes in
 *  likelihood order rather than asserting one. Web-only: the desktop build proxies past browser CORS. */
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Can&apos;t reach your AI server</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            The browser can&apos;t tell exactly why, so check all three:
          </p>

          <ol className="list-decimal list-outside space-y-3 pl-5">
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
                In <strong>Settings → Endpoint</strong> it should point at your server&apos;s address, e.g.{" "}
                <Code>http://localhost:1234/v1/chat/completions</Code>. Double-check the host and port.
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LlmSetupGuide;
