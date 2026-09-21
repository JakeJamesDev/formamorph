import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Meta } from '@/components/ui/typography';
import { OVERVIEW_LABEL, SURFACE_LABELS, type PromptGroup, type PromptSurface } from '@/lib/promptGroups';

interface PromptNavigationRailProps {
  groups: PromptGroup[];
  labels: Record<string, string>;
  activePrompt: string;
  surface: PromptSurface | null;
  surfaces: PromptSurface[];
  showingOverview: boolean;
  hasOverview: boolean;
  onOverview: () => void;
  onPrompt: (id: string) => void;
  onSurface: (surface: PromptSurface) => void;
}

export function PromptNavigationRail({ groups, labels, activePrompt, surface, surfaces,
  showingOverview, hasOverview, onOverview, onPrompt, onSurface }: PromptNavigationRailProps) {
  return (
    <ScrollArea className="hidden md:flex min-h-0 w-[210px] shrink-0 border-r pr-3"
      viewportProps={{ className: 'overscroll-contain', 'data-prompt-rail-viewport': '' }}>
      <nav aria-label="Prompts" className="flex flex-col pb-3">
        {hasOverview && (
          <CompactSelectionRow selected={showingOverview} showCheck={false} aria-pressed={undefined}
            aria-current={showingOverview ? 'true' : undefined} onClick={onOverview}>
            {OVERVIEW_LABEL}
          </CompactSelectionRow>
        )}
        {groups.map(group => (
          <div key={group.label}>
            <div className="flex items-center gap-2 px-2 pb-1 pt-4">
              <Meta className="font-semibold uppercase tracking-wider">{group.label}</Meta>
              <span className="h-hairline flex-1 bg-border" aria-hidden />
            </div>
            {group.tabs.map(id => {
              const open = !showingOverview && activePrompt === id;
              const current = open && surface === null;
              return (
                <div key={id}>
                  <CompactSelectionRow selected={current} showCheck={false} aria-pressed={undefined}
                    aria-current={current ? 'true' : undefined}
                    className={open && !current ? 'font-medium bg-accent/40' : undefined}
                    onClick={() => onPrompt(id)}>
                    {labels[id] ?? id}
                  </CompactSelectionRow>
                  {open && (
                    <div className="my-1 ml-3 pl-2">
                      {surfaces.map(part => (
                        <CompactSelectionRow key={part} selected={surface === part} showCheck={false}
                          className="text-meta" aria-pressed={undefined} aria-current={surface === part ? 'true' : undefined}
                          onClick={() => onSurface(part)}>
                          {SURFACE_LABELS[part]}
                        </CompactSelectionRow>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}
