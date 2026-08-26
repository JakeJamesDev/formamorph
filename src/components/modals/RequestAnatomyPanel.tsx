import { useMemo } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HintInfo } from '@/components/SettingsRows';
import { RequestAnatomyView } from '@/components/game/RequestAnatomyView';
import type { PromptJumpTarget } from '@/lib/promptJump';
import {
  buildAnatomyHub,
  type AnatomyConditions, type AnatomyPreviewPrompts, type AnatomyPreviewSettings,
} from '@/lib/anatomyPreview';

/**
 * The Anatomy hub: what a prompt *is*, shown the moment it is selected in Settings → Prompts. The whole
 * request (or requests) that prompt is part of, drawn from an example playthrough under the player's own
 * generation settings, with every highlighted run a way into the editor that owns it.
 */

/** The fixture playthrough at its fullest: every condition the player's settings allow is shown firing.
 *  One a playthrough could skip (no recall hit this turn) still can't promise anything — the builder
 *  drops what the settings themselves rule out. */
const ALL_CONDITIONS: AnatomyConditions = { recap: true, recall: true, brackets: true };

export function RequestAnatomyPanel({
  tab,
  prompts,
  values,
  settings,
  onJump,
  fullscreen,
  onRequestFullscreen,
}: {
  /** Which prompt's hub this is — one of the rail's own ids. */
  tab: string;
  prompts: AnatomyPreviewPrompts;
  values: Record<string, string>;
  settings: AnatomyPreviewSettings;
  /** Open the editor a clicked run belongs to. */
  onJump: (target: PromptJumpTarget) => void;
  /** The Prompts panel's fullscreen, same as the editors toggle — shown as a button when wired. */
  fullscreen?: boolean;
  onRequestFullscreen?: () => void;
}) {
  const requests = useMemo(
    () => buildAnatomyHub(tab, prompts, values, ALL_CONDITIONS, settings),
    [tab, prompts, values, settings],
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* A description line like the System editor's, not a toolbar: one sentence, the fuller legend
          behind the ⓘ, and the panel's one control at the far end. */}
      <div className="mb-2 flex flex-shrink-0 items-center gap-1.5">
        <p className="text-helper text-muted-foreground">
          Highlighted text is yours — click it to open its editor.
        </p>
        <HintInfo>
          {`${requests.length > 1 ? 'The requests' : 'The request'} this prompt is part of, drawn from an example playthrough under your current settings.\n\n` +
            '- **Highlighted text** is your own — click it to open the field it comes from.\n' +
            '- **Dimmed text** is what the app assembled around it.\n' +
            '- **A message that is missing** is one your settings never send.'}
        </HintInfo>
        {onRequestFullscreen && (
          <button
            type="button"
            onClick={onRequestFullscreen}
            title={fullscreen ? 'Exit full screen' : 'View full screen'}
            aria-label={fullscreen ? 'Exit full screen' : 'View full screen'}
            className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0 pr-3">
        {requests.length === 0 ? (
          <p className="text-helper text-muted-foreground">
            Your current settings never send this request, so there is nothing to draw.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {requests.map((request) => (
              <div key={request.key} className="flex flex-col gap-1.5">
                {request.caption && (
                  <p className="text-helper text-muted-foreground italic">{request.caption}</p>
                )}
                <RequestAnatomyView
                  blocks={request.blocks}
                  mode="preview"
                  type={request.type}
                  onJump={onJump}
                />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
