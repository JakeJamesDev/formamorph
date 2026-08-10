import { parsePlaceholderText } from '@/lib/placeholders';
import type {
  Dictionary, Entity, EntityGroup, GameLocation, Placeholder, Stat, Trait, TraitGroup, WorldOverview,
} from '@/types';

/**
 * World Editor find & replace — the authored-text inventory and the matcher over it.
 *
 * A target is one editable string the editor renders somewhere: a field on an item, or one element of a
 * string-array field. Each carries the coordinates needed to navigate to it (tab + selection id) and a
 * writer that pushes an edited value back through that collection's normal updater, so a replace is
 * indistinguishable from the author typing.
 *
 * Matching runs only over the literal runs of `parsePlaceholderText`, never the raw stored string. Chip
 * tokens are opaque `{{ph:…}}` text, so scanning them would let a query hit a UUID and a replace corrupt
 * a chip; splitting first makes both impossible.
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
}

/** `updateDictionaryEntry` matches by entry id across books, so the entry alone is the whole argument. */
type DictionaryEntryWithBook = Dictionary['entries'][number];

const untitled = (name: string | undefined, fallback: string) => name?.trim() || fallback;

/**
 * Every authored string the editor can navigate to, in tab order.
 *
 * Deliberately absent: ids and id-arrays, image/media payloads, enum-ish fields, stat `code`, and anything
 * with no editor field to jump to — legacy `GameLocation.description`, `Entity.tags`, `Dictionary.tags`,
 * `GameLocation.connections` (authored nowhere; only the in-game panel reads it), and the Stat Updates
 * tab, which no tab entry renders.
 */
export function collectSearchTargets(src: SearchSources): SearchTarget[] {
  const targets: SearchTarget[] = [];

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
  {
    // `updateWorldOverview` merges a patch, so handing it a whole record works and keeps one code path.
    const { add, addEach } = bind('overview', ov, src.updateWorldOverview);
    add({ ...ovWhere, chipCapable: false }, 'name', 'World Name', ov.name, (r, v) => ({ ...r, name: v }));
    add({ ...ovWhere, chipCapable: false }, 'author', 'Author', ov.author, (r, v) => ({ ...r, author: v }));
    // Uses the plain prompt vocabulary rather than the placeholder one, so a chip here stays inert text.
    add({ ...ovWhere, chipCapable: false }, 'description', 'World Description', ov.description, (r, v) => ({ ...r, description: v }));
    add({ ...ovWhere, chipCapable: true }, 'systemPrompt', 'System Prompt Addition', ov.systemPrompt, (r, v) => ({ ...r, systemPrompt: v }));
    add({ ...ovWhere, chipCapable: true }, 'readme', 'Readme', ov.readme, (r, v) => ({ ...r, readme: v }));
    addEach({ ...ovWhere, chipCapable: false }, 'tags', 'Tags', ov.tags, (r, v) => ({ ...r, tags: v }), (r) => r.tags ?? []);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  src.stats.forEach((stat) => {
    const where = { tab: 'stats', itemId: stat.id, itemLabel: untitled(stat.name, 'Stat') };
    const { add } = bind(`stat:${stat.id}`, stat, src.updateStat);
    add({ ...where, chipCapable: true }, 'name', 'Name', stat.name, (r, v) => ({ ...r, name: v }));
    add({ ...where, chipCapable: false }, 'description', 'Description', stat.description, (r, v) => ({ ...r, description: v }));
    stat.descriptors?.forEach((d, i) => {
      add({ ...where, chipCapable: false }, `descriptors[${i}].description`, 'Descriptor', d.description,
        (r, v) => ({ ...r, descriptors: r.descriptors.map((x, j) => (j === i ? { ...x, description: v } : x)) }));
    });
  });

  // ── Entities ──────────────────────────────────────────────────────────────
  src.entities.forEach((entity) => {
    const where = { tab: 'entities', itemId: entity.id, itemLabel: untitled(entity.name, 'Entity') };
    const { add, addEach } = bind(`entity:${entity.id}`, entity, src.updateEntity);
    add({ ...where, chipCapable: true }, 'name', 'Name', entity.name, (r, v) => ({ ...r, name: v }));
    addEach({ ...where, chipCapable: true }, 'aliases', 'Aliases', entity.aliases, (r, v) => ({ ...r, aliases: v }), (r) => r.aliases ?? []);
    add({ ...where, chipCapable: false }, 'type', 'Type', entity.type, (r, v) => ({ ...r, type: v }));
    add({ ...where, chipCapable: true }, 'playerDescription', 'Player-Facing Description', entity.playerDescription, (r, v) => ({ ...r, playerDescription: v }));
    add({ ...where, chipCapable: true }, 'aiDescription', 'AI-Facing Description', entity.aiDescription, (r, v) => ({ ...r, aiDescription: v }));
    add({ ...where, chipCapable: true }, 'aiSummary', 'AI-Facing Summary', entity.aiSummary, (r, v) => ({ ...r, aiSummary: v }));
    add({ ...where, chipCapable: false }, 'imageTags', 'Image Tags', entity.imageTags, (r, v) => ({ ...r, imageTags: v }));
  });
  src.entityGroups.forEach((group) => {
    const where = { tab: 'entities', itemId: group.id, itemLabel: untitled(group.name, 'Group') };
    const { add } = bind(`entityGroup:${group.id}`, group, src.updateEntityGroup);
    add({ ...where, chipCapable: false }, 'name', 'Group Name', group.name, (r, v) => ({ ...r, name: v }));
  });

  // ── Locations ─────────────────────────────────────────────────────────────
  src.locations.forEach((location) => {
    const where = { tab: 'locations', itemId: location.id, itemLabel: untitled(location.name, 'Location') };
    const { add } = bind(`location:${location.id}`, location, src.updateLocation);
    add({ ...where, chipCapable: true }, 'name', 'Name', location.name, (r, v) => ({ ...r, name: v }));
    add({ ...where, chipCapable: true }, 'playerDescription', 'Player-Facing Description', location.playerDescription, (r, v) => ({ ...r, playerDescription: v }));
    add({ ...where, chipCapable: true }, 'aiDescription', 'AI-Facing Description', location.aiDescription, (r, v) => ({ ...r, aiDescription: v }));
    add({ ...where, chipCapable: true }, 'aiSummary', 'AI-Facing Summary', location.aiSummary, (r, v) => ({ ...r, aiSummary: v }));
    add({ ...where, chipCapable: false }, 'imageTags', 'Image Tags', location.imageTags, (r, v) => ({ ...r, imageTags: v }));
  });

  // ── Traits ────────────────────────────────────────────────────────────────
  src.traits.forEach((trait) => {
    const where = { tab: 'traits', itemId: trait.id, itemLabel: untitled(trait.name, 'Trait') };
    const { add } = bind(`trait:${trait.id}`, trait, src.updateTrait);
    add({ ...where, chipCapable: true }, 'name', 'Name', trait.name, (r, v) => ({ ...r, name: v }));
    add({ ...where, chipCapable: true }, 'playerDescription', 'Player-Facing Description', trait.playerDescription, (r, v) => ({ ...r, playerDescription: v }));
    add({ ...where, chipCapable: true }, 'aiDescription', 'AI-Facing Description', trait.aiDescription, (r, v) => ({ ...r, aiDescription: v }));
    trait.placeholderPins?.forEach((pin, i) => {
      add({ ...where, chipCapable: false }, `placeholderPins[${i}].value`, 'Pinned Value', pin.value,
        (r, v) => ({ ...r, placeholderPins: r.placeholderPins?.map((x, j) => (j === i ? { ...x, value: v } : x)) }));
    });
  });
  src.traitGroups.forEach((group) => {
    const where = { tab: 'traits', itemId: group.id, itemLabel: untitled(group.name, 'Group') };
    const { add } = bind(`traitGroup:${group.id}`, group, src.updateTraitGroup);
    add({ ...where, chipCapable: true }, 'name', 'Group Name', group.name, (r, v) => ({ ...r, name: v }));
    add({ ...where, chipCapable: true }, 'playerDescription', 'Player-Facing Description', group.playerDescription, (r, v) => ({ ...r, playerDescription: v }));
    add({ ...where, chipCapable: true }, 'aiDescription', 'AI-Facing Description', group.aiDescription, (r, v) => ({ ...r, aiDescription: v }));
  });

  // ── Dictionaries ──────────────────────────────────────────────────────────
  src.dictionaries.forEach((book) => {
    const bookWhere = { tab: 'dictionary', itemId: book.id, itemLabel: untitled(book.name, 'Dictionary') };
    const { add: addBook } = bind(`book:${book.id}`, book, src.updateDictionary);
    addBook({ ...bookWhere, chipCapable: false }, 'name', 'Dictionary Name', book.name, (r, v) => ({ ...r, name: v }));
    addBook({ ...bookWhere, chipCapable: false }, 'description', 'Description', book.description, (r, v) => ({ ...r, description: v }));
    book.entries.forEach((entry) => {
      // A regex entry drops the chip vocabulary, so its keys and value can't take a chip replacement.
      const chip = !entry.useRegex;
      const where = { tab: 'dictionary', itemId: entry.id, itemLabel: untitled(entry.name, 'Entry') };
      const { add, addEach } = bind(`entry:${entry.id}`, entry, src.updateDictionaryEntry);
      add({ ...where, chipCapable: chip }, 'name', 'Name', entry.name, (r, v) => ({ ...r, name: v }));
      addEach({ ...where, chipCapable: chip }, 'key', 'Trigger Keywords', entry.key, (r, v) => ({ ...r, key: v }), (r) => r.key ?? []);
      addEach({ ...where, chipCapable: chip }, 'secondaryKeys', 'Secondary Keywords', entry.secondaryKeys,
        (r, v) => ({ ...r, secondaryKeys: v }), (r) => r.secondaryKeys ?? []);
      add({ ...where, chipCapable: chip }, 'value', 'Value', entry.value, (r, v) => ({ ...r, value: v }));
    });
  });

  // ── Placeholders ──────────────────────────────────────────────────────────
  src.placeholders.forEach((ph) => {
    const where = { tab: 'placeholders', itemId: ph.id, itemLabel: untitled(ph.name, 'Placeholder'), chipCapable: false };
    const { add, addEach } = bind(`placeholder:${ph.id}`, ph, src.updatePlaceholder);
    add(where, 'name', 'Name', ph.name, (r, v) => ({ ...r, name: v }));
    // `weights` is keyed by the value string, so an edited value carries its weight across or loses it.
    addEach(where, 'values', 'Values', ph.values, (r, next) => {
      if (!r.weights) return { ...r, values: next };
      const carried: Record<string, number> = {};
      next.forEach((value, i) => {
        const weight = r.weights?.[r.values[i]];
        if (weight !== undefined) carried[value] = weight;
      });
      return { ...r, values: next, weights: carried };
    }, (r) => r.values);
  });

  return targets;
}

const WORD = /[\p{L}\p{N}_]/u;

/** Flat `[start, end)` spans of `text` that lie outside placeholder chip tokens. */
function literalSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let offset = 0;
  for (const segment of parsePlaceholderText(text)) {
    const length = segment.type === 'text' ? segment.value.length : segment.token.length;
    if (segment.type === 'text') spans.push([offset, offset + length]);
    offset += length;
  }
  return spans;
}

/** Every hit of `query` across `targets`, in target order — the ordered list Next/Previous steps through. */
export function findMatches(targets: SearchTarget[], query: string, opts: SearchOptions): SearchMatch[] {
  if (!query) return [];
  const needle = opts.matchCase ? query : query.toLowerCase();
  const matches: SearchMatch[] = [];
  for (const target of targets) {
    const haystack = opts.matchCase ? target.value : target.value.toLowerCase();
    for (const [spanStart, spanEnd] of literalSpans(target.value)) {
      let from = spanStart;
      for (;;) {
        const at = haystack.indexOf(needle, from);
        if (at < 0 || at + needle.length > spanEnd) break;
        from = at + 1;
        if (opts.wholeWord) {
          const before = at > 0 ? haystack[at - 1] : '';
          const after = haystack[at + needle.length] ?? '';
          if (WORD.test(before) || WORD.test(after)) continue;
        }
        matches.push({ target, start: at, end: at + needle.length });
      }
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
  for (const match of matches) {
    const list = byTarget.get(match.target);
    if (list) list.push(match);
    else byTarget.set(match.target, [match]);
  }

  const summary: ReplaceSummary = { replaced: 0, fields: 0, skipped: 0, skippedFields: [] };
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
