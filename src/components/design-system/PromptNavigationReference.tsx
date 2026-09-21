import { useState } from 'react';
import { PromptNavigationRail } from '@/components/modals/PromptNavigationRail';
import { Hint, SectionTitle } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HUB_LABEL, PROMPT_GROUPS, PROMPT_LABELS, SURFACE_LABELS, type PromptSurface, type PromptTab } from '@/lib/promptGroups';

export function PromptNavigationReference() {
  const [prompt, setPrompt] = useState('location');
  const [surface, setSurface] = useState<PromptSurface | null>('system');
  const surfaces: PromptSurface[] = ['system', 'user', 'options'];
  return (
    <section aria-label="Prompt Navigation" className="flex h-[420px] min-h-0 flex-col gap-4 rounded-lg border bg-background p-4 md:flex-row">
      <PromptNavigationRail groups={PROMPT_GROUPS} labels={PROMPT_LABELS} activePrompt={prompt}
        surface={surface} surfaces={surfaces} showingOverview={false} hasOverview={false}
        onOverview={() => {}} onPrompt={id => { setPrompt(id); setSurface(null); }} onSurface={setSurface} />
      <div className="md:hidden">
        <Select value={surface ?? 'anatomy'} onValueChange={value => setSurface(value === 'anatomy' ? null : value as PromptSurface)}>
          <SelectTrigger aria-label="Prompt Section"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="anatomy">{HUB_LABEL}</SelectItem>
            {surfaces.map(part => <SelectItem key={part} value={part}>{SURFACE_LABELS[part]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <SectionTitle>{PROMPT_LABELS[prompt as PromptTab]}</SectionTitle>
        <Hint>{surface ? SURFACE_LABELS[surface] : HUB_LABEL}</Hint>
      </div>
    </section>
  );
}
