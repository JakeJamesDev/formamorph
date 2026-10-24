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
import { locationRuleStates } from '@/lib/imageVisibility';
import { personaHostStatSections, requirementStatSections } from '@/lib/requirementStatOptions';
import { conditionTexts, requirementOptions, ruleStates, type GateInput, type RequirementOptions } from '@/lib/traitGates';
import { shownWhileLine } from '@/lib/traitGateLine';
import { cn } from '@/lib/utils';
import type { TraitRequirementRow } from '@/types';

/** Whose images a rule shows: an entity's, read from that entity, or a location's, read from the played
 *  persona (Q48). */
export type RuleHost = { kind: 'entity'; id: string } | { kind: 'location' };

/** Every location's rule host, one object so a memo keyed on it holds. */
export const LOCATION_RULE_HOST: RuleHost = { kind: 'location' };

/** An entity's rule host, the same object while the id holds. */
export const useEntityRuleHost = (id: string | undefined): RuleHost | undefined =>
  useMemo(() => (id ? { kind: 'entity', id } : undefined), [id]);

/** Each row's state of an image rule on `host`. */
const hostRuleStates = (input: GateInput, host: RuleHost, rows: readonly TraitRequirementRow[]) =>
  (host.kind === 'entity' ? ruleStates(input, host.id, rows) : locationRuleStates(input, rows));

/** A location rule's owner-less Condition already reads the persona, so no target offers Persona again. */
const withoutPersonaOwner = (options: RequirementOptions): RequirementOptions => {
  const dropPersona = (targets: RequirementOptions['traits']) =>
    targets.map((target) => ({ ...target, owners: target.owners.filter((choice) => choice.owner.kind !== 'you') }));
  return { ...options, traits: dropPersona(options.traits), groups: dropPersona(options.groups) };
};

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

/** The Requirement Rows editor over one image's rule, with the host as the default owner. */
function ImageRuleRows({ host, rows, onChange }: {
  host: RuleHost;
  rows: TraitRequirementRow[];
  onChange: (rows: TraitRequirementRow[]) => void;
}) {
  const source = useRuleSource();
  const read = useMemo(() => {
    if (!source) return null;
    // No trait is the host, so nothing is left out of the targets.
    const options = requirementOptions(source.gateInput, '');
    const states = hostRuleStates(source.gateInput, host, rows);
    return host.kind === 'entity'
      ? { states, options, statSections: requirementStatSections(source.gateInput, host.id) }
      : { states, options: withoutPersonaOwner(options), statSections: personaHostStatSections(source.gateInput) };
  }, [source, host, rows]);
  const textOf = useMemo(() => source && conditionTexts(source.gateInput), [source]);
  if (!source || !read || !textOf) return null;
  return (
    <RequirementRowsField
      label="Visibility Rule"
      rows={rows}
      states={read.states}
      options={read.options}
      statSections={read.statSections}
      textOf={textOf}
      hostName={host.kind === 'location' ? 'Persona' : undefined}
      placeholders={source.placeholders}
      offWorld={source.offWorld}
      onChange={onChange}
      onOpen={noop}
      opens={never}
    />
  );
}

/** One image's rule editor with its help line, as the cog's popover and the Media tab's image panel show it. */
export function ImageRuleEditor(props: {
  host: RuleHost;
  rows: TraitRequirementRow[];
  onChange: (rows: TraitRequirementRow[]) => void;
}) {
  return (
    <div className="space-y-2">
      <ImageRuleRows {...props} />
      <Hint>Shows this image in play while any row holds. With no rows, it always shows.</Hint>
    </div>
  );
}

/** "Shown while …" under the framed thumbnail, read through the rule text helpers. It mounts only for an image
 *  that has a rule, so an entity with none never builds the gate input. */
export function ImageRuleSummary({ host, rows }: { host: RuleHost; rows: TraitRequirementRow[] }) {
  const source = useRuleSource();
  const line = useMemo(
    () => source && shownWhileLine(hostRuleStates(source.gateInput, host, rows)),
    [source, host, rows],
  );
  if (!source || !line) return null;
  return <p data-image-rule-summary="" className="text-helper text-muted-foreground">{labelPlaceholders(line, source.placeholders)}</p>;
}

/**
 * The cog on a gallery thumbnail. It opens the rows editor in a modal popover, so the wheel scrolls it inside
 * the entity editor's dialog. The popover mounts its rows only while open, so the gate input is built then.
 * `className` places the cog; it shows on hover and focus, and stays while the popover is open.
 */
export function ImageRuleCog({ host, rows, onChange, className }: {
  host: RuleHost;
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
          <ImageRuleEditor host={host} rows={rows} onChange={onChange} />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
