import { Fragment, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SentenceFlipToken, SentenceListToken, SentenceToken } from '@/components/ui/sentence-token';
import type { BreadcrumbPickerRow } from '@/components/ui/breadcrumb-picker';
import { Meta } from '@/components/ui/typography';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { StatConditionControls } from '@/components/editor/StatConditionControls';
import { TimeConditionControls } from '@/components/editor/TimeConditionControls';
import { WeatherConditionControls } from '@/components/editor/WeatherConditionControls';
import { OpeningConditionControls } from '@/components/editor/OpeningConditionControls';
import { ItemConditionControls } from '@/components/editor/ItemConditionControls';
import { OptionConditionControls } from '@/components/editor/OptionConditionControls';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  clauseText, flipped, requirementOwnerKey, requirementOwnerOf, withRequirementOwner,
  type ClauseHost, type ClausePart, type ClauseView, type RequirementOption, type RequirementOptions,
} from '@/lib/traitGates';
import { Tip } from '@/components/ui/tooltip';
import type { Placeholder, RequirementOwner, TraitRequirement } from '@/types';

/** What every clause of one field reads: the host's targets and names, and where a target opens. */
export interface ClauseContext {
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
type Tokened = Extract<TraitRequirement, { kind: 'trait' | 'group' | 'playingAs' | 'item' }>;
const tokened = (req: TraitRequirement): req is Tokened => req.kind === 'trait' || req.kind === 'group' || req.kind === 'playingAs' || req.kind === 'item';

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

/** Why `part` of `req` is broken, as its tooltip says it. */
function brokenReason(req: TraitRequirement, part: ClausePart): string {
  if (part.role === 'subject') return 'This owner no longer exists.';
  if (part.role === 'value') return 'This value is no longer a choice.';
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

/** The swap list's targets: those of the same kind (Q17). */
const peersOf = (req: Tokened, options: RequirementOptions): readonly RequirementOption[] => {
  if (req.kind === 'item') return (options.items ?? []).filter((o) => o.requirement.kind === 'item' && o.requirement.status === req.status);
  return req.kind === 'trait' ? options.traits : req.kind === 'group' ? options.groups : options.personas;
};

/** One Condition as tokens: an owner list, a verb and a target swap list for a trait, a group, a persona or an item
 *  (an item verb lists four forms, and its checks open the State and identity controls); a flip and one set token for
 *  a time, weather or Opening; else one token over the whole clause whose popover holds the kind's controls. */
export function RequirementClause({ requirement: req, edit, ctx, first }: {
  requirement: TraitRequirement;
  edit: ConditionEdit;
  ctx: ClauseContext;
  /** The clause opens its row's sentence. */
  first: boolean;
}) {
  const view: ClauseView = { host: ctx.host, sentenceStart: first };
  const parts = ctx.clausesOf(req, view);
  const text = (t: string) => <PlaceholderText text={t} placeholders={ctx.placeholders} />;
  const plain = (t: string) => labelPlaceholders(t, ctx.placeholders);
  const sentence = plain(clauseText(parts));
  const brokenPart = parts.find((p) => p.broken);
  if (isSet(req)) return <SetClause requirement={req} parts={parts} edit={edit} ctx={ctx} view={view} />;
  if (!tokened(req)) return <WholeClause requirement={req} parts={parts} sentence={sentence} edit={edit} ctx={ctx} broken={brokenPart && brokenReason(req, brokenPart)} />;

  const peers = peersOf(req, ctx.options);
  const own = peers.find((o) => idOf(o.requirement) === req.id);
  const targetName = (option: RequirementOption) =>
    ctx.clausesOf(option.requirement, { host: ctx.host }).find((p) => p.role === 'target')?.text ?? option.label;

  // The owner choices: no owner first, read as its own subject, then the target's owners.
  const noOwnerSubject = ctx.clausesOf(withoutOwner(req), { host: ctx.host }).find((p) => p.role === 'subject')?.text;
  const owners: { owner?: RequirementOwner; name: string }[] = req.kind === 'playingAs' ? [] : [
    { name: noOwnerSubject ? capital(noOwnerSubject) : 'No owner' },
    ...(own?.owners ?? []).map((o) => ({ owner: o.owner, name: o.owner.kind === 'you' ? 'The player' : o.name })),
  ];
  const currentOwner = requirementOwnerKey(requirementOwnerOf(req));
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
    const owner = requirementOwnerOf(req);
    const keeps = owner && option.owners.some((o) => requirementOwnerKey(o.owner) === requirementOwnerKey(owner));
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
                  type="button" size="sm" variant="outline" className="h-7 w-full" disabled={!!reason} aria-label={`Open ${plain(part.text)}`}
                  onClick={() => { close(); ctx.onOpen(req); }}
                >Open</Button>
              </div>
            )}
          </>
        )}
      >{text(part.text)}</SentenceListToken>
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

/** A kind without its own tokens yet: the whole clause as one token, its popover holding the kind's controls. */
function WholeClause({ requirement: req, parts, sentence, edit, ctx, broken }: {
  requirement: Exclude<TraitRequirement, Tokened | SetRequirement>;
  parts: readonly ClausePart[];
  sentence: string;
  edit: ConditionEdit;
  ctx: ClauseContext;
  broken?: string;
}) {
  const next = flipped(req);
  // A number World Option flips by its operator, so its controls hold the Not.
  const flips = !(req.kind === 'option' && req.operator !== undefined);
  const option = req.kind === 'option' && !broken ? ctx.options.worldOptions?.find((o) => idOf(o.requirement) === req.id)?.worldOption : undefined;
  const controls = (() => {
    switch (req.kind) {
      case 'stat': return <StatConditionControls requirement={req} accepts={edit.accepts} onChange={edit.replace} />;
      case 'option': return option && option.type !== 'boolean' && <OptionConditionControls option={option} requirement={req} accepts={edit.accepts} onChange={edit.replace} />;
    }
  })();
  return (
    <SentenceToken modal wide label={`Edit ${sentence}`} broken={broken} editor={(
      <div className="space-y-2">
        {controls && <div className="flex flex-wrap items-center gap-1.5">{controls}</div>}
        {flips && (
          <Button type="button" size="sm" variant="outline" className="h-7" disabled={!edit.accepts(next)} onClick={() => edit.replace(next)}>
            Change to &ldquo;{flippedText(parts, ctx.clausesOf(next, { host: ctx.host }))}&rdquo;
          </Button>
        )}
      </div>
    )}>
      <PlaceholderText text={clauseText(parts)} placeholders={ctx.placeholders} />
    </SentenceToken>
  );
}
