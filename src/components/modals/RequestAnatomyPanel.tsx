import { useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { HintInfo } from '@/components/SettingsRows';
import { RequestAnatomyView } from '@/components/game/RequestAnatomyView';
import { buildAnatomyPreview, type AnatomyConditions, type AnatomyPreviewPrompts } from '@/lib/anatomyPreview';

/**
 * Settings → Prompts → Narration → Anatomy: where the six narration prompt surfaces land in a real
 * request, drawn from an example playthrough so it reads before a game has ever been started.
 *
 * The toggles are assembly conditions, not display switches — each one re-runs the real chain, so a run
 * that disappears disappears because it genuinely isn't sent.
 */

const CONDITIONS: { key: keyof AnatomyConditions; label: string; hint?: string }[] = [
  { key: 'recap', label: 'Memory Summaries condensed' },
  { key: 'recall', label: 'Scene Recall hit', hint: 'Recall pulls from the condensed band, so it needs one' },
  { key: 'brackets', label: 'Bracketed action' },
];

export function RequestAnatomyPanel({
  prompts,
  values,
}: {
  prompts: AnatomyPreviewPrompts;
  values: Record<string, string>;
}) {
  const [conditions, setConditions] = useState<AnatomyConditions>({ recap: true, recall: true, brackets: true });
  const blocks = useMemo(() => buildAnatomyPreview(prompts, values, conditions), [prompts, values, conditions]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border p-2">
        <HintInfo>
          {'One narration request, drawn from an example playthrough.\n\n' +
            '- **Highlighted text** is your own, named by the field it comes from.\n' +
            '- **Dimmed text** is what the app assembled around it.\n' +
            '- **Each toggle** is a real condition — turning one off re-runs the assembly without it.'}
        </HintInfo>
        {CONDITIONS.map(({ key, label, hint }) => {
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
        <RequestAnatomyView blocks={blocks} mode="preview" />
      </ScrollArea>
    </div>
  );
}
