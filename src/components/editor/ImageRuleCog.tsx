import { useContext, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { RequirementRowsField } from '@/components/editor/RequirementRowsField';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { RuleSourceContext, useRuleSource } from '@/contexts/RuleSourceContext';
import { TraitStoreContext } from '@/contexts/TraitStoreContext';
import { labelPlaceholders } from '@/lib/placementLetters';
import { requirementStatSections } from '@/lib/requirementStatOptions';
import { conditionTexts, requirementOptions, ruleStates } from '@/lib/traitGates';
import { shownWhileLine } from '@/lib/traitGateLine';
import { cn } from '@/lib/utils';
import type { TraitRequirementRow } from '@/types';

/** A rule target has nowhere to open in the gallery. */
const noop = () => {};
const never = () => false;

/** Whether anything here can supply a rule's targets: the host's builder, a trait store, or the loaded world. */
export function useHasRuleSource(): boolean {
  const build = useContext(RuleSourceContext);
  const store = useContext(TraitStoreContext);
  const world = useGameDataOptional();
  return !!(build ?? store ?? world);
}

/** The Requirement Rows editor over one image's rule, with the image's own entity as the default owner. */
function ImageRuleRows({ ownerId, rows, onChange }: {
  ownerId: string;
  rows: TraitRequirementRow[];
  onChange: (rows: TraitRequirementRow[]) => void;
}) {
  const source = useRuleSource();
  const read = useMemo(() => source && {
    states: ruleStates(source.gateInput, ownerId, rows),
    // No trait is the host, so nothing is left out of the targets.
    options: requirementOptions(source.gateInput, ''),
    statSections: requirementStatSections(source.gateInput, ownerId),
    textOf: conditionTexts(source.gateInput),
  }, [source, ownerId, rows]);
  if (!source || !read) return null;
  return (
    <RequirementRowsField
      label="Visibility Rule"
      rows={rows}
      states={read.states}
      options={read.options}
      statSections={read.statSections}
      textOf={read.textOf}
      placeholders={source.placeholders}
      offWorld={source.offWorld}
      onChange={onChange}
      onOpen={noop}
      opens={never}
    />
  );
}

/** "Shown while …" under the framed thumbnail, read through the rule text helpers. It mounts only for an image
 *  that has a rule, so an entity with none never builds the gate input. */
export function ImageRuleSummary({ ownerId, rows }: { ownerId: string; rows: TraitRequirementRow[] }) {
  const source = useRuleSource();
  const line = useMemo(
    () => source && shownWhileLine(ruleStates(source.gateInput, ownerId, rows)),
    [source, ownerId, rows],
  );
  if (!source || !line) return null;
  return <p data-image-rule-summary="" className="text-helper text-muted-foreground">{labelPlaceholders(line, source.placeholders)}</p>;
}

/**
 * The cog on a gallery thumbnail. It opens the rows editor in a modal popover, so the wheel scrolls it inside
 * the entity editor's dialog. The popover mounts its rows only while open, so the gate input is built then.
 * `className` places the cog; it shows on hover and focus, and stays while the popover is open.
 */
export function ImageRuleCog({ ownerId, rows, onChange, className }: {
  ownerId: string;
  rows: TraitRequirementRow[];
  onChange: (rows: TraitRequirementRow[]) => void;
  className?: string;
}) {
  return (
    <Popover modal>
      <Tip tip="Visibility Rule">
        <PopoverTrigger asChild>
          <button
            type="button"
            data-image-rule-cog=""
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full bg-overlay/70 text-white',
              'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
              '[@media(hover:none)]:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              className,
            )}
          >
            <Settings className="h-3 w-3" aria-hidden />
          </button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className="w-[28rem] max-w-[calc(100vw-2rem)] space-y-2">
        <ScrollArea className="max-h-[min(24rem,60dvh)]">
          <div className="space-y-2">
            <ImageRuleRows ownerId={ownerId} rows={rows} onChange={onChange} />
            <Hint>Shows this image in play while any row holds. With no rows, it always shows.</Hint>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
