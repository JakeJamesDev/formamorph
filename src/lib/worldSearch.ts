import { OPENING_CUE_FIELD_KEY, setOpeningCue, storedOpeningCue } from '@/lib/openingCue';
import { decodePlaceholderToken, describePlaceholders, parsePlaceholderText } from '@/lib/placeholders';
import { qualifiedPlaceholderName } from '@/lib/placeholderTree';
import { labelPlaceholders, worldPlacementLetters, type PlacementLetters } from '@/lib/placementLetters';
import { placeholderOwners, type PlaceholderOwners } from '@/lib/placeholderHomes';
import { withPinnedValue } from '@/lib/traitEffects';
import {
  setWorldPromptOverride, storedWorldPrompt, worldPromptFieldKey, WORLD_PROMPT_KINDS, WORLD_PROMPT_KIND_LABELS,
} from '@/lib/worldPrompt';
import type {
  Dictionary, Entity, EntityGroup, GameLocation, Placeholder, PlaceholderGroup, Stat, Trait, TraitGroup, WorldOverview,
} from '@/types';

/**
 * World Editor find & replace — the authored-text inventory and the matcher over it.
 *
 * A target is one editable string the editor renders somewhere: a field on an item, or one element of a
 * string-array field. Each carries the coordinates needed to navigate to it (tab + selection id) and a
 * writer that pushes an edited value back through that collection's normal updater, so a replace is
 * indistinguishable from the author typing.
 *
 * Matching runs over the literal runs of `parsePlaceholderText`, never the raw stored string. Chip tokens
 * are opaque `{{ph:…}}` text, so scanning them would let a query hit a UUID and a replace corrupt a chip;
 * splitting first makes both impossible. A chip instead answers a search by what it reads as — its
 * placement label, its placeholder's name and its values — and a hit on one is the whole chip, which no
 * replace touches.
 */

/** The record a target belongs to — an entity, a stat, one dictionary entry. Opaque outside its writer. */
export type SearchRecord = object;

/** One editable string in the editor, addressable and writable. */
export interface SearchTarget {
  /** Identity of the owning record. Several edits to one record must merge into a single write, since
   *  every updater replaces the whole object and the second would otherwise undo the first. */
  itemKey: string;
  /** The record as it currently stands, the starting point for a merged write. */
  record: SearchRecord;
  /** This field set to `next` on a copy of `record`, without committing. */
  applyTo: (record: SearchRecord, next: string) => SearchRecord;
  /** Push a record built by `applyTo` through its collection's updater. */
  commit: (record: SearchRecord) => void;
  /** World Editor tab that owns it — what to switch to when navigating here. */
  tab: string;
  /** The tab's selection id, or null for Overview, which has no item list. */
  itemId: string | null;
  /** The owning item, as the tree shows it. */
  itemLabel: string;
  /** Stable per-target key: field name, plus `[i]` for one element of an array field. */
  fieldKey: string;
  /** The field's caption in the editor. */
  fieldLabel: string;
  /** Whether the field renders placeholder chips, and so can accept a chip replacement. */
  chipCapable: boolean;
  /** Whether this is one entry of a chip list rather than a text box. Every string-array field in the
   *  editor is edited as chips, and an entry often repeats its item's name verbatim — so which of the two
   *  a hit belongs to cannot be read off the text. */
  inChipList: boolean;
  value: string;
  write: (next: string) => void;
}

export interface SearchOptions {
  matchCase: boolean;
  wholeWord: boolean;
}

/** One hit: a half-open `[start, end)` range of flat offsets into its target's value. */
export interface SearchMatch {
  target: SearchTarget;
  start: number;
  end: number;
  /** The chip this hit is, where the query matched what a chip reads as rather than a run of text. The
   *  range then spans the whole token, and a replace leaves it alone. */
  chip?: string;
}

/** What lets a search read chips: the placeholders behind them and the document's placement letters. */
export interface ChipSearch {
  placeholders: Placeholder[];
  letters: PlacementLetters;
  /** Who owns each scoped placeholder, so a chip answers to `Molly.Eyes` as the lists print it. */
  owners?: PlaceholderOwners;
}

/** The collections and updaters a scan needs — GameDataContext's shape, narrowed to what search touches. */
export interface SearchSources {
  worldOverview: WorldOverview;
  stats: Stat[];
  entities: Entity[];
  entityGroups: EntityGroup[];
  locations: GameLocation[];
  traits: Trait[];
  traitGroups: TraitGroup[];
  dictionaries: Dictionary[];
  placeholders: Placeholder[];
  updateWorldOverview: (updates: Partial<WorldOverview>) => void;
  updateStat: (stat: Stat) => void;
  updateEntity: (entity: Entity) => void;
  updateEntityGroup: (group: EntityGroup) => void;
  updateLocation: (location: GameLocation) => void;
  updateTrait: (trait: Trait) => void;
  updateTraitGroup: (group: TraitGroup) => void;
  updateDictionary: (book: Dictionary) => void;
  updateDictionaryEntry: (entry: DictionaryEntryWithBook) => void;
  updatePlaceholder: (placeholder: Placeholder) => void;
  /** The folders on the Placeholders tab, when the host has them. */
  placeholderGroups?: PlaceholderGroup[];
  updatePlaceholderGroup?: (group: PlaceholderGroup) => void;
}

/** `updateDictionaryEntry` matches by entry id across books, so the entry alone is the whole argument. */
type DictionaryEntryWithBook = Dictionary['entries'][number];

const untitled = (name: string | undefined, fallback: string) => name?.trim() || fallback;

/**
 * Every authored string the editor can navigate to, in tab order — and within an item, in the order its
 * panel lays the fields out, so stepping through hits runs down the panel rather than jumping about.
 *
 * Deliberately absent: ids and id-arrays, image/media payloads, enum-ish fields, stat `code`, and anything
 * with no editor field to jump to — legacy `GameLocation.description`, `Entity.tags`, `Dictionary.tags`,
 * `GameLocation.connections` (authored nowhere; only the in-game panel reads it), and the Stat Updates
 * tab, which no tab entry renders.
 */
export function collectSearchTargets(src: SearchSources): SearchTarget[] {
  const targets: SearchTarget[] = [];
  // An item is named in the results line the way its tree row names it: a chip by its placement label.
  const letters = worldPlacementLetters(src);
  const owners = placeholderOwners(src);
  const labeled = (name: string | undefined, fallback: string) =>
    untitled(labelPlaceholders(name ?? '', src.placeholders ?? [], letters, owners), fallback);

  type Where = Pick<SearchTarget, 'tab' | 'itemId' | 'itemLabel' | 'chipCapable'>;

  /**
   * Bind one record's fields. `set` describes an edit as a pure update of the record, so the same
   * description serves a lone write and a merged one.
   */
  function bind<T extends SearchRecord>(itemKey: string, record: T, commit: (record: T) => void) {
    const add = (
      where: Where,
      fieldKey: string,
      fieldLabel: string,
      value: string | undefined,
      set: (record: T, next: string) => T,
      inChipList = false,
    ) => {
      if (!value) return;
      targets.push({
        ...where, fieldKey, fieldLabel, value, itemKey, record, inChipList,
        applyTo: (draft, next) => set(draft as T, next),
        commit: (draft) => commit(draft as T),
        write: (next) => commit(set(record, next)),
      });
    };
    /** One target per element of a string-array field; an edit rebuilds the whole array. */
    const addEach = (
      where: Where,
      fieldKey: string,
      fieldLabel: string,
      values: string[] | undefined,
      set: (record: T, next: string[]) => T,
      read: (record: T) => string[],
    ) => {
      values?.forEach((entry, i) => {
        if (!entry) return;
        add(where, `${fieldKey}[${i}]`, fieldLabel, entry, (draft, next) =>
          set(draft, read(draft).map((v, j) => (j === i ? next : v))), true);
      });
    };
    return { add, addEach };
  }

  // ── Overview ──────────────────────────────────────────────────────────────
  const ov = src.worldOverview;
  const ovWhere = { tab: 'overview', itemId: null, itemLabel: 'World' };
  // Collections read as `?? []`, the overview entered only when present: hand-edited world JSON can omit
  // any of them, and a missing slice is nothing to search, not a blank editor.
  if (ov) {
    // `updateWorldOverview` merges a patch, so handing it a whole record works and keeps one code path.
    const { add, addEach } = bind('overview', ov, src.updateWorldOverview);
    add({ ...ovWhere, chipCapable: false }, 'name', 'World Name', ov.name, (r, v) => ({ ...r, name: v }));
    add({ ...ovWhere, chipCapable: false }, 'author', 'Author', ov.author, (r, v) => ({ ...r, author: v }));
    addEach({ ...ovWhere, chipCapable: false }, 'tags', 'Tags', ov.tags, (r, v) => ({ ...r, tags: v }), (r) => r.tags ?? []);
    // Uses the plain prompt vocabulary rather than the placeholder one, so a chip here stays inert text.
    add({ ...ovWhere, chipCapable: false }, 'description', 'World Description', ov.description, (r, v) => ({ ...r, description: v }));
    add({ ...ovWhere, chipCapable: true }, 'systemPrompt', 'System Prompt Addition', ov.systemPrompt, (r, v) => ({ ...r, systemPrompt: v }));
    // The two readmes share one caption ("Readme") and are told apart by their tab, so their labels carry
    // which one — the breadcrumb is all the author has to go on once both hold the same phrase.
    add({ ...ovWhere, chipCapable: true }, 'introReadme', 'Readme (Introduction)', ov.introReadme, (r, v) => ({ ...r, introReadme: v }));
    add({ ...ovWhere, chipCapable: true }, 'readme', 'Readme (Gameplay)', ov.readme, (r, v) => ({ ...r, readme: v }));
    // Registered only once the author has stored a cue: a field still tracking the shipped default holds
    // no world text to find, and replacing into it would freeze a cue nobody wrote.
    add({ ...ovWhere, chipCapable: true }, OPENING_CUE_FIELD_KEY, 'Opening Cue', storedOpeningCue(ov),
      (r, v) => ({ ...r, ...setOpeningCue({ text: v }) }));
    // One target per custom prompt the author has actually stored — a tab still tracking the preset holds
    // no world text to find, and replacing into it would silently freeze a prompt nobody wrote.
    WORLD_PROMPT_KINDS.forEach((kind) => {
      add({ ...ovWhere, chipCapable: false }, worldPromptFieldKey(kind),
        `Custom Prompt (${WORLD_PROMPT_KIND_LABELS[kind]})`, storedWorldPrompt(ov, kind),
        (r, v) => ({ ...r, promptOverrides: setWorldPromptOverride(r.promptOverrides, kind, { text: v }) }));
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  (src.stats ?? []).forEach((stat) => {
    const where = { tab: 'stats', itemId: stat.id, itemLabel: labeled(stat.name, 'Stat') };
    const { add } = bind(`stat:${stat.id}`, stat, src.updateStat);
    add({ ...where, chipCapable: true }, 'name', 'Name', stat.name, (r, v) => ({ ...r, name: v }));
    add({ ...where, chipCapable: false }, 'description', 'Description', stat.description, (r, v) => ({ ...r, description: v }));
    stat.descriptors?.forEach((d, i) => {
      add({ ...where, chipCapable: false }, `descriptors[${i}].description`, 'Descriptor', d.description,
        (r, v) => ({ ...r, descriptors: (r.descriptors ?? []).map((x, j) => (j === i ? { ...x, description: v } : x)) }));
    });
  });

  // ── Entities ──────────────────────────────────────────────────────────────
  (src.entities ?? []).forEach((entity) => {
    const where = { tab: 'entities', itemId: entity.id, itemLabel: labeled(entity.name, 'Entity') };
    const { add, addEach } = bind(`entity:${entity.id}`, entity, src.updateEntity);
    add({ ...where, chipCapable: true }, 'name', 'Name', entity.name, (r, v) => ({ ...r, name: v }));
    addEach({ ...where, chipCapable: true }, 'aliases', 'Aliases', entity.aliases, (r, v) => ({ ...r, aliases: v }), (r) => r.aliases ?? []);
    add({ ...where, chipCapable: true }, 'playerDescription', 'Player-Facing Description', entity.playerDescription, (r, v) => ({ ...r, playerDescription: v }));
    add({ ...where, chipCapable: true }, 'aiDescription', 'AI-Facing Description', entity.aiDescription, (r, v) => ({ ...r, aiDescription: v }));
    add({ ...where, chipCapable: true }, 'aiSummary', 'AI-Facing Summary', entity.aiSummary, (r, v) => ({ ...r, aiSummary: v }));
    add({ ...where, chipCapable: false }, 'type', 'Type', entity.type, (r, v) => ({ ...r, type: v }));
    add({ ...where, chipCapable: false }, 'imageTags', 'Image Tags', entity.imageTags, (r, v) => ({ ...r, imageTags: v }));
  });
  (src.entityGroups ?? []).forEach((group) => {
    const where = { tab: 'entities', itemId: group.id, itemLabel: labeled(group.name, 'Group') };
    const { add } = bind(`entityGroup:${group.id}`, group, src.updateEntityGroup);
    add({ ...where, chipCapable: false }, 'name', 'Group Name', group.name, (r, v) => ({ ...r, name: v }));
  });

  // ── Locations ─────────────────────────────────────────────────────────────
  (src.locations ?? []).forEach((location) => {
    const where = { tab: 'locations', itemId: location.id, itemLabel: labeled(location.name, 'Location') };
    const { add } = bind(`location:${location.id}`, location, src.updateLocation);
    add({ ...where, chipCapable: true }, 'name', 'Name', location.name, (r, v) => ({ ...r, name: v }));
    add({ ...where, chipCapable: true }, 'playerDescription', 'Player-Facing Description', location.playerDescription, (r, v) => ({ ...r, playerDescription: v }));
    add({ ...where, chipCapable: true }, 'aiDescription', 'AI-Facing Description', location.aiDescription, (r, v) => ({ ...r, aiDescription: v }));
    add({ ...where, chipCapable: true }, 'aiSummary', 'AI-Facing Summary', location.aiSummary, (r, v) => ({ ...r, aiSummary: v }));
    add({ ...where, chipCapable: false }, 'imageTags', 'Image Tags', location.imageTags, (r, v) => ({ ...r, imageTags: v }));
  });

  // ── Traits ────────────────────────────────────────────────────────────────
  (src.traits ?? []).forEach((trait) => {
    const where = { tab: 'traits', itemId: trait.id, itemLabel: labeled(trait.name, 'Trait') };
    const { add } = bind(`trait:${trait.id}`, trait, src.updateTrait);
    add({ ...where, chipCapable: true }, 'name', 'Name', trait.name, (r, v) => ({ ...r, name: v }));
    add({ ...where, chipCapable: true }, 'playerDescription', 'Player-Facing Description', trait.playerDescription, (r, v) => ({ ...r, playerDescription: v }));
    add({ ...where, chipCapable: true }, 'aiDescription', 'AI-Facing Description', trait.aiDescription, (r, v) => ({ ...r, aiDescription: v }));
    trait.placeholderPins?.forEach((pin, i) => {
      add({ ...where, chipCapable: false }, `placeholderPins[${i}].value`, 'Pinned Value', pin.value,
        (r, v) => ({
          ...r,
          placeholderPins: r.placeholderPins?.map((x, j) =>
            (j === i ? withPinnedValue(x, v, src.placeholders ?? []) : x)),
        }));
    });
  });
  (src.traitGroups ?? []).forEach((group) => {
    const where = { tab: 'traits', itemId: group.id, itemLabel: labeled(group.name, 'Group') };
    const { add } = bind(`traitGroup:${group.id}`, group, src.updateTraitGroup);
    add({ ...where, chipCapable: true }, 'name', 'Group Name', group.name, (r, v) => ({ ...r, name: v }));
    add({ ...where, chipCapable: true }, 'playerDescription', 'Player-Facing Description', group.playerDescription, (r, v) => ({ ...r, playerDescription: v }));
    add({ ...where, chipCapable: true }, 'aiDescription', 'AI-Facing Description', group.aiDescription, (r, v) => ({ ...r, aiDescription: v }));
  });

  // ── Dictionaries ──────────────────────────────────────────────────────────
  (src.dictionaries ?? []).forEach((book) => {
    const bookWhere = { tab: 'dictionary', itemId: book.id, itemLabel: labeled(book.name, 'Dictionary') };
    const { add: addBook } = bind(`book:${book.id}`, book, src.updateDictionary);
    addBook({ ...bookWhere, chipCapable: false }, 'name', 'Dictionary Name', book.name, (r, v) => ({ ...r, name: v }));
    addBook({ ...bookWhere, chipCapable: false }, 'description', 'Description', book.description, (r, v) => ({ ...r, description: v }));
    (book.entries ?? []).forEach((entry) => {
      // A regex entry drops the chip vocabulary, so its keys and value can't take a chip replacement.
      const chip = !entry.useRegex;
      const where = { tab: 'dictionary', itemId: entry.id, itemLabel: labeled(entry.name, 'Entry') };
      const { add, addEach } = bind(`entry:${entry.id}`, entry, src.updateDictionaryEntry);
      add({ ...where, chipCapable: chip }, 'name', 'Name', entry.name, (r, v) => ({ ...r, name: v }));
      addEach({ ...where, chipCapable: chip }, 'key', 'Trigger Keywords', entry.key, (r, v) => ({ ...r, key: v }), (r) => r.key ?? []);
      addEach({ ...where, chipCapable: chip }, 'secondaryKeys', 'Secondary Keywords', entry.secondaryKeys,
        (r, v) => ({ ...r, secondaryKeys: v }), (r) => r.secondaryKeys ?? []);
      add({ ...where, chipCapable: chip }, 'value', 'Value', entry.value, (r, v) => ({ ...r, value: v }));
    });
  });

  // ── Placeholders ──────────────────────────────────────────────────────────
  (src.placeholders ?? []).forEach((ph) => {
    const where = { tab: 'placeholders', itemId: ph.id, itemLabel: labeled(ph.name, 'Placeholder'), chipCapable: false };
    const { add, addEach } = bind(`placeholder:${ph.id}`, ph, src.updatePlaceholder);
    add(where, 'name', 'Name', ph.name, (r, v) => ({ ...r, name: v }));
    // Each value edits its own text; the record's id stays, so its weight and its trait pins follow it and
    // there is nothing to carry across.
    // `?? []` throughout: hand-edited world JSON can omit the field the type calls required, and the scan
    // runs in the editor's render, so a missing list has to be nothing to search rather than a blank editor.
    addEach(where, 'values', 'Values', (ph.values ?? []).map((v) => v.text),
      (r, next) => ({ ...r, values: (r.values ?? []).map((v, i) => ({ ...v, text: next[i] ?? v.text })) }),
      (r) => (r.values ?? []).map((v) => v.text));
  });
  const updatePlaceholderGroup = src.updatePlaceholderGroup;
  if (updatePlaceholderGroup) {
    (src.placeholderGroups ?? []).forEach((group) => {
      const where = { tab: 'placeholders', itemId: group.id, itemLabel: labeled(group.name, 'Group') };
      const { add } = bind(`placeholderGroup:${group.id}`, group, updatePlaceholderGroup);
      add({ ...where, chipCapable: false }, 'name', 'Group Name', group.name, (r, v) => ({ ...r, name: v }));
    });
  }

  return targets;
}

const WORD = /[\p{L}\p{N}_]/u;

/** Every offset in `text` where the folded `needle` starts, honoring the whole-word option. */
function hitsIn(text: string, needle: string, opts: SearchOptions): number[] {
  const haystack = opts.matchCase ? text : text.toLowerCase();
  const hits: number[] = [];
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    if (opts.wholeWord) {
      const before = at > 0 ? haystack[at - 1] : '';
      const after = haystack[at + needle.length] ?? '';
      if (WORD.test(before) || WORD.test(after)) continue;
    }
    hits.push(at);
  }
  return hits;
}

/** What a chip answers a search with: what it reads as, its placeholder's name, and its values. A chip
 *  whose placeholder is gone still answers to its label — the one thing left that says what it was for. */
function chipReadings(token: string, chips: ChipSearch, byId: Map<string, Placeholder>): string[] {
  const decoded = decodePlaceholderToken(token);
  if (!decoded) return [];
  const ph = byId.get(decoded.id);
  if (!ph) return decoded.label ? [decoded.label] : [];
  return [
    labelPlaceholders(token, chips.placeholders, chips.letters, chips.owners),
    qualifiedPlaceholderName(chips.placeholders, decoded.id) ?? ph.name,
    ...(ph.values ?? []).map((v) => describePlaceholders(v.text, chips.placeholders)),
  ];
}

/**
 * Every hit of `query` across `targets`, in target order and then in field order — the ordered list
 * Next/Previous steps through. With `chips`, a chip is a hit when any of its readings holds the query; its
 * hit spans the whole token so it interleaves with text hits by position.
 */
export function findMatches(targets: SearchTarget[], query: string, opts: SearchOptions, chips?: ChipSearch): SearchMatch[] {
  if (!query) return [];
  const needle = opts.matchCase ? query : query.toLowerCase();
  const byId = new Map((chips?.placeholders ?? []).map((p) => [p.id, p]));
  const matches: SearchMatch[] = [];
  for (const target of targets) {
    let offset = 0;
    for (const segment of parsePlaceholderText(target.value)) {
      if (segment.type === 'text') {
        for (const at of hitsIn(segment.value, needle, opts)) {
          matches.push({ target, start: offset + at, end: offset + at + needle.length });
        }
        offset += segment.value.length;
        continue;
      }
      if (chips && chipReadings(segment.token, chips, byId).some((reading) => hitsIn(reading, needle, opts).length > 0)) {
        matches.push({ target, start: offset, end: offset + segment.token.length, chip: segment.token });
      }
      offset += segment.token.length;
    }
  }
  return matches;
}

/** A short window of the target's text around a match, for the results readout. */
export function matchSnippet(match: SearchMatch, radius = 28): string {
  const { value } = match.target;
  const from = Math.max(0, match.start - radius);
  const to = Math.min(value.length, match.end + radius);
  return `${from > 0 ? '…' : ''}${value.slice(from, to).replace(/\s+/g, ' ')}${to < value.length ? '…' : ''}`;
}

/** Splice `insert` over `[start, end)`. */
export function spliceText(text: string, start: number, end: number, insert: string): string {
  return text.slice(0, start) + insert + text.slice(end);
}

/** What a Replace All pass did, for the completion summary. */
export interface ReplaceSummary {
  replaced: number;
  fields: number;
  skipped: number;
  skippedFields: string[];
  /** Hits that were chips. A chip is changed from its own pop-out, never by a text replace. */
  chips: number;
}

/**
 * Replace every match in one pass.
 *
 * Within a field, matches splice back to front so earlier offsets stay valid. Across fields, edits are
 * folded onto one copy of their record and committed once — every updater replaces the whole object, so
 * two fields of one entity written separately would each undo the other.
 *
 * In placeholder mode `insertFor` returns null for a field that can't render a chip; those are left
 * untouched and counted, rather than filled with a token that would only ever show as literal text.
 */
export function replaceAll(
  matches: SearchMatch[],
  insertFor: (target: SearchTarget) => string | null,
): ReplaceSummary {
  const byTarget = new Map<SearchTarget, SearchMatch[]>();
  const summary: ReplaceSummary = { replaced: 0, fields: 0, skipped: 0, skippedFields: [], chips: 0 };
  for (const match of matches) {
    if (match.chip) {
      summary.chips += 1;
      continue;
    }
    const list = byTarget.get(match.target);
    if (list) list.push(match);
    else byTarget.set(match.target, [match]);
  }

  const drafts = new Map<string, { record: SearchRecord; commit: (record: SearchRecord) => void }>();
  for (const [target, hits] of byTarget) {
    if (insertFor(target) === null) {
      summary.skipped += hits.length;
      summary.skippedFields.push(`${target.itemLabel} · ${target.fieldLabel}`);
      continue;
    }
    let next = target.value;
    for (const hit of [...hits].sort((a, b) => b.start - a.start)) {
      // Asked per occurrence, not once: a chip's placement id keys its Unique roll and can never be shared.
      next = spliceText(next, hit.start, hit.end, insertFor(target) ?? '');
    }
    const draft = drafts.get(target.itemKey) ?? { record: target.record, commit: target.commit };
    drafts.set(target.itemKey, { ...draft, record: target.applyTo(draft.record, next) });
    summary.replaced += hits.length;
    summary.fields += 1;
  }
  for (const { record, commit } of drafts.values()) commit(record);
  return summary;
}
