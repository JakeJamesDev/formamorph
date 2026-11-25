import { Fragment, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SentenceFlipToken, SentenceListToken, SentenceToken } from '@/components/ui/sentence-token';
import type { BreadcrumbPickerRow } from '@/components/ui/breadcrumb-picker';
import { Meta } from '@/components/ui/typography';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { ComparisonToken, NumberValueToken } from '@/components/editor/NumberConditionTokens';
import { readsWithNoOwner, targetKey, type RequirementTargets } from '@/lib/requirementTargets';
import { TimeConditionControls } from '@/components/editor/TimeConditionControls';
import { WeatherConditionControls } from '@/components/editor/WeatherConditionControls';
import { OpeningConditionControls } from '@/components/editor/OpeningConditionControls';
import { ItemConditionControls } from '@/components/editor/ItemConditionControls';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  flipped, requirementOwnerKey, requirementOwnerOf, withRequirementOwner,
  type ClauseHost, type ClausePart, type ClauseView, type RequirementOption, type RequirementOptions,
} from '@/lib/traitGates';
import { Tip } from '@/components/ui/tooltip';
import type { OptionRequirement, Placeholder, RequirementOwner, StatRequirement, TraitRequirement } from '@/types';

/** What every clause of one field reads: the host's targets and names, and where a target opens. */
export interface ClauseContext {
  /** The traits, groups and stats by page, and each target's owner choices. */
  targets: RequirementTargets;
  options: RequirementOptions;
  placeholders: readonly Placeholder[];
  offWorld: boolean;
  clausesOf: (requirement: TraitRequirement, view?: ClauseView) => ClausePart[];
  host: ClauseHost;
  onOpen: (requirement: TraitRequirement) => void;
  opens: (requirement: TraitRequirement) => boolean;
}

/** An edit to one Condition in place. `accepts` refuses one that would repeat a Condition (the duplicate guard). */
export interface ConditionEdit {
  replace: (next: TraitRequirement) => void;
  accepts: (next: TraitRequirement) => boolean;
}

type ItemRequirement = Extract<TraitRequirement, { kind: 'item' }>;
type Tokened = Extract<TraitRequirement, { kind: 'trait' | 'group' | 'playingAs' | 'item' | 'stat' }>;

type SetRequirement = Extract<TraitRequirement, { kind: 'time' | 'weather' | 'opening' }>;
const isSet = (req: TraitRequirement): req is SetRequirement => req.kind === 'time' || req.kind === 'weather' || req.kind === 'opening';

const SET_NOUN: Record<SetRequirement['kind'], string> = { time: 'Time of day', weather: 'Weather', opening: 'Opening' };

/** The four forms of an item verb (Q21), in the order its list shows them. */
const ITEM_FORMS: readonly { status: 'owned' | 'equipped'; not: boolean }[] = [
  { status: 'owned', not: false }, { status: 'owned', not: true }, { status: 'equipped', not: false }, { status: 'equipped', not: true },
];

/** `req` read in one of the item verb's four forms. */
const inForm = (req: ItemRequirement, form: { status: 'owned' | 'equipped'; not: boolean }): ItemRequirement => {
  const { not: _not, ...plain } = req;
  return form.not ? { ...plain, status: form.status, not: true } : { ...plain, status: form.status };
};

const TARGET_NOUN: Record<TraitRequirement['kind'], string> = {
  trait: 'trait', group: 'group', playingAs: 'persona', stat: 'stat', item: 'item', time: 'time of day', weather: 'weather', opening: 'opening', option: 'World Option',
};

const OPTION_VALUE_REASON: Record<'choice' | 'boolean' | 'number', string> = {
  choice: 'This value is no longer a choice.',
  boolean: 'This World Option is now on or off.',
  number: 'This World Option now holds a number.',
};

/** Why `part` of `req` is broken, as its tooltip says it. `optionType` is a World Option's type now. */
function brokenReason(req: TraitRequirement, part: ClausePart, optionType: keyof typeof OPTION_VALUE_REASON = 'choice'): string {
  if (part.why === 'owner') return `This ${TARGET_NOUN[req.kind]} needs an owner.`;
  if (part.why === 'unlinked') return 'No entity has this stat.';
  if (part.role === 'subject') return 'This owner no longer exists.';
  if (part.role === 'value') return OPTION_VALUE_REASON[optionType];
  if (part.role === 'set') {
    if (req.kind === 'time') return 'No time of day is picked.';
    if (req.kind === 'weather') return 'No weather is picked.';
    if (req.kind === 'opening' && !req.openings.length) return 'No opening is picked.';
    return 'A picked opening no longer exists.';
  }
  return `This ${TARGET_NOUN[req.kind]} no longer exists.`;
}

const withoutOwner = (req: TraitRequirement): TraitRequirement => {
  if (!('owner' in req)) return req;
  const { owner: _owner, ...rest } = req;
  // The rest of a union loses its discriminant link; `rest` keeps every field of `req`'s own kind.
  return rest as TraitRequirement;
};

const idOf = (req: TraitRequirement): string => ('id' in req ? req.id ?? '' : '');

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The text the verb flips to, for the verb token's spoken label. */
const flippedText = (parts: readonly ClausePart[], other: readonly ClausePart[]): string =>
  other.find((p, i) => p.text.toLowerCase() !== parts[i]?.text.toLowerCase())?.text ?? '';

/** The swap list's targets: those of the same kind (Q17), each once. */
const peersOf = (req: Tokened, ctx: ClauseContext): readonly RequirementOption[] => {
  if (req.kind === 'item') return (ctx.options.items ?? []).filter((o) => o.requirement.kind === 'item' && o.requirement.status === req.status);
  if (req.kind === 'playingAs') return ctx.options.personas;
  if (req.kind !== 'stat') return ctx.targets.swapList.filter((o) => o.requirement.kind === req.kind);
  // A stat swap keeps its owner (Q34), so its peers are the stats of the pages that store that owner.
  const owner = requirementOwnerKey(requirementOwnerOf(req));
  const seen = new Set<string>();
  return ctx.targets.pages.filter((p) => requirementOwnerKey(p.owner) === owner).flatMap((p) => p.options)
    .filter((o) => o.requirement.kind === 'stat' && !seen.has(idOf(o.requirement)) && seen.add(idOf(o.requirement)));
};

/** A stat swap keeps the owner, operator and Not. A % value stays, since it reads the same on any stat; a Raw value
 *  is the new stat's own default (Q34). This is the one place that decides which fields a stat swap carries. */
export const statSwapped = (req: StatRequirement, option: RequirementOption): TraitRequirement => {
  const next = option.requirement;
  if (next.kind !== 'stat') return next;
  const percent = req.unit === 'percent' ? { unit: 'percent' as const, value: req.value } : {};
  return { ...next, ...percent, ...(req.owner && { owner: req.owner }), operator: req.operator, ...(req.not && { not: true as const }) };
};

/** One Condition as tokens: an owner list, a verb and a target swap list for a trait, a group, a persona or an item
 *  (an item verb lists four forms, and its checks open the State and identity controls); a flip and one set token for
 *  a time, weather or Opening; a stat or World Option has its own tokens. */
export function RequirementClause({ requirement: req, edit, ctx, first }: {
  requirement: TraitRequirement;
  edit: ConditionEdit;
  ctx: ClauseContext;
  /** The clause opens its row's sentence. */
  first: boolean;
}) {
  const view: ClauseView = { host: ctx.host, sentenceStart: first };
  // A Condition with no owner on a target its host does not read alone needs an owner (Q45).
  const needsOwner = !requirementOwnerOf(req) && !readsWithNoOwner(ctx.targets, req);
  const parts = ctx.clausesOf(req, view).map((p) => (needsOwner && p.role === 'target' && !p.broken ? { ...p, broken: true as const, why: 'owner' as const } : p));
  const text = (t: string) => <PlaceholderText text={t} placeholders={ctx.placeholders} />;
  const plain = (t: string) => labelPlaceholders(t, ctx.placeholders);
  if (isSet(req)) return <SetClause requirement={req} parts={parts} edit={edit} ctx={ctx} view={view} />;
  if (req.kind === 'option') return <OptionClause requirement={req} parts={parts} edit={edit} ctx={ctx} />;

  const peers = peersOf(req, ctx);
  const choicesOf = (target: TraitRequirement) => ctx.targets.owners.get(targetKey(target)) ?? [];
  const targetName = (option: RequirementOption) =>
    ctx.clausesOf(option.requirement, { host: ctx.host }).find((p) => p.role === 'target')?.text ?? option.label;

  // The owner choices: the target's, with the stored one first when the target no longer offers it.
  const noOwnerSubject = ctx.clausesOf(withoutOwner(req), { host: ctx.host }).find((p) => p.role === 'subject')?.text;
  const ownerName = (o?: RequirementOwner) => {
    if (!o) return noOwnerSubject ? capital(noOwnerSubject) : 'No owner';
    return o.kind === 'you' ? 'The player' : o.name ?? '';
  };
  const currentOwner = requirementOwnerKey(requirementOwnerOf(req));
  const choices = choicesOf(req);
  const owners: { owner?: RequirementOwner; name: string }[] = (req.kind === 'playingAs' ? []
    : choices.some((o) => requirementOwnerKey(o) === currentOwner) ? choices : [requirementOwnerOf(req), ...choices])
    .map((owner) => ({ owner, name: ownerName(owner) }));
  const ownerRows: BreadcrumbPickerRow<string>[] = owners.map((o) => {
    const key = requirementOwnerKey(o.owner);
    return { key, value: key, name: o.name, disabled: key !== currentOwner && !edit.accepts(withRequirementOwner(withoutOwner(req), o.owner)) };
  });
  const pickOwner = (key: string) => {
    if (key === currentOwner) return;
    edit.replace(withRequirementOwner(withoutOwner(req), owners.find((o) => requirementOwnerKey(o.owner) === key)?.owner));
  };
  const picksOwner = !ctx.offWorld && owners.length > 1;

  // A swap keeps the owner when the new target allows it, else clears it.
  const swapped = (option: RequirementOption): TraitRequirement => {
    if (req.kind === 'stat') return statSwapped(req, option);
    const owner = requirementOwnerOf(req);
    const keeps = owner && choicesOf(option.requirement).some((o) => requirementOwnerKey(o) === requirementOwnerKey(owner));
    const next = req.not ? { ...option.requirement, not: true as const } : option.requirement;
    return withRequirementOwner(next, keeps ? owner : undefined);
  };
  const targetRows: BreadcrumbPickerRow<string>[] = peers.map((o) => ({
    key: idOf(o.requirement), value: idOf(o.requirement), name: targetName(o), breadcrumb: o.breadcrumb,
    disabled: idOf(o.requirement) !== req.id && !edit.accepts(swapped(o)),
  }));
  const pickTarget = (id: string) => {
    const option = peers.find((o) => idOf(o.requirement) === id);
    if (option && id !== req.id) edit.replace(swapped(option));
  };

  const ownerToken = (part: ClausePart) => {
    const reason = part.broken ? brokenReason(req, part) : undefined;
    if (!picksOwner) {
      if (!reason) return text(part.text);
      return (
        <Tip tip={reason}>
          <span tabIndex={0} aria-label={`${plain(part.text)}: ${reason}`} data-broken="" className="text-destructive">
            {text(part.text)}<TriangleAlert className="ml-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
          </span>
        </Tip>
      );
    }
    return (
      <SentenceListToken
        modal label={`Owner: ${plain(part.text)}`} search="Search owners" broken={reason}
        rows={ownerRows} value={currentOwner} onPick={pickOwner} renderText={text} plainText={plain}
      >{text(part.text)}</SentenceListToken>
    );
  };

  const itemVerbToken = (part: ClausePart, item: ItemRequirement) => {
    // "Has equipped" is offered only for an item that fits a slot; the form in use always stays listed.
    const slotted = (ctx.options.items ?? []).some((o) => o.requirement.kind === 'item' && o.requirement.id === item.id && o.requirement.status === 'equipped');
    return (
      <SentenceToken modal label={`Verb: ${part.text}`} editor={(close) => (
        <div className="space-y-1">
          {ITEM_FORMS.map((form) => {
            const next = inForm(item, form);
            const current = form.status === item.status && form.not === !!item.not;
            const name = ctx.clausesOf(next, view).find((p) => p.role === 'verb')?.text ?? '';
            return (
              <Button
                key={`${form.status}:${form.not}`} type="button" size="sm" variant={current ? 'secondary' : 'ghost'} aria-pressed={current}
                disabled={!current && ((form.status === 'equipped' && !slotted) || !edit.accepts(next))}
                className="h-7 w-full justify-start" onClick={() => { close(); if (!current) edit.replace(next); }}
              >{name}</Button>
            );
          })}
        </div>
      )}>{part.text}</SentenceToken>
    );
  };

  const checksToken = (part: ClausePart, item: ItemRequirement) => (
    <SentenceToken modal label={`Checks: ${part.text}`} editor={
      <div className="flex flex-wrap items-center gap-1.5"><ItemConditionControls requirement={item} accepts={edit.accepts} onChange={edit.replace} /></div>
    }>{part.text}</SentenceToken>
  );

  const verbToken = (part: ClausePart) => {
    if (req.kind === 'item') return itemVerbToken(part, req);
    const next = flipped(req);
    return (
      <SentenceFlipToken label={`Change to “${flippedText(parts, ctx.clausesOf(next, view))}”`} disabled={!edit.accepts(next)} onFlip={() => edit.replace(next)}>
        {part.text}
      </SentenceFlipToken>
    );
  };

  const targetToken = (part: ClausePart) => {
    const reason = part.broken ? brokenReason(req, part) : undefined;
    const subjectless = !parts.some((p) => p.role === 'subject') && req.kind !== 'playingAs';
    return (
      <SentenceListToken
        modal label={`Target: ${plain(part.text)}`} search="Search" broken={reason}
        rows={targetRows} value={req.id} onPick={pickTarget} renderText={text} plainText={plain}
        header={(close) => (
          <>
            {subjectless && picksOwner && (
              // A Condition with no subject takes its owner here; once owned, the sentence gains its owner token.
              <div className="space-y-1 border-b p-1.5">
                <Meta as="p" className="px-1">Owner</Meta>
                {owners.map((o) => {
                  const key = requirementOwnerKey(o.owner);
                  const row = ownerRows.find((r) => r.key === key);
                  return (
                    <Button
                      key={key} type="button" size="sm" variant={key === currentOwner ? 'secondary' : 'ghost'} aria-pressed={key === currentOwner}
                      disabled={row?.disabled} className="h-7 w-full justify-start" onClick={() => { close(); pickOwner(key); }}
                    >{text(o.name)}</Button>
                  );
                })}
              </div>
            )}
            {req.kind === 'item' && (
              <div className="flex flex-wrap items-center gap-1.5 border-b p-1.5">
                <ItemConditionControls requirement={req} accepts={edit.accepts} onChange={edit.replace} />
              </div>
            )}
            {ctx.opens(req) && (
              <div className="border-b p-1.5">
                <Button
                  type="button" size="sm" variant="outline" className="h-7 w-full" disabled={!!reason && !part.why} aria-label={`Open ${plain(part.text)}`}
                  onClick={() => { close(); ctx.onOpen(req); }}
                >Open</Button>
              </div>
            )}
          </>
        )}
      >{text(part.text)}</SentenceListToken>
    );
  };

  const statTokens = (part: ClausePart): ReactNode => {
    if (req.kind !== 'stat') return text(part.text);
    if (part.role === 'comparison') {
      return <ComparisonToken word={part.text} operator={req.operator} accepts={(operator) => edit.accepts({ ...req, operator })} onPick={(operator) => edit.replace({ ...req, operator })} />;
    }
    return (
      <NumberValueToken
        text={part.text} value={req.value} unit={req.unit}
        accepts={(change) => edit.accepts({ ...req, ...change })}
        onNumber={(value) => edit.replace({ ...req, value })} onUnit={(unit) => edit.replace({ ...req, unit })}
      />
    );
  };

  return (
    <>
      {parts.map((part, i) => {
        const space = i > 0 && !part.attach ? ' ' : '';
        const token: ReactNode = part.role === 'subject' ? ownerToken(part)
          : part.role === 'verb' ? verbToken(part)
            : part.role === 'target' ? targetToken(part)
              : part.role === 'checks' && req.kind === 'item' ? checksToken(part, req)
                : part.role === 'comparison' || part.role === 'value' ? statTokens(part)
                  : text(part.text);
        // Parts have no ids; their order is fixed by kind.
        return <Fragment key={i}>{space}{token}</Fragment>;
      })}
    </>
  );
}

/** A time, weather or Opening Condition: a flip for its verb and one token over its set, whose popover holds the toggles. */
function SetClause({ requirement: req, parts, edit, ctx, view }: {
  requirement: SetRequirement;
  parts: readonly ClausePart[];
  edit: ConditionEdit;
  ctx: ClauseContext;
  view: ClauseView;
}) {
  const plain = (t: string) => labelPlaceholders(t, ctx.placeholders);
  const next = flipped(req);
  const controls = (() => {
    switch (req.kind) {
      case 'time': return <TimeConditionControls requirement={req} accepts={edit.accepts} onChange={edit.replace} />;
      case 'weather': return ctx.options.weatherKinds && <WeatherConditionControls requirement={req} kinds={ctx.options.weatherKinds} accepts={edit.accepts} onChange={edit.replace} />;
      case 'opening': return ctx.options.openings && <OpeningConditionControls requirement={req} groups={ctx.options.openings} accepts={edit.accepts} onChange={edit.replace} />;
    }
  })();
  return (
    <>
      {parts.map((part, i) => {
        const space = i > 0 ? ' ' : '';
        const text = <PlaceholderText text={part.text} placeholders={ctx.placeholders} />;
        const token: ReactNode = part.role === 'verb' ? (
          <SentenceFlipToken label={`Change to “${flippedText(parts, ctx.clausesOf(next, view))}”`} disabled={!edit.accepts(next)} onFlip={() => edit.replace(next)}>
            {part.text}
          </SentenceFlipToken>
        ) : part.role === 'set' ? (
          <SentenceToken
            modal wide label={`${SET_NOUN[req.kind]}: ${plain(part.text)}`} broken={part.broken ? brokenReason(req, part) : undefined}
            editor={controls && <div className="flex flex-wrap items-center gap-1.5">{controls}</div>}
          >{text}</SentenceToken>
        ) : text;
        return <Fragment key={i}>{space}{token}</Fragment>;
      })}
    </>
  );
}

/** A World Option Condition as tokens: the Option swap list, a verb flip (choice), a comparison (number) and a value
 *  token: a value list, a number box, or an on/off flip. */
function OptionClause({ requirement: req, parts, edit, ctx }: {
  requirement: OptionRequirement;
  parts: readonly ClausePart[];
  edit: ConditionEdit;
  ctx: ClauseContext;
}) {
  const text = (t: string) => <PlaceholderText text={t} placeholders={ctx.placeholders} />;
  const plain = (t: string) => labelPlaceholders(t, ctx.placeholders);
  const choices = ctx.options.worldOptions ?? [];
  const worldOption = choices.find((o) => idOf(o.requirement) === req.id)?.worldOption;
  const type = worldOption?.type ?? (req.operator !== undefined ? 'number' : req.valueId !== undefined ? 'choice' : 'boolean');

  const targetRows: BreadcrumbPickerRow<string>[] = choices.map((o) => ({
    key: idOf(o.requirement), value: idOf(o.requirement), name: o.label,
    disabled: idOf(o.requirement) !== req.id && !edit.accepts(o.requirement),
  }));
  const pickTarget = (id: string) => {
    const option = choices.find((o) => idOf(o.requirement) === id);
    // The new Option starts on its own default value.
    if (option && id !== req.id) edit.replace(option.requirement);
  };

  const targetToken = (part: ClausePart) => {
    const reason = part.broken ? brokenReason(req, part) : undefined;
    return (
      <SentenceListToken
        modal label={`Target: ${plain(part.text)}`} search="Search" broken={reason}
        rows={targetRows} value={req.id} onPick={pickTarget} renderText={text} plainText={plain}
        header={(close) => ctx.opens(req) && (
          <div className="border-b p-1.5">
            <Button
              type="button" size="sm" variant="outline" className="h-7 w-full" disabled={!!reason && !part.why} aria-label={`Open ${plain(part.text)}`}
              onClick={() => { close(); ctx.onOpen(req); }}
            >Open</Button>
          </div>
        )}
      >{text(part.text)}</SentenceListToken>
    );
  };

  const valueToken = (part: ClausePart) => {
    const reason = part.broken ? brokenReason(req, part, type === 'preset' ? undefined : type) : undefined;
    if (type === 'number') {
      return (
        <NumberValueToken
          text={part.text} value={req.value ?? 0} broken={reason}
          accepts={({ value }) => value !== undefined && Number.isInteger(value) && edit.accepts({ ...req, value })}
          onNumber={(value) => edit.replace({ ...req, value })}
        />
      );
    }
    if (type === 'boolean') {
      const next = flipped(req);
      return (
        <SentenceFlipToken label={`Change to “${req.not ? 'on' : 'off'}”`} disabled={!edit.accepts(next)} broken={reason} onFlip={() => edit.replace(next)}>
          {part.text}
        </SentenceFlipToken>
      );
    }
    if (worldOption?.type !== 'choice') return text(part.text);
    const pick = (valueId: string): OptionRequirement =>
      ({ ...req, valueId, valueName: worldOption.values.find((v) => v.id === valueId)?.name ?? req.valueName });
    const rows: BreadcrumbPickerRow<string>[] = worldOption.values.map((v) => ({
      key: v.id, value: v.id, name: v.name, disabled: v.id !== req.valueId && !edit.accepts(pick(v.id)),
    }));
    return (
      <SentenceListToken
        modal label={`Value: ${plain(part.text)}`} search="Search values" broken={reason}
        rows={rows} value={req.valueId} onPick={(id) => { if (id !== req.valueId) edit.replace(pick(id)); }} renderText={text} plainText={plain}
      >{text(part.text)}</SentenceListToken>
    );
  };

  const verbToken = (part: ClausePart) => {
    const next = flipped(req);
    return (
      <SentenceFlipToken label={`Change to “${req.not ? 'is' : 'is not'}”`} disabled={!edit.accepts(next)} onFlip={() => edit.replace(next)}>
        {part.text}
      </SentenceFlipToken>
    );
  };

  return (
    <>
      {parts.map((part, i) => {
        const space = i > 0 && !part.attach ? ' ' : '';
        const token: ReactNode = part.role === 'target' ? targetToken(part)
          : part.role === 'verb' ? verbToken(part)
            : part.role === 'comparison'
              ? <ComparisonToken word={part.text} operator={req.operator ?? '='} accepts={(operator) => edit.accepts({ ...req, operator })} onPick={(operator) => edit.replace({ ...req, operator })} />
              : part.role === 'value' ? valueToken(part) : text(part.text);
        return <Fragment key={i}>{space}{token}</Fragment>;
      })}
    </>
  );
}
