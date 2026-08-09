import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code } from "./guideBits";

/** Explains how to turn a ComfyUI workflow the user already has into the API-format template the Workflow
 *  field expects, by exporting it and swapping the Formamorph-controlled values for %tokens%. */
const ComfyWorkflowGuide = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent aria-describedby={undefined} className="sm:max-w-[600px] max-h-[85dvh] flex flex-col">
      <DialogHeader className="shrink-0">
        <DialogTitle>Use a workflow you already have</DialogTitle>
      </DialogHeader>

      <ScrollArea className="flex-1 min-h-0 pr-3">
        <div className="space-y-3 text-label">
          <p className="text-muted-foreground">
            The Workflow field is a ComfyUI graph in <strong>API format</strong> with <Code>%tokens%</Code>{" "}
            marking the values Formamorph fills in on each generation. To adapt one of your own workflows:
          </p>

          <ol className="list-decimal list-inside space-y-1.5">
            <li>In ComfyUI, open <strong>Settings</strong> and enable <strong>&quot;Enable dev mode options (API save, etc.)&quot;</strong>.</li>
            <li>Load (or build) the workflow you want to use.</li>
            <li>Export it in API format: <strong>Workflow → Export (API)</strong> (older builds: the <strong>Save (API Format)</strong> button) — this downloads a <Code>.json</Code>.</li>
            <li>Open that file and paste everything into the Workflow field here.</li>
            <li>Replace the values Formamorph should control with the tokens below.</li>
          </ol>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="font-medium mb-1">Tokens</p>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>Positive prompt text → <Code>&quot;%prompt%&quot;</Code></li>
              <li>Negative prompt text → <Code>&quot;%negative%&quot;</Code></li>
              <li>Checkpoint (<Code>ckpt_name</Code>) → <Code>&quot;%ckpt%&quot;</Code></li>
              <li>Sampler (<Code>sampler_name</Code>) → <Code>&quot;%sampler%&quot;</Code></li>
              <li>Latent width / height → <Code>%width%</Code> / <Code>%height%</Code></li>
              <li>KSampler seed / steps / cfg → <Code>%seed%</Code> / <Code>%steps%</Code> / <Code>%cfg%</Code></li>
            </ul>
          </div>

          <p className="text-muted-foreground">
            Text tokens go <em>inside</em> the quotes (<Code>&quot;text&quot;: &quot;%prompt%&quot;</Code>); number tokens
            replace the number (<Code>&quot;width&quot;: %width%</Code>). Anything you leave as-is stays fixed every
            generation — so you can hardcode a LoRA, refiner, or resolution and only tokenize what you want to vary.
          </p>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
);

export default ComfyWorkflowGuide;
