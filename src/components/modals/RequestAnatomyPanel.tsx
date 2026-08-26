import { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { HintInfo } from '@/components/SettingsRows';
import { RequestAnatomyView } from '@/components/game/RequestAnatomyView';
import type { PromptJumpTarget } from '@/lib/promptJump';
import {
  buildAnatomyHub, hubToggleAvailability,
  type AnatomyConditions, type AnatomyPreviewPrompts, type AnatomyPreviewSettings,
} from '@/lib/anatomyPreview';

/**
 * The Anatomy hub: what a prompt *is*, shown the moment it is selected in Settings → Prompts. The whole
 * request (or requests) that prompt is part of, drawn from an example playthrough under the player's own
 * generation settings, with every highlighted run a way into the editor that owns it.
 *
 * The toggles are assembly conditions, not display switches — each one re-runs the real chain, so a run
 * that disappears disappears because it genuinely isn't sent. A condition the player's settings can't
 * produce has no toggle at all, and neither does a prompt whose own pass never reads one.
 */

const CONDITIONS: { key: keyof AnatomyConditions; label: string; hint?: string }[] = [
  { key: 'recap', label: 'Memory Summaries condensed' },
  { key: 'recall', label: 'Scene Recall hit', hint: 'Recall pulls from the condensed band, so it needs one' },
  { key: 'brackets', label: 'Bracketed action' },
];

export function RequestAnatomyPanel({
  tab,
  prompts,
  values,
  settings,
  onJump,
}: {
  /** Which prompt's hub this is — one of the rail's own ids. */
  tab: string;
  prompts: AnatomyPreviewPrompts;
  values: Record<string, string>;
  settings: AnatomyPreviewSettings;
  /** Open the editor a clicked run belongs to. */
  onJump: (target: PromptJumpTarget) => void;
}) {
  const [conditions, setConditions] = useState<AnatomyConditions>({ recap: true, recall: true, brackets: true });
  const available = hubToggleAvailability(tab, settings);
  const requests = useMemo(
    () => buildAnatomyHub(tab, prompts, values, conditions, settings),
    [tab, prompts, values, conditions, settings],
  );
  const toggles = CONDITIONS.filter(({ key }) => available[key]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border p-2">
        <HintInfo>
          {`${requests.length > 1 ? 'The requests' : 'The request'} this prompt is part of, drawn from an example playthrough under your current settings.\n\n` +
            '- **Highlighted text** is your own — click it to open the field it comes from.\n' +
            '- **Dimmed text** is what the app assembled around it.\n' +
            (toggles.length
              ? '- **Each toggle** is a real condition — turning one off re-runs the assembly without it.'
              : '')}
        </HintInfo>
        {toggles.map(({ key, label, hint }) => {
          const disabled = key === 'recall' && !conditions.recap;
          return (
            <label
              key={key}
              className={`flex items-center gap-1.5 text-label ${disabled ? 'text-muted-foreground' : 'cursor-pointer'}`}
              title={disabled ? hint : undefined}
            >
              <Checkbox
                checked={conditions[key] && !disabled}
                disabled={disabled}
                onCheckedChange={(v) => setConditions((c) => ({ ...c, [key]: v === true }))}
              />
              {label}
            </label>
          );
        })}
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
