import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  dialogFullHeightMobile,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { ActionIcon } from '@/lib/actionIcons';
import { toast } from 'react-toastify';
import { toastError } from '@/lib/linkToast';
import { downloadBlob } from '@/lib/downloadBlob';
import { importPackFile } from '@/lib/importFiles';
import { useResetOnOpen } from '@/lib/useResetOnOpen';
import { useIsMobile } from '@/lib/useIsMobile';
import { cn } from '@/lib/utils';
import { CodeArea } from '@/components/prompt/CodeArea';
import { HighlightedCode } from '@/components/prompt/HighlightedCode';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  BUILT_IN_TEMPLATES,
  DAYPART_OPTIONS,
  defaultSlotValues,
  fillTemplate,
  humanizeSlotName,
  isBuiltInTemplate,
  missingParams,
  newParamName,
  parseTemplateSlots,
  resolveSlotValue,
  validateSlotValues,
  isNameSlotType,
  ownerAnswer,
  PERSONA_SLOT_OWNER,
  templatesFor,
  templateTimingLabels,
  TEMPLATE_TIMING_LABEL,
  TEMPLATE_TIMINGS,
  withTimings,
  type CodeTemplate,
  type NameSlotType,
  type TemplateKind,
  type TemplateSlot,
} from '@/lib/statCodeTemplates';
import { REPLACE_CODE_DESCRIPTION, REPLACE_CODE_TITLE } from '@/lib/statCodeTiming';
import { MultiSelect } from '@/components/ui/multi-select';
import { SCRIPT_SURFACES, scriptSurface } from '@/lib/statCodeSurface';
import type { VariableTreeOwner } from '@/lib/statCodeVariableTree';
import { keyedEntity, type CodeEntityNames, type CodeTraitPlace } from '@/lib/statCodeAnalysis';
import type { SandboxPlace } from '@/lib/statCodeExecutor';
import { BreadcrumbPicker, type BreadcrumbPickerRow } from '@/components/ui/breadcrumb-picker';
import { WORLD_BREADCRUMB } from '@/lib/traitGates';
import {
  buildTemplatePack,
  deleteUserTemplate,
  importTemplates,
  listUserTemplates,
  parseTemplatePack,
  saveUserTemplate,
} from '@/services/StatTemplateStorageService';
import type { ScriptTiming, Stat, ToolParam, ToolParamType, ToolScriptTiming } from '@/types';
import { Tip } from '@/components/ui/tooltip';
import { Hint, Meta } from '@/components/ui/typography';
import { namedParams } from '@/lib/tools/toolDraft';
import { worldToolArgsNodes, worldToolSurface } from '@/lib/tools/worldToolSurface';

/** The box a menu fills: a stat or world script's timing, or a World Tool's timing and Parameters. */
type TemplateBox =
  | { kind: 'script' | 'worldScript'; timing: ScriptTiming }
  | { kind: 'worldTool'; timing: ToolScriptTiming; params: readonly ToolParam[] };

/** The templates that `box`'s menu lists. */
const menuOf = (templates: readonly CodeTemplate[], box: TemplateBox): CodeTemplate[] => (box.kind === 'worldTool'
  ? templatesFor(templates, 'worldTool', box.timing)
  : templatesFor(templates, box.kind, box.timing));

/** A new template starts in the box the author opened the menu from, which is where they were about to
 *  paste it. The Runs field is right there to add more. */
const blankTemplate = (box: TemplateBox): CodeTemplate => {
  const fields = { id: '', name: '', description: '' };
  switch (box.kind) {
    case 'script': return { ...fields, kind: 'script', code: 'return {{amount:number=1}};', timings: [box.timing] };
    case 'worldScript': return { ...fields, kind: 'worldScript', code: 'stats[{{stat:stat}}].value += {{amount:number=1}};', timings: [box.timing] };
    case 'worldTool': return { ...fields, kind: 'worldTool', code: 'return String(args[{{parameter:param}}]);', timings: [box.timing] };
  }
};

/** A Parameter type as the Parameters tab names it. */
const PARAM_TYPE_LABEL: Record<ToolParamType, string> = { string: 'Text', number: 'Number', boolean: 'True/False', enum: 'One of a List' };

/** The breadcrumb of the row that makes a new Parameter. */
const NEW_PARAM_CRUMB: readonly string[] = ['New'];

/** Whether a draft has a name, code and a timing to run in. */
const canSave = (draft: CodeTemplate): boolean => !!draft.name.trim() && !!draft.code.trim() && draft.timings.length > 0;

/** The Runs field's options for a kind's templates. */
const timingOptions = (template: CodeTemplate): { value: string; label: string }[] => {
  const labels: Record<string, string> = TEMPLATE_TIMING_LABEL[template.kind];
  return TEMPLATE_TIMINGS[template.kind].map((value) => ({ value, label: labels[value] }));
};

export interface StatTemplateRepository {
  list: () => Promise<CodeTemplate[]>;
  save: (template: CodeTemplate) => Promise<CodeTemplate>;
  remove: (id: string) => Promise<void>;
  import: (templates: CodeTemplate[]) => Promise<number>;
}

export interface StatTemplateFileTransfer {
  readImportPack: () => Promise<string | null>;
  writeExportPack: (contents: string, filename: string) => void;
}

const productionRepository: StatTemplateRepository = {
  list: listUserTemplates,
  save: saveUserTemplate,
  remove: deleteUserTemplate,
  import: importTemplates,
};

/** The world's names the name slots pick from, under their code names. */
interface SlotNames {
  /** The world's stats, which `stats` keys. */
  stat: readonly Stat[];
  /** The owner's own stats, which `owner.stats` keys. Absent in a world stat's box. */
  ownerStat?: readonly Stat[];
  /** The names `placeholders["X"]` reaches, under their Placeholders-tab folders. */
  placeholder: readonly CodeTraitPlace[];
  /** The world's own traits, which `traits` keys. */
  trait: readonly CodeTraitPlace[];
  /** The owning entity's traits, which `owner.traits` keys. Absent outside an entity stat's box. */
  ownerTrait?: readonly CodeTraitPlace[];
  entities: readonly CodeEntityNames[];
  /** The world's locations under their code names, which `location.move` names. */
  location: readonly SandboxPlace[];
  /** The Tool's named Parameters, which `args` keys. Empty outside a World Tool's box. */
  param: readonly ToolParam[];
}

/** Every slot whose value can't be used, keyed by slot name. A parameter slot whose name is taken by a
 *  Parameter of another type says so, since Insert would not create it. */
const slotProblems = (slots: readonly TemplateSlot[], values: Record<string, string>, names: SlotNames): Record<string, string> => ({
  ...validateSlotValues([...slots], values),
  ...Object.fromEntries(slots.flatMap((slot): [string, string][] => {
    if (slot.type !== 'param') return [];
    const taken = names.param.find((param) => param.name === resolveSlotValue(slot, values));
    return taken && taken.type !== slot.paramType
      ? [[slot.name, `“${taken.name}” is a ${PARAM_TYPE_LABEL[taken.type]} Parameter`]]
      : [];
  })),
});

type SlotRow = BreadcrumbPickerRow<string>;

/** What a name slot's empty picker asks for, and what its search field says. */
const PROMPTS: Record<NameSlotType, { pick: string; search: string }> = {
  stat: { pick: 'Pick a stat…', search: 'Search stats' },
  placeholder: { pick: 'Pick a placeholder…', search: 'Search placeholders' },
  trait: { pick: 'Pick a trait…', search: 'Search traits' },
  entity: { pick: 'Pick an entity…', search: 'Search entities' },
  location: { pick: 'Pick a location…', search: 'Search locations' },
  param: { pick: 'Pick a parameter…', search: 'Search parameters' },
};

const OWNER_CRUMB: readonly string[] = ['Owner'];
const NO_STATS: readonly Stat[] = [];
const NO_PLACES: readonly SandboxPlace[] = [];

/** Each name once, in first-seen order, as rows with no breadcrumb. */
const plainRows = (names: readonly string[] | null): SlotRow[] =>
  [...new Set(names)].map((name) => ({ key: name, value: name, name }));

/** The items in their tab's order. */
const inTabOrder = <T extends { tabPosition?: number }>(items: readonly T[]): T[] => items
  .map((item, listed) => ({ item, listed }))
  .sort((a, b) => (a.item.tabPosition ?? a.listed) - (b.item.tabPosition ?? b.listed))
  .map(({ item }) => item);

/** The keyed entities in Entities-tab order, each under its folders. A shared name lists the entity the sandbox keys. */
const entityRows = (entities: readonly CodeEntityNames[]): SlotRow[] =>
  inTabOrder(entities)
    .filter((entity) => keyedEntity(entities, entity.name) === entity)
    .map((entity) => ({ key: entity.id, value: entity.name, name: entity.name, breadcrumb: entity.folder }));

/** One entity's traits in its own tree order, each under `lead` and then its own groups. */
const traitRows = (entity: CodeEntityNames, lead: readonly string[]): SlotRow[] =>
  inTabOrder(entity.traits).map((trait) => ({
    key: `${entity.id}:${trait.id}`, value: trait.name, name: trait.name, breadcrumb: [...lead, ...trait.path],
  }));

/** Each persona entity's traits under its name, in Entities-tab order. A name two of them hold lists under both. */
const personaTraitRows = (entities: readonly CodeEntityNames[]): SlotRow[] => inTabOrder(entities)
  .filter((entity) => entity.persona)
  .flatMap((entity) => traitRows(entity, entity.name ? [entity.name] : []));

/** One entity's stats in authored order, each under `lead`. */
const entityStatRows = (entity: CodeEntityNames, lead: readonly string[]): SlotRow[] =>
  [...new Set(entity.stats)].map((name) => ({ key: `${entity.id}:stat:${name}`, value: name, name, breadcrumb: lead }));

/** Each persona entity's stats under its name, in Entities-tab order. */
const personaStatRows = (entities: readonly CodeEntityNames[]): SlotRow[] => inTabOrder(entities)
  .filter((entity) => entity.persona)
  .flatMap((entity) => entityStatRows(entity, entity.name ? [entity.name] : []));

/** The entity a tied slot's entity slot picked. Undefined for an untied slot, null before a pick. */
const tiedEntity = (slot: TemplateSlot, slots: readonly TemplateSlot[], values: Record<string, string>, names: SlotNames) => {
  const owner = slots.find((other) => other.name === slot.owner && other.type === 'entity');
  return owner && (keyedEntity(names.entities, resolveSlotValue(owner, values)) ?? null);
};

/** The answers with `slot` set to `value`. The slots tied to it clear, since they held the old entity's names. */
const withAnswer = (answers: Record<string, string>, slots: readonly TemplateSlot[], slot: TemplateSlot, value: string) => ({
  ...answers,
  ...Object.fromEntries(slots.filter((other) => other.owner === slot.name).map((other) => [other.name, ''])),
  [slot.name]: value,
});

/** What a slot's picker offers, given the answers so far. A tied trait or stat slot lists its entity's names. */
function slotOptions(slot: TemplateSlot, slots: readonly TemplateSlot[], values: Record<string, string>, names: SlotNames): SlotRow[] {
  const tied = tiedEntity(slot, slots, values, names);
  switch (slot.type) {
    case 'stat': {
      if (tied !== undefined) return tied ? entityStatRows(tied, []) : [];
      if (slot.owner === PERSONA_SLOT_OWNER) return personaStatRows(names.entities);
      // An owned box lists both lists under a crumb each; the answer carries the list, so equal names stay two rows.
      const crumb = names.ownerStat ? { breadcrumb: WORLD_BREADCRUMB } : {};
      const world = names.stat.map((stat) => ({ key: stat.id, value: stat.name, name: stat.name, ...crumb }));
      const owner = (names.ownerStat ?? []).map((stat) => ({
        key: `owner:${stat.id}`, value: ownerAnswer(stat.name), name: stat.name, breadcrumb: OWNER_CRUMB,
      }));
      return [...owner, ...world];
    }
    case 'placeholder':
      return names.placeholder.map((place) => ({ key: place.id, value: place.name, name: place.name, breadcrumb: place.path }));
    case 'entity':
      return entityRows(names.entities);
    case 'location':
      return names.location.map((place) => ({ key: place.id, value: place.name, name: place.name }));
    case 'trait': {
      if (tied !== undefined) return tied ? traitRows(tied, []) : [];
      if (slot.owner === PERSONA_SLOT_OWNER) return personaTraitRows(names.entities);
      // The owner's traits lead under Owner; the answer carries the list, so equal names stay two rows.
      const owner = inTabOrder(names.ownerTrait ?? []).map((trait) => ({
        key: `owner:${trait.id}`, value: ownerAnswer(trait.name), name: trait.name, breadcrumb: [...OWNER_CRUMB, ...trait.path],
      }));
      const world = names.trait.map((trait) => ({
        key: trait.id, value: trait.name, name: trait.name, breadcrumb: trait.path.length > 0 ? trait.path : WORLD_BREADCRUMB,
      }));
      return [...owner, ...world];
    }
    case 'param': {
      // The Tool's Parameters of the slot's type, then a row that makes the one the template names.
      const own = names.param.filter((param) => param.type === slot.paramType).map((param) => param.name);
      const fresh = newParamName(slot);
      const create = names.param.some((param) => param.name === fresh)
        ? []
        : [{ key: `new:${fresh}`, value: fresh, name: fresh, breadcrumb: NEW_PARAM_CRUMB }];
      return [...plainRows(own), ...create];
    }
    case 'daypart':
      return plainRows(DAYPART_OPTIONS);
    default:
      return plainRows(slot.options ?? []);
  }
}

/** One control for one slot. Name and daypart slots pick from a list so the generated string is always
 *  a name the sandbox will actually match. */
function SlotField({ slot, value, problem, options, onChange }: {
  slot: TemplateSlot;
  value: string;
  problem?: string;
  options: readonly SlotRow[];
  onChange: (value: string) => void;
}) {
  /** What the author is part-way through typing, or null when the field is showing its resolved value. */
  const [typing, setTyping] = useState<string | null>(null);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const problemId = `${fieldId}-problem`;

  return (
    <label htmlFor={fieldId} className="flex flex-col gap-1 min-w-0">
      <span id={labelId} className="text-label">{humanizeSlotName(slot.name)}</span>
      {slot.type === 'number' || slot.type === 'text' ? (
        <Input
          id={fieldId}
          aria-labelledby={labelId}
          aria-invalid={!!problem}
          aria-describedby={problem ? problemId : undefined}
          // While the field is being typed in it shows exactly what was typed, empty included. Resolving
          // on every keystroke would refill a backspaced field before the next character landed, so a
          // defaulted number could only be replaced by typing over the selection.
          value={typing ?? value}
          inputMode={slot.type === 'number' ? 'decimal' : undefined}
          onChange={(e) => { setTyping(e.target.value); onChange(e.target.value); }}
          onBlur={() => setTyping(null)}
        />
      ) : isNameSlotType(slot.type) ? (
        <BreadcrumbPicker
          sections={[{ rows: options }]}
          value={value}
          onPick={onChange}
          placeholder={PROMPTS[slot.type].pick}
          searchPlaceholder={PROMPTS[slot.type].search}
          id={fieldId}
          ariaLabelledBy={labelId}
          ariaInvalid={!!problem}
          ariaDescribedBy={problem ? problemId : undefined}
        />
      ) : (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger
            id={fieldId}
            aria-labelledby={labelId}
            aria-invalid={!!problem}
            aria-describedby={problem ? problemId : undefined}
          >
            <SelectValue placeholder="Pick one…" />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 && <div className="px-2 py-1.5 text-meta text-muted-foreground">Nothing to pick</div>}
            {options.map(option => <SelectItem key={option.key} value={option.value}>{option.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {problem && <span id={problemId} className="text-meta text-destructive">{problem}</span>}
    </label>
  );
}

/** The fill-in form and the code it generates. Shared by the picker and the template editor's Preview tab,
 *  so an author writing a template sees the exact interface theirs will present. */
function TemplateForm({ code, kind, names, values, onChange }: {
  code: string;
  kind: TemplateKind;
  names: SlotNames;
  values: Record<string, string>;
  onChange: (update: (values: Record<string, string>) => Record<string, string>) => void;
}) {
  const parsed = useMemo(() => parseTemplateSlots(code, kind), [code, kind]);
  const problems = slotProblems(parsed.slots, values, names);

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {parsed.errors.length > 0 && <p className="text-helper text-destructive">{parsed.errors.join(' ')}</p>}

      {parsed.slots.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {parsed.slots.map(slot => (
            <SlotField
              key={slot.name}
              slot={slot}
              options={slotOptions(slot, parsed.slots, values, names)}
              // Read through the resolver rather than straight out of `values`: a slot the author has
              // only just typed into the code has no answer yet, and its declared default is what the
              // generated code below already shows for it.
              value={resolveSlotValue(slot, values)}
              problem={problems[slot.name]}
              onChange={(value) => onChange(current => withAnswer(current, parsed.slots, slot, value))}
            />
          ))}
        </div>
      ) : (
        <p className="text-meta text-muted-foreground">This template asks for nothing — it inserts as it is.</p>
      )}

      <div className="flex flex-col gap-1 min-h-0">
        <Label className="text-label">Code</Label>
        <HighlightedCode
          code={fillTemplate(code, values)}
          className="rounded-md border bg-muted/40 p-2 text-meta"
        />
      </div>
    </div>
  );
}

/** The box a dialog fills: a stat script's by default, a world script's, or a World Tool's with its Parameters. */
type BoxProps =
  | {
    kind?: 'script' | 'worldScript';
    /** The box this menu fills. It lists the templates that run in that box, and a template saved here
     *  starts out running in it. */
    timing: ScriptTiming;
    params?: undefined;
  }
  | {
    kind: 'worldTool';
    timing: ToolScriptTiming;
    /** The Tool's Parameters, which a parameter slot picks from. */
    params: readonly ToolParam[];
  };

/**
 * Browse, fill in and manage code templates for a stat script or a World Tool script. Inserting generates
 * plain JavaScript into the box — the finished script keeps no link to the template it came from, so the
 * author is free to edit the result by hand afterwards.
 */
export function StatCodeTemplateDialog({
  open,
  onOpenChange,
  stats,
  owner,
  ownerStats = NO_STATS,
  currentStatId,
  hasExistingCode,
  onInsert,
  placeholderPlaces = [],
  traitPlaces = [],
  ownerTraits,
  entities = [],
  locations = NO_PLACES,
  repository = productionRepository,
  fileTransfer,
  ...boxProps
}: BoxProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The world's stats, under their code names: what a slot fills in has to be what the run reaches. */
  stats: Stat[];
  /** The kind of owner the box's code runs under. Its stat slots list `ownerStats` beside `stats`, and its
   *  Variable menu gets an Owner group. */
  owner?: VariableTreeOwner['kind'];
  /** The owner's own stats, under their code names. */
  ownerStats?: readonly Stat[];
  /** Excluded from stat pickers — a stat built from itself is a mistake, and templates reach their own
   *  value through `self` rather than by name. */
  currentStatId?: string;
  hasExistingCode: boolean;
  /** What a placeholder slot's picker offers. */
  placeholderPlaces?: readonly CodeTraitPlace[];
  /** What an untied trait slot's picker offers. */
  traitPlaces?: readonly CodeTraitPlace[];
  /** The owning entity's traits, which an untied trait slot lists first. Only an entity stat's box passes them. */
  ownerTraits?: readonly CodeTraitPlace[];
  /** What an entity slot and a tied trait slot offer. */
  entities?: readonly CodeEntityNames[];
  /** What a location slot offers, under code names. */
  locations?: readonly SandboxPlace[];
  /** Gets the filled code, and the Parameters the Tool lacks that its Parameter slots name. The caller adds them. */
  onInsert: (code: string, createdParams: ToolParam[]) => void;
  repository?: StatTemplateRepository;
  fileTransfer?: StatTemplateFileTransfer;
}) {
  const { kind: boxKind, timing, params } = boxProps;
  const box = useMemo<TemplateBox>(() => (boxKind === 'worldTool'
    ? { kind: 'worldTool', timing, params }
    : { kind: boxKind ?? 'script', timing }), [boxKind, timing, params]);
  const { kind } = box;
  const timingLabel = box.kind === 'worldTool' ? TEMPLATE_TIMING_LABEL.worldTool[box.timing] : TEMPLATE_TIMING_LABEL[box.kind][box.timing];
  const [userTemplates, setUserTemplates] = useState<CodeTemplate[]>([]);
  const builtIns = useMemo(() => menuOf(BUILT_IN_TEMPLATES, box), [box]);
  const firstBuiltIn = builtIns[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState<string>(firstBuiltIn);
  const [values, setValues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<CodeTemplate | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<CodeTemplate | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const runsId = useId();

  const refresh = useCallback(async () => {
    try {
      setUserTemplates(await repository.list());
    } catch (error) {
      toastError(error, { headline: `Couldn’t read your templates: ${(error as Error).message}` });
    }
  }, [repository]);

  useResetOnOpen(open, () => {
    setSelectedId(firstBuiltIn);
    setDraft(null);
    void refresh();
  });

  const sortedUser = useMemo(
    () => menuOf(userTemplates, box).sort((a, b) => a.name.localeCompare(b.name)),
    [userTemplates, box],
  );
  const all = useMemo(() => [...builtIns, ...sortedUser], [builtIns, sortedUser]);
  const selected = all.find(template => template.id === selectedId) ?? all[0];
  const slotNames = useMemo<SlotNames>(() => ({
    stat: stats.filter(stat => stat.id !== currentStatId && stat.name),
    ...(owner ? { ownerStat: ownerStats.filter(stat => stat.id !== currentStatId && stat.name) } : {}),
    placeholder: placeholderPlaces,
    trait: traitPlaces,
    ...(ownerTraits && { ownerTrait: ownerTraits }),
    entities,
    location: locations,
    param: params ? namedParams(params) : [],
  }), [stats, owner, ownerStats, currentStatId, placeholderPlaces, traitPlaces, ownerTraits, entities, locations, params]);
  // The template editor has no world, so its Owner group types over each name.
  const treeOwner = useMemo<VariableTreeOwner | null>(() => {
    if (!owner) return null;
    return owner === 'entity' ? { kind: 'entity', entity: null } : { kind: 'blueprint', statNames: null };
  }, [owner]);
  // Every stat, not the pickable ones: a slot picker must not offer the stat being edited (a formula
  // reading its own value from the list is a loop), but code written by hand may read it by name, so its
  // name belongs in the completions.
  const statNames = useMemo(
    () => stats.map(stat => stat.name).filter((name): name is string => !!name),
    [stats],
  );
  const parsed = useMemo(() => parseTemplateSlots(selected?.code ?? '', kind), [selected?.code, kind]);
  // The editor's surface adds the names of the draft's first timing; a World Tool draft's adds `args` from the
  // Tool's Parameters. A stable object keeps the editor from resetting.
  const scriptTiming = draft && draft.kind !== 'worldTool' ? draft.timings[0] : undefined;
  const toolTiming = draft?.kind === 'worldTool' ? draft.timings[0] : undefined;
  const draftSurface = useMemo(() => {
    if (box.kind === 'worldTool') return worldToolSurface(box.params, toolTiming ?? box.timing);
    const surface = SCRIPT_SURFACES[box.kind === 'worldScript' ? 'world' : 'stat'];
    return scriptTiming ? scriptSurface(surface, scriptTiming) : surface;
  }, [box, scriptTiming, toolTiming]);
  const argsMenu = useMemo(
    () => (box.kind === 'worldTool' ? () => worldToolArgsNodes(box.params) : null), [box],
  );

  // Each newly selected template starts from its own declared defaults rather than inheriting the last
  // template's answers, which would silently carry a stat name into a slot that never asked for it.
  useEffect(() => { setValues(defaultSlotValues(parsed.slots)); }, [parsed.slots]);

  const problems = slotProblems(parsed.slots, values, slotNames);
  const blocked = Object.keys(problems).length > 0 || parsed.errors.length > 0;

  const doInsert = () => {
    onInsert(fillTemplate(selected?.code ?? '', values), missingParams(parsed.slots, values, slotNames.param));
    setConfirmReplace(false);
    onOpenChange(false);
  };

  const openDraft = (template: CodeTemplate) => {
    setDraft(template);
    setDraftValues(defaultSlotValues(parseTemplateSlots(template.code, template.kind).slots));
  };

  const saveDraft = async () => {
    if (!draft || !canSave(draft)) return;
    try {
      const saved = await repository.save({ ...draft, name: draft.name.trim() });
      await refresh();
      setSelectedId(saved.id);
      setDraft(null);
      toast.success('Template saved');
    } catch (error) {
      toastError(error, { headline: `Couldn’t save: ${(error as Error).message}` });
    }
  };

  const remove = async (template: CodeTemplate) => {
    setConfirmDelete(null);
    try {
      await repository.remove(template.id);
      await refresh();
      setSelectedId(firstBuiltIn);
    } catch (error) {
      toastError(error, { headline: `Couldn’t delete: ${(error as Error).message}` });
    }
  };

  const exportPack = () => {
    if (userTemplates.length === 0) return;
    const filename = 'stat-templates.json';
    // Every template the author has, not just this box's: a pack is their library, not one menu.
    const contents = JSON.stringify(buildTemplatePack([...userTemplates]), null, 2);
    if (fileTransfer) {
      fileTransfer.writeExportPack(contents, filename);
      return;
    }
    downloadBlob(new Blob([contents], { type: 'application/json' }), filename);
  };

  const importPackText = async (readText: () => Promise<string | null>) => {
    try {
      const text = await readText();
      if (text === null) return;
      const added = await repository.import(parseTemplatePack(text));
      await refresh();
      toast.success(added > 0
        ? `Imported ${added} template${added === 1 ? '' : 's'}`
        : 'Those templates are already in your library');
    } catch (error) {
      toastError(error, 'Couldn’t import those templates');
    }
  };

  const importPack = (event: React.ChangeEvent<HTMLInputElement>) => importPackFile(event, importPackText);

  const requestImport = () => {
    if (fileTransfer) {
      void importPackText(fileTransfer.readImportPack);
      return;
    }
    fileRef.current?.click();
  };

  const templateButton = (template: CodeTemplate) => (
    <CompactSelectionRow
      key={template.id}
      selected={template.id === selected?.id}
      showCheck={false}
      aria-pressed={undefined}
      onClick={() => setSelectedId(template.id)}
    >
      {template.name}
    </CompactSelectionRow>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          'flex flex-col gap-4',
          // A fixed height, not a max: the window is the same size whichever template is selected, and the
          // panes scroll inside it. The desktop height is `sm:`-scoped so it cannot outrank the mobile
          // rule: an unscoped dvh height wins on width alone, which leaves mobile measuring a viewport
          // unit that ignores the on-screen keyboard and crushes the fields underneath it.
          'sm:max-w-4xl sm:h-[85dvh]',
          dialogFullHeightMobile,
        )}
      >
        <DialogHeader><DialogTitle>Code Templates</DialogTitle></DialogHeader>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importPack} />

        {draft ? (
          <>
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-label">Name</span>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-label">Description</span>
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>
              <div className="flex flex-col gap-1">
                <span id={runsId} className="text-label">Runs</span>
                <MultiSelect
                  aria-labelledby={runsId} options={timingOptions(draft)} placeholder="No Timings" modalPopover
                  defaultValue={draft.timings} onValueChange={(picked) => setDraft((current) => current && withTimings(current, picked))}
                />
              </div>
              {/* Preview is the creation interface the template will present, so the author edits the code
                  and reads what it asks for in the same place — side by side once full screen allows. */}
              <CodeArea
                value={draft.code}
                onChange={(code) => setDraft({ ...draft, code })}
                label="Code"
                ariaLabel="Template code"
                surface={draftSurface}
                statNames={statNames}
                owner={treeOwner}
                {...(argsMenu && { variables: argsMenu })}
                slots
                className="flex-1"
                preview={(
                  <TemplateForm code={draft.code} kind={kind} names={slotNames} values={draftValues} onChange={setDraftValues} />
                )}
              />
              <Hint>
                Write a slot as <code>{'{{name:type=default}}'}</code>. {kind === 'worldTool'
                  ? 'Stat, placeholder, trait, entity, location, daypart and parameter'
                  : 'Stat, placeholder, trait, entity, location and daypart'} slots insert a quoted string. Number, choice
                and text slots insert as written, so add the quotes when you need a string.
              </Hint>
            </div>

            <DialogFooter className="flex-row justify-end">
              <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              <Button disabled={!canSave(draft)} onClick={() => void saveDraft()}>
                Save Template
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className={cn('flex-1 min-h-0 gap-4', isMobile ? 'flex flex-col' : 'grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)]')}>
              {isMobile ? (
                <Select value={selected?.id} onValueChange={setSelectedId}>
                  <SelectTrigger aria-label="Code Template"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {builtIns.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    {sortedUser.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <ScrollArea className="h-full rounded-md border">
                  <div className="p-2 flex flex-col gap-1">
                    {builtIns.length > 0 && <Meta className="block text-muted-foreground px-1 pt-1">Built-In</Meta>}
                    {builtIns.map(templateButton)}

                    <div className={cn('flex items-center justify-between gap-1 px-1', builtIns.length > 0 ? 'pt-3' : 'pt-1')}>
                      <p className="text-meta text-muted-foreground">My Templates</p>
                      <span className="flex items-center">
                        <Tip tip="Import templates">
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            onClick={requestImport}
                          >
                            <ActionIcon.import className="h-3.5 w-3.5" />
                          </button>
                        </Tip>
                        <Tip tip="Export templates">
                          <button
                            type="button"
                            disabled={userTemplates.length === 0}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                            onClick={exportPack}
                          >
                            <ActionIcon.export className="h-3.5 w-3.5" />
                          </button>
                        </Tip>
                      </span>
                    </div>
                    {sortedUser.map(templateButton)}

                    <button
                      type="button"
                      onClick={() => openDraft(blankTemplate(box))}
                      className="flex items-center gap-1 rounded border border-dashed px-2 py-1.5 text-label text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-4 w-4" />New Template
                    </button>
                  </div>
                </ScrollArea>
              )}

              <div className="flex flex-col gap-3 min-w-0 overflow-y-auto">
                {!selected && (
                  <Meta className="block text-muted-foreground">No templates run {timingLabel} yet</Meta>
                )}
                {selected && (
                  <>
                    <div>
                      <p className="text-label font-medium">{selected.name}</p>
                      <Meta className="block text-muted-foreground">Runs {templateTimingLabels(selected).join(', ')}</Meta>
                      <p className="text-helper text-muted-foreground">{selected.description}</p>
                    </div>
                    <TemplateForm code={selected.code} kind={kind} names={slotNames} values={values} onChange={setValues} />
                  </>
                )}
              </div>
            </div>

            {/* Frozen: the actions keep their place whichever template is selected and however long its
                form runs. */}
            <DialogFooter className="flex-row flex-wrap justify-end gap-2">
              {isMobile && (
                <Button variant="outline" size="sm" onClick={() => openDraft(blankTemplate(box))}>
                  <Plus className="h-4 w-4 mr-1" />New
                </Button>
              )}
              {selected && (isBuiltInTemplate(selected.id) ? (
                <Button variant="outline" onClick={() => openDraft({ ...selected, id: '', name: `${selected.name} Copy` })}>
                  <Copy className="h-4 w-4 mr-1" />Duplicate
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => openDraft({ ...selected })}>
                    <Pencil className="h-4 w-4 mr-1" />Edit
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmDelete(selected)}>
                    <Trash2 className="h-4 w-4 mr-1" />Delete
                  </Button>
                </>
              ))}
              <Button disabled={blocked || !selected} onClick={() => (hasExistingCode ? setConfirmReplace(true) : doInsert())}>
                Insert Code
              </Button>
            </DialogFooter>
          </>
        )}

        <ConfirmDialog
          open={!!confirmDelete}
          onOpenChange={(o) => !o && setConfirmDelete(null)}
          title="Delete Template"
          description={`Delete “${confirmDelete?.name}” from your library? Code you already inserted from it stays as it is.`}
          onConfirm={() => confirmDelete && void remove(confirmDelete)}
        />

        <ConfirmDialog
          open={confirmReplace}
          onOpenChange={setConfirmReplace}
          title={REPLACE_CODE_TITLE}
          description={REPLACE_CODE_DESCRIPTION}
          onConfirm={doInsert}
        />
      </DialogContent>
    </Dialog>
  );
}

export default StatCodeTemplateDialog;
// scroll-guard: allow migration-candidate: the form column's height inside the dialog grid is not confirmed definite
