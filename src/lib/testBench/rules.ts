/**
 * The Test Bench's rule engine: one pure pass over an authored world producing the findings the Issues
 * instrument lists. A rule is data — id, severity, owning editor section, and a `check` — so the same set
 * can be run whole (Issues) or filtered to a subset (Triggers) without a second implementation.
 *
 * Everything here is pure: no React, no storage, no world mutation. A rule diagnoses; where the repair is
 * unambiguous it also carries a `fix`, which returns a new world rather than editing the one it was given.
 */
import {
  collectPlaceholderPlacements, decodePlaceholderToken, describePlaceholders, encodePlaceholderToken,
  hasPlaceholders, lonePlaceholderToken, parsePlaceholderText, placeholderChildren, placeholderIsChoice,
  placeholderKindNoun, placeholderWeight,
  resolvePlaceholders, SHARED_PATH_SEP,
  type PlaceholderFinding, type PlaceholderPick, type PlaceholderToken,
} from '@/lib/placeholders';
import { holdsAsChip, qualifiedPlaceholderName } from '@/lib/placeholderTree';
import { matchKey } from '@/lib/entityMatch';
import { activeDescriptor } from '@/lib/statContext';
import {
  describeInThresholdUnits, describeThreshold, descriptorSpans, isThresholdOutOfRange, sortedDescriptors,
  statStartValue, thresholdValue, uncoveredSpan, valueThreshold,
} from '@/lib/statDescriptorGeometry';
import { usesStatClock } from '@/lib/statCodeExecutor';
import { estimateTokens } from '@/lib/memoryUtils';
import { entityImages } from '@/lib/entityImages';
import {
  dataUrlBytes, dataUrlMime, dataUrlRealMime, imageFormatLabel, isConvertibleImage, isRemoteImage,
  relabelDataUrl, sniffDataUrlMime,
} from '@/lib/imageBytes';
import { formatBytes, IMAGE_CAPS, type ImageCap } from '@/lib/imageOptim';
import { clamp } from '@/lib/utils';
import type {
  DictionaryEntry, Entity, GameLocation, Placeholder, PlaceholderValue, Stat, StatDescriptor, Trait, World,
} from '@/types';

/**
 * The world a rule reads — the editor's live payload, which carries no record id or version.
 *
 * Every collection on it is read through `?? []`, and every field of one that the types call required.
 * World JSON is hand-editable and arrives from third-party tools, so a "required" array can simply be
 * absent; the pass runs inside the editor's render, where one throw is a blank screen rather than a
 * finding. A rule diagnoses a malformed world — it never trips over one.
 */
export type RuleWorld = Omit<World, 'id' | 'version'>;

/** Error: cannot work. Warning: works, but very likely not what was meant. Info: consistency only. */
export type Severity = 'error' | 'warning' | 'info';

/** Severity order for display: the broken things first, wherever in the world they live. */
export const SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'] as const;

/** The editor tab that owns a finding's items — where Open navigates to. */
export type FindingSection =
  | 'overview' | 'stats' | 'entities' | 'locations' | 'traits' | 'dictionary' | 'placeholders';

/** One item a finding names, labeled as the editor's own lists label it. */
export interface FindingItem {
  id: string;
  name: string;
  /** Overrides the rule's section for this item — for a rule whose items live on different editor tabs. */
  section?: FindingSection;
}

/** One instance of a rule firing, naming the items it is about. */
export interface Finding {
  ruleId: string;
  severity: Severity;
  section: FindingSection;
  /** The problem in one line, naming this instance's items. */
  message: string;
  items: FindingItem[];
}

/** What a finding's row needs from whatever raised it, with no way of raising it. Split out because not
 *  everything the Issues list shows can run in the live pass — the stat-code execution check spins a VM. */
export interface RuleHead {
  id: string;
  severity: Severity;
  section: FindingSection;
  /** Part of the matching-related subset Triggers surfaces inline beside the rows it is about. Marks a rule
   *  about what text detects what — never a rule about structure, which has no place in the tracer. */
  matching?: boolean;
  /** Acting on this rule needs a field or tab Simple mode hides, so Simple folds it into a count rather than
   *  listing a problem about something the author cannot see, let alone offering to fix it. */
  advanced?: boolean;
  /** Headline for the collapsed row when this rule fired `count` times. */
  summary(count: number): string;
  /**
   * The world with every unambiguous instance of this rule repaired — present only where the repair
   * needs no authorial judgment. It re-derives what to repair from the world it is handed, so applying
   * it twice equals applying it once, and it returns the world untouched when there is nothing to do.
   */
  fix?(world: RuleWorld): RuleWorld;
  /** The repair exists but can't be a `fix`: it decodes and re-encodes images, so it is async and lives in
   *  the Bench hook. The row still carries a Fix button; only what fulfills it differs. */
  asyncFix?: boolean;
}

export interface Rule extends RuleHead {
  check(world: RuleWorld): Finding[];
}

const quote = (text: string) => `“${text}”`;

/** A finding for `rule` — the boilerplate trio copied from the rule itself. */
const finding = (rule: RuleHead, message: string, items: FindingItem[]): Finding => ({
  ruleId: rule.id, severity: rule.severity, section: rule.section, message, items,
});

/** `list` with `fn` applied, or `list` itself when nothing changed — an untouched slice keeping its identity
 *  is what lets a fix be written back as only the parts it actually rebuilt. */
const mapChanged = <T>(list: T[], fn: (item: T) => T): T[] => {
  let changed = false;
  const next = list.map((item) => {
    const mapped = fn(item);
    if (mapped !== item) changed = true;
    return mapped;
  });
  return changed ? next : list;
};

/** `world` carrying `value` for `key`, or `world` itself when that slice is the one it already had. An
 *  empty result for an absent slice is also "nothing rebuilt" — writing `[]` back would backfill the
 *  author's world with an array they never wrote. */
const withSlice = <K extends keyof RuleWorld>(world: RuleWorld, key: K, value: RuleWorld[K]): RuleWorld =>
  value === world[key] || (world[key] === undefined && Array.isArray(value) && value.length === 0)
    ? world : { ...world, [key]: value };

/** "a, b and c" — how a finding names the handful of items it covers. */
const listNames = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** An entity as a finding names it: chips resolved, so the row reads like the editor's own list. */
const asItem = (entity: Entity, world: RuleWorld): FindingItem => ({
  id: entity.id,
  name: describePlaceholders(entity.name ?? '', world.placeholders) || 'Untitled',
});

/** An entity's written forms — its name and aliases, chips resolved, blanks dropped. */
const writtenForms = (entity: Entity, world: RuleWorld): string[] =>
  [entity.name, ...(entity.aliases ?? [])]
    .map((text) => describePlaceholders(text ?? '', world.placeholders).trim())
    .filter(Boolean);

const aliasesOf = (entity: Entity, world: RuleWorld): string[] =>
  (entity.aliases ?? []).map((a) => describePlaceholders(a ?? '', world.placeholders).trim()).filter(Boolean);

// An alias phrase led by an article. Alias matching is case-sensitive, so "the visitor" misses every
// sentence-initial "The visitor" and vice versa — the article is the whole defect.
const LEADING_ARTICLE = /^(?:the|an|a)\s+\S/i;
const ARTICLE_PREFIX = /^(?:the|an|a)\s+/i;

/** `aliases` with each leading article dropped. A strip can land on a form the entity already carries —
 *  "the visitor" beside "visitor" — so one of that pair goes; an alias the strip never touched is left
 *  exactly as written, duplicates included, since it is no part of this finding. */
const withoutArticles = (aliases: string[]): string[] => {
  const next: string[] = [];
  const stripped = new Set<string>();
  for (const alias of aliases) {
    // The article has to be in the raw text to be removable: one arriving from a chip's value has nothing
    // here to strip, so it stays for the author to resolve.
    const trimmed = alias.trim();
    if (!LEADING_ARTICLE.test(trimmed)) {
      if (!stripped.has(alias)) next.push(alias);
      continue;
    }
    const bare = trimmed.replace(ARTICLE_PREFIX, '');
    if (stripped.has(bare) || next.includes(bare)) continue;
    stripped.add(bare);
    next.push(bare);
  }
  return next;
};

const sameAliases = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((text, i) => text === b[i]);

const aliasLeadingArticle: Rule = {
  id: 'alias-leading-article',
  severity: 'warning',
  section: 'entities',
  matching: true,
  advanced: true,
  summary: (count) =>
    `${count} aliases begin with an article — alias matching is case-sensitive, so they miss wherever the sentence capitalizes them differently`,
  check: (world) => (world.entities ?? []).flatMap((entity) =>
    aliasesOf(entity, world)
      .filter((alias) => LEADING_ARTICLE.test(alias))
      .map((alias) => finding(
        aliasLeadingArticle,
        `Alias ${quote(alias)} begins with an article — alias matching is case-sensitive, so it misses wherever the sentence capitalizes it differently`,
        [asItem(entity, world)],
      )),
  ),
  fix: (world) => withSlice(world, 'entities', mapChanged(world.entities ?? [], (entity) => {
    const aliases = entity.aliases;
    if (!aliases?.length) return entity;
    const next = withoutArticles(aliases);
    return sameAliases(next, aliases) ? entity : { ...entity, aliases: next };
  })),
};

const entityMatchCollision: Rule = {
  id: 'entity-match-collision',
  severity: 'warning',
  section: 'entities',
  matching: true,
  summary: (count) =>
    `${count} written forms match more than one entity — a mention of either detects both`,
  check: (world) => {
    // One bucket per piece of text the matcher can see, holding every entity that lays claim to it.
    const claims = new Map<string, { text: string; entities: Entity[] }>();
    for (const entity of world.entities ?? []) {
      const seen = new Set<string>();
      for (const form of writtenForms(entity, world)) {
        const key = matchKey(form);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const bucket = claims.get(key) ?? { text: form, entities: [] };
        bucket.entities.push(entity);
        claims.set(key, bucket);
      }
    }
    return [...claims.values()]
      .filter((bucket) => bucket.entities.length > 1)
      .map((bucket) => {
        const items = bucket.entities.map((e) => asItem(e, world));
        return finding(
          entityMatchCollision,
          `${quote(bucket.text)} matches ${listNames(items.map((i) => i.name))} — a mention of ${items.length > 2 ? 'any one detects them all' : 'either detects both'}`,
          items,
        );
      });
  },
};

/**
 * Whether an entity's own name already matches everywhere `alias` does, so the alias buys nothing. Same
 * text to `matchKey` is not enough: a single-word name only matches capitalized, while aliases match
 * case-sensitively, so a lowercase alias of a one-word name is the author's cover for lowercase prose.
 * A multi-word name matches case-insensitively and so covers every casing of itself.
 */
const nameCoversAlias = (name: string, alias: string): boolean => {
  const trimmed = name.trim();
  if (!trimmed || matchKey(alias) !== matchKey(trimmed)) return false;
  return /\s/.test(trimmed) || /[A-Z]/.test(alias.trim().charAt(0));
};

const aliasSelfDuplicate: Rule = {
  id: 'alias-self-duplicate',
  severity: 'info',
  section: 'entities',
  matching: true,
  advanced: true,
  summary: (count) => `${count} aliases repeat their own entity’s name, which already matches on its own`,
  check: (world) => (world.entities ?? []).flatMap((entity) => {
    const name = describePlaceholders(entity.name ?? '', world.placeholders);
    return aliasesOf(entity, world)
      // An articled alias of an articled name is the article rule's: its fix strips to a bare form the
      // name can't match on its own, where deleting the alias would drop that coverage.
      .filter((alias) => !LEADING_ARTICLE.test(alias))
      .filter((alias) => nameCoversAlias(name, alias))
      .map((alias) => finding(
        aliasSelfDuplicate,
        `Alias ${quote(alias)} repeats its own entity’s name, which already matches on its own`,
        [asItem(entity, world)],
      ));
  }),
  fix: (world) => withSlice(world, 'entities', mapChanged(world.entities ?? [], (entity) => {
    const name = describePlaceholders(entity.name ?? '', world.placeholders);
    const aliases = entity.aliases;
    if (!aliases?.length) return entity;
    const next = aliases.filter((alias) => {
      const text = describePlaceholders(alias ?? '', world.placeholders).trim();
      return LEADING_ARTICLE.test(text) || !nameCoversAlias(name, text);
    });
    return next.length === aliases.length ? entity : { ...entity, aliases: next };
  })),
};

/** A non-entity item, chips resolved like the editor's own lists resolve them. */
const namedItem = (id: string, name: string | undefined, world: RuleWorld, section?: FindingSection): FindingItem => ({
  id,
  name: describePlaceholders(name ?? '', world.placeholders).trim() || 'Untitled',
  ...(section ? { section } : {}),
});

/**
 * A placeholder as a finding names it: bare at the top level, and qualified with `›` under an owner, so a
 * world carrying three rows called `Hair` says which Hair. The item keeps the placeholder's own id, so Open
 * still lands on the row rather than on whatever owns it.
 */
const placeholderItem = (id: string, world: RuleWorld, section?: FindingSection): FindingItem =>
  namedItem(id, qualifiedPlaceholderName(world.placeholders ?? [], id) ?? undefined, world, section);

/** An entry as its list labels it: the free name, else the first keyword. */
const entryItem = (entry: DictionaryEntry, world: RuleWorld): FindingItem =>
  namedItem(entry.id, entry.name || entry.key?.[0], world);

/** Every entry in every book — definition checks apply whether or not a book is currently enabled. */
const allEntries = (world: RuleWorld): DictionaryEntry[] =>
  (world.dictionaries ?? []).flatMap((book) => book.entries ?? []);

const primaryKeys = (entry: DictionaryEntry): string[] => (entry.key ?? []).filter(Boolean);
const secondaryKeys = (entry: DictionaryEntry): string[] => (entry.secondaryKeys ?? []).filter(Boolean);

// ── Reference integrity: everything that points at nothing ────────────────────────────────────────────────

const entityLocationOrphan: Rule = {
  id: 'entity-location-orphan',
  severity: 'error',
  section: 'entities',
  summary: (count) => `${count} entities are placed at locations that don’t exist`,
  check: (world) => {
    const known = new Set((world.locations ?? []).map((l) => l.id));
    return (world.entities ?? [])
      .filter((entity) => (entity.locations ?? []).some((id) => !known.has(id)))
      .map((entity) => {
        const item = asItem(entity, world);
        return finding(entityLocationOrphan, `${quote(item.name)} is placed at a location that doesn’t exist`, [item]);
      });
  },
  fix: (world) => {
    const known = new Set((world.locations ?? []).map((l) => l.id));
    return withSlice(world, 'entities', mapChanged(world.entities ?? [], (entity) => {
      const placements = entity.locations;
      if (!placements?.length) return entity;
      const live = placements.filter((id) => known.has(id));
      // Dropping the last placement would leave the entity nowhere, and where it belongs instead is the
      // author's call — so an entity with nothing live left keeps its reference, and its finding.
      if (live.length === placements.length || live.length === 0) return entity;
      return { ...entity, locations: live };
    }));
  },
};

const traitToggleMissingStat: Rule = {
  id: 'trait-toggle-missing-stat',
  severity: 'error',
  section: 'traits',
  advanced: true,
  summary: (count) => `${count} trait stat toggles point at stats that don’t exist`,
  check: (world) => {
    const known = new Set((world.stats ?? []).map((s) => s.id));
    return (world.traits ?? [])
      .filter((trait) => (trait.statToggles ?? []).some((toggle) => !known.has(toggle.statId)))
      .map((trait) => {
        const item = namedItem(trait.id, trait.name, world);
        return finding(traitToggleMissingStat, `${quote(item.name)} toggles a stat that doesn’t exist`, [item]);
      });
  },
};

const traitPinInvalid: Rule = {
  id: 'trait-pin-invalid',
  severity: 'error',
  section: 'traits',
  advanced: true,
  summary: (count) => `${count} trait placeholder pins name a placeholder that doesn’t exist`,
  // Only the placeholder has to exist. Pinning a value its list doesn't carry is the feature — a trait
  // forcing a shade nobody else rolls — and play applies it verbatim.
  check: (world) => {
    const known = new Set((world.placeholders ?? []).map((p) => p.id));
    return (world.traits ?? []).flatMap((trait) =>
      (trait.placeholderPins ?? [])
        .filter((pin) => !known.has(pin.placeholderId))
        .map(() => {
          const item = namedItem(trait.id, trait.name, world);
          return finding(traitPinInvalid, `${quote(item.name)} pins a placeholder that doesn’t exist`, [item]);
        }),
    );
  },
};

/** One owner of chip-bearing text: the finding item it maps to, and every field of it chips resolve in.
 *  The field list mirrors the gameplay priming pass (PlaceholderSessionContext) — the ground truth for
 *  where a chip actually works. */
interface ChipOwner {
  item: FindingItem;
  texts: Array<string | undefined>;
}

const chipOwners = (world: RuleWorld): ChipOwner[] => [
  {
    item: { id: 'overview', name: world.worldOverview?.name || 'Overview', section: 'overview' },
    texts: [
      world.worldOverview?.systemPrompt, world.worldOverview?.readme, world.worldOverview?.introReadme,
      world.worldOverview?.openingCue,
    ],
  },
  ...(world.entities ?? []).map((e) => ({
    item: { ...asItem(e, world), section: 'entities' as const },
    texts: [e.name, ...(e.aliases ?? []), e.playerDescription, e.aiDescription, e.aiSummary, e.imageTags],
  })),
  ...(world.locations ?? []).map((l) => ({
    item: namedItem(l.id, l.name, world, 'locations'),
    texts: [l.name, l.playerDescription, l.aiDescription, l.aiSummary, l.description, l.imageTags],
  })),
  ...allEntries(world).map((entry) => ({
    item: { ...entryItem(entry, world), section: 'dictionary' as const },
    texts: [entry.name, ...(entry.key ?? []), ...(entry.secondaryKeys ?? []), entry.value],
  })),
  ...(world.stats ?? []).map((s) => ({ item: namedItem(s.id, s.name, world, 'stats'), texts: [s.name] })),
  ...(world.traits ?? []).map((t) => ({
    item: namedItem(t.id, t.name, world, 'traits'),
    texts: [t.name, t.playerDescription, t.aiDescription],
  })),
  ...(world.traitGroups ?? []).map((g) => ({
    item: namedItem(g.id, g.name, world, 'traits'),
    texts: [g.name, g.playerDescription, g.aiDescription],
  })),
];

/** Every chip-bearing authored field, flat — the same field list the gameplay priming pass rolls across,
 *  exported so the Bench's opening rolls prime exactly the placements a fresh game would. */
export const chipBearingTexts = (world: RuleWorld): string[] =>
  chipOwners(world).flatMap((owner) => owner.texts).filter((text): text is string => !!text);

/** Every placeholder id the chips in `texts` reference, whatever their mode. */
const chipIds = (texts: Array<string | undefined>): Set<string> => {
  const { worldIds, unique } = collectPlaceholderPlacements(texts.filter((t): t is string => !!t));
  const ids = new Set(worldIds);
  for (const placement of unique) ids.add(placement.id);
  return ids;
};

const chipUnknownPlaceholder: Rule = {
  id: 'chip-unknown-placeholder',
  severity: 'error',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} items contain chips pointing at placeholders that don’t exist`,
  check: (world) => {
    const known = new Set((world.placeholders ?? []).map((p) => p.id));
    return chipOwners(world)
      .filter((owner) => [...chipIds(owner.texts)].some((id) => !known.has(id)))
      .map((owner) => finding(
        chipUnknownPlaceholder,
        `${quote(owner.item.name)} contains a chip pointing at a placeholder that doesn’t exist`,
        [owner.item],
      ));
  },
};

const chipNeverScanned: Rule = {
  id: 'chip-never-scanned',
  severity: 'error',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} stats carry chips in fields placeholders never resolve — they’ll read as raw text`,
  check: (world) => (world.stats ?? []).flatMap((stat) => {
    const item = namedItem(stat.id, stat.name, world);
    const spots: string[] = [];
    if (stat.description && hasPlaceholders(stat.description)) spots.push('description');
    if ((stat.descriptors ?? []).some((d) => d.description && hasPlaceholders(d.description))) spots.push('descriptors');
    if (spots.length === 0) return [];
    return [finding(
      chipNeverScanned,
      `${quote(item.name)} has a chip in its ${spots.join(' and ')} — placeholders never resolve there, so it’ll read as raw text`,
      [item],
    )];
  }),
};

/** Every text in the world a chip token can sit in — deliberately wider than `chipOwners`, which lists only
 *  the fields the resolver scans. "Never used" has to mean unmentioned *anywhere*, or a chip parked somewhere
 *  that doesn't resolve would read as no mention at all and the placeholder under it would look disposable. */
const allChipTexts = (world: RuleWorld): Array<string | undefined> => [
  ...chipOwners(world).flatMap((owner) => owner.texts),
  // Values are chip-capable, so a structural child is placed by the parent that names it and by nothing
  // else. Reading it as unused would put a delete-it Fix on the parts a whole character is built from.
  ...(world.placeholders ?? []).flatMap((ph) => (ph.values ?? []).map((v) => v.text)),
  world.worldOverview?.description,
  ...(world.stats ?? []).flatMap((s) => [s.description, ...(s.descriptors ?? []).map((d) => d.description)]),
  ...(world.statUpdates ?? []).map((u) => u.prompt),
];

/** The placeholders no chip anywhere references, each with the traits still pinning it. A pin is authored
 *  intent, not a placement — any pin entry counts, empty value included — so the two rules over this list
 *  exactly partition "unplaced", and the delete-fix can never orphan a pin. */
const unplacedPlaceholders = (world: RuleWorld): Array<{ placeholder: Placeholder; pinnedBy: Trait[] }> => {
  const placed = chipIds(allChipTexts(world));
  return (world.placeholders ?? [])
    .filter((p) => !placed.has(p.id))
    .map((placeholder) => ({
      placeholder,
      pinnedBy: (world.traits ?? []).filter((t) =>
        (t.placeholderPins ?? []).some((pin) => pin.placeholderId === placeholder.id)),
    }));
};

const placeholderUnused: Rule = {
  id: 'placeholder-unused',
  severity: 'info',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} placeholders are defined but never used`,
  check: (world) => unplacedPlaceholders(world)
    .filter(({ pinnedBy }) => pinnedBy.length === 0)
    .map(({ placeholder }) => {
      const item = placeholderItem(placeholder.id, world);
      return finding(placeholderUnused, `${quote(item.name)} is defined but never used`, [item]);
    }),
  fix: (world) => {
    const dead = new Set(unplacedPlaceholders(world)
      .filter(({ pinnedBy }) => pinnedBy.length === 0)
      .map(({ placeholder }) => placeholder.id));
    if (dead.size === 0) return world;
    return withSlice(world, 'placeholders', (world.placeholders ?? []).filter((p) => !dead.has(p.id)));
  },
};

/** The forgot-to-place case: a trait wires a value in, but no text carries the chip, so the pinned value
 *  is never seen. No fix — only the author knows where the chip belongs. */
const placeholderPinnedUnused: Rule = {
  id: 'placeholder-pinned-unused',
  severity: 'warning',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} placeholders are pinned by traits but placed in no text`,
  check: (world) => {
    const flagged = unplacedPlaceholders(world).filter(({ pinnedBy }) => pinnedBy.length > 0);
    // A trait's chip carries every flagged placeholder it pins. The grouped row dedups items by id, so a
    // trait pinning two of them lands beside only the first — the label, not adjacency, says which is whose.
    const flaggedNames = new Map(flagged.map(({ placeholder }) =>
      [placeholder.id, placeholderItem(placeholder.id, world).name]));
    const traitItem = (t: Trait): FindingItem => {
      const pinned = (t.placeholderPins ?? [])
        .map((pin) => flaggedNames.get(pin.placeholderId))
        .filter((name): name is string => name !== undefined);
      const base = namedItem(t.id, t.name, world, 'traits');
      return { ...base, name: `${base.name} (pins ${listNames(pinned.map(quote))})` };
    };
    return flagged.map(({ placeholder, pinnedBy }) => {
      const item = placeholderItem(placeholder.id, world);
      return finding(
        placeholderPinnedUnused,
        `${quote(item.name)} is pinned by ${listNames(pinnedBy.map((t) => namedItem(t.id, t.name, world).name))} but placed in no text — the pinned value never shows up`,
        [item, ...pinnedBy.map(traitItem)],
      );
    });
  },
};

// A stat-name lookup in stat code, in either direction: `s.name === "X"` or `"X" === s.name`. Also matches
// `==`/`!=` forms — any comparison against `.name` names a stat.
const NAME_THEN_LITERAL = /\.name\s*[!=]==?\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
const LITERAL_THEN_NAME = /(["'`])((?:\\.|(?!\1).)*)\1\s*[!=]==?\s*[\w$]+(?:\??\.[\w$]+)*\??\.name\b/g;

/** Every stat name a piece of code compares against, unescaped. Template literals with `${}` are dynamic
 *  and skipped — there is no literal name to check. */
const statNamesInCode = (code: string): string[] => {
  const names: string[] = [];
  for (const re of [NAME_THEN_LITERAL, LITERAL_THEN_NAME]) {
    for (const m of code.matchAll(re)) {
      const literal = m[2];
      if (!literal || literal.includes('${')) continue;
      names.push(literal.replace(/\\(.)/g, '$1'));
    }
  }
  return names;
};

const statCodeUnknownStat: Rule = {
  id: 'stat-code-unknown-stat',
  severity: 'error',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} stats’ code looks up stat names that don’t exist`,
  check: (world) => {
    // Code compares against runtime names, where chips have resolved — so both spellings are valid targets.
    const stats = world.stats ?? [];
    const known = new Set(stats.flatMap((s) => [s.name, describePlaceholders(s.name ?? '', world.placeholders)]));
    return stats.flatMap((stat) => {
      if (!stat.code) return [];
      const item = namedItem(stat.id, stat.name, world);
      return [...new Set(statNamesInCode(stat.code))]
        .filter((name) => !known.has(name))
        .map((name) => finding(
          statCodeUnknownStat,
          `Code on ${quote(item.name)} looks up a stat named ${quote(name)}, which doesn’t exist`,
          [item],
        ));
    });
  },
};

// ── Dictionary: entries that can never fire ───────────────────────────────────────────────────────────────

const entrySecondaryWithoutPrimary: Rule = {
  id: 'dictionary-secondary-without-primary',
  severity: 'error',
  section: 'dictionary',
  matching: true,
  advanced: true,
  summary: (count) => `${count} dictionary entries have secondary keywords but no primary ones, so they can never fire`,
  check: (world) => allEntries(world)
    // A constant entry fires regardless of keys, so "can never fire" would be false of it.
    .filter((entry) => !entry.constant && primaryKeys(entry).length === 0 && secondaryKeys(entry).length > 0)
    .map((entry) => {
      const item = entryItem(entry, world);
      return finding(
        entrySecondaryWithoutPrimary,
        `${quote(item.name)} has secondary keywords but no primary ones — secondaries only gate a primary hit, so it can never fire`,
        [item],
      );
    }),
};

const entryInert: Rule = {
  id: 'dictionary-entry-inert',
  severity: 'error',
  section: 'dictionary',
  matching: true,
  summary: (count) => `${count} dictionary entries have no keywords and aren’t constant, so they can never fire`,
  check: (world) => allEntries(world)
    // Secondary-without-primary is the sharper diagnosis; this rule covers the entries with nothing at all.
    .filter((entry) => !entry.constant && primaryKeys(entry).length === 0 && secondaryKeys(entry).length === 0)
    .map((entry) => {
      const item = entryItem(entry, world);
      return finding(entryInert, `${quote(item.name)} has no keywords and isn’t constant, so it can never fire`, [item]);
    }),
};

const entryRegexInvalid: Rule = {
  id: 'dictionary-regex-invalid',
  severity: 'error',
  section: 'dictionary',
  advanced: true,
  summary: (count) => `${count} dictionary entries have regex keywords that don’t compile, so those keywords never match`,
  check: (world) => allEntries(world).flatMap((entry) => {
    if (!entry.useRegex) return [];
    // Mirrors the matcher's own compilation (dictionaryUtils.keyMatcher), which silently never matches on failure.
    const compiles = (pattern: string) => {
      try { new RegExp(pattern, entry.caseSensitive ? '' : 'i'); return true; }
      catch { return false; }
    };
    const broken = [...primaryKeys(entry), ...secondaryKeys(entry)].filter((k) => !compiles(k));
    if (broken.length === 0) return [];
    const item = entryItem(entry, world);
    return [finding(
      entryRegexInvalid,
      `${quote(item.name)} has a regex keyword that doesn’t compile (${quote(broken[0])}), so it never matches`,
      [item],
    )];
  }),
};

// ── Reachability: what can never happen ───────────────────────────────────────────────────────────────────

const noStartingLocation: Rule = {
  id: 'no-starting-location',
  severity: 'error',
  section: 'locations',
  summary: () => 'No location is flagged as a starting location',
  check: (world) => (world.locations ?? []).some((l) => l.isStarting) ? [] : [finding(
    noStartingLocation,
    'No location is flagged as a starting location — a new game picks any location at random',
    [{ id: 'locations', name: world.worldOverview?.name || 'This World' }],
  )],
};

/** The pre-rebuild start flag. It renders nowhere, so the only sign it's carrying the world's real start
 *  intent is this rule. */
const hasLegacyStart = (location: GameLocation): boolean => 'isStartLocation' in location;

const legacyStartValue = (location: GameLocation): unknown =>
  (location as GameLocation & { isStartLocation?: unknown }).isStartLocation;

const legacyStartLocation: Rule = {
  id: 'legacy-start-location',
  severity: 'warning',
  section: 'locations',
  summary: (count) => `${count} locations carry the legacy isStartLocation field, which the game no longer reads`,
  check: (world) => {
    // Mirrors the fix: only a truthy value signals start intent, and only while no live flag carries it —
    // once one does, the leftover has nothing left to say and just needs deleting.
    const hasLiveStart = (world.locations ?? []).some((l) => l.isStarting);
    return (world.locations ?? []).filter(hasLegacyStart).map((location) => {
      const item = namedItem(location.id, location.name, world);
      const advice = legacyStartValue(location) && !hasLiveStart
        ? 'flag it as a starting location instead'
        : 'delete the field';
      return finding(
        legacyStartLocation,
        `${quote(item.name)} carries the legacy isStartLocation field, which the game no longer reads — ${advice}`,
        [item],
      );
    });
  },
  fix: (world) => {
    // A truthy leftover is the world's only surviving record of its start intent, so deleting it outright
    // would trade this finding for a world with no starting location. The first one carries that intent
    // over to the live flag — but only when nothing already claims it, since a real flag supersedes it.
    const locations = world.locations ?? [];
    const promoteId = locations.some((l) => l.isStarting)
      ? undefined
      : locations.find((l) => hasLegacyStart(l) && legacyStartValue(l))?.id;
    return withSlice(world, 'locations', mapChanged(locations, (location) => {
      if (!hasLegacyStart(location)) return location;
      const { isStartLocation: _legacy, ...rest } = location as GameLocation & { isStartLocation?: unknown };
      return location.id === promoteId ? { ...rest, isStarting: true } : rest;
    }));
  },
};

const entityNowhere: Rule = {
  id: 'entity-nowhere',
  severity: 'warning',
  section: 'entities',
  summary: (count) => `${count} entities are placed in no location, so they can never appear`,
  check: (world) => (world.entities ?? [])
    .filter((entity) => (entity.locations ?? []).length === 0)
    .map((entity) => {
      const item = asItem(entity, world);
      return finding(entityNowhere, `${quote(item.name)} is placed in no location, so it can never appear`, [item]);
    }),
};

/** The stats that can be live at some point in a playthrough — everything except a stat that starts disabled
 *  with no trait to switch it on. A stat that is never live never runs its code and never reaches the AI. */
const everActiveStats = (world: RuleWorld): Stat[] => {
  const enabledBy = new Set((world.traits ?? []).flatMap((trait) =>
    (trait.statToggles ?? []).filter((toggle) => toggle.enabled).map((toggle) => toggle.statId),
  ));
  return (world.stats ?? []).filter((stat) => stat.enabled !== false || enabledBy.has(stat.id));
};

const statDisabledForever: Rule = {
  id: 'stat-disabled-forever',
  severity: 'warning',
  section: 'stats',
  summary: (count) => `${count} stats start disabled and no trait ever enables them`,
  check: (world) => {
    const live = new Set(everActiveStats(world).map((stat) => stat.id));
    return (world.stats ?? [])
      .filter((stat) => !live.has(stat.id))
      .map((stat) => {
        const item = namedItem(stat.id, stat.name, world);
        return finding(statDisabledForever, `${quote(item.name)} starts disabled and no trait ever enables it`, [item]);
      });
  },
};

// ── Stat sanity: numbers that can't mean what the author wrote ────────────────────────────────────────────

const startsInRange = (stat: Stat): boolean => {
  const value = statStartValue(stat);
  return value >= stat.min && value <= stat.max;
};

// Banding goes through statContext.activeDescriptor — the prompt's own lookup — so a rule can never band
// a value differently from play.

const statStartingOutOfRange: Rule = {
  id: 'stat-starting-out-of-range',
  severity: 'error',
  section: 'stats',
  summary: (count) => `${count} stats start at a value outside their own min and max`,
  check: (world) => (world.stats ?? []).filter((stat) => !startsInRange(stat)).map((stat) => {
    const item = namedItem(stat.id, stat.name, world);
    return finding(
      statStartingOutOfRange,
      `${quote(item.name)} starts at ${statStartValue(stat)}, outside its range of ${stat.min} to ${stat.max}`,
      [item],
    );
  }),
};

const statStartNoDescriptor: Rule = {
  id: 'stat-start-no-descriptor',
  severity: 'warning',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} stats start above every descriptor band, so the AI is told no status for them`,
  check: (world) => (world.stats ?? [])
    // A start outside the range is the sharper diagnosis and already fires; its band is nobody's question.
    .filter((stat) => (stat.descriptors ?? []).length > 0 && startsInRange(stat)
      && !activeDescriptor(stat, statStartValue(stat)))
    .map((stat) => {
      const item = namedItem(stat.id, stat.name, world);
      const spans = descriptorSpans(stat);
      const top = spans[spans.length - 1];
      // Both numbers in the stat's own threshold unit: comparing a raw value against a percent threshold
      // is exactly the reading that made this message unreadable.
      return finding(
        statStartNoDescriptor,
        `${quote(item.name)} starts at ${describeInThresholdUnits(stat, statStartValue(stat))}, above its top band, `
        + `which stops at ${describeInThresholdUnits(stat, top.to)} — the AI is told no status for it until the value drops`,
        [item],
      );
    }),
};

const statDescriptorOutOfRange: Rule = {
  id: 'stat-descriptor-out-of-range',
  severity: 'warning',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} stats have a descriptor threshold outside the values the stat can hold`,
  check: (world) => (world.stats ?? []).flatMap((stat) => {
    const stray = (stat.descriptors ?? []).find((d) => isThresholdOutOfRange(stat, d.threshold));
    if (!stray) return [];
    const item = namedItem(stat.id, stat.name, world);
    const above = thresholdValue(stat, stray.threshold) > stat.max;
    return [finding(
      statDescriptorOutOfRange,
      `${quote(item.name)} bands ${quote(stray.description)} at ${describeThreshold(stat, stray.threshold)}, `
      + `outside its range of ${stat.min} to ${stat.max} — `
      + (above
        ? 'the value can never climb that far, so the band below it covers everything up to the top'
        : 'the value can never fall that low, so the band never shows'),
      [item],
    )];
  }),
};

const statDescriptorCoverageGap: Rule = {
  id: 'stat-descriptor-coverage-gap',
  severity: 'warning',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} stats’ descriptor bands stop short of Max, so the top of the range has no status`,
  // Every gap found in real worlds was the same misreading — thresholds taken as a band's floor, so the
  // top band silently covers nothing above it. Deliberate silence at the full end is legitimate but rare;
  // that author dismisses the row once.
  check: (world) => (world.stats ?? []).flatMap((stat) => {
    const gap = uncoveredSpan(stat);
    if (!gap) return [];
    const item = namedItem(stat.id, stat.name, world);
    return [finding(
      statDescriptorCoverageGap,
      `${quote(item.name)}’s bands stop at ${describeInThresholdUnits(stat, gap.from)}, short of Max — the AI `
      + 'is told no status for the rest of the range',
      [item],
    )];
  }),
  // The obvious repair: the top band's threshold becomes Max, so its wording covers the gap — exactly the
  // floor-misreading author's intent ("from 70, Steady" keeps saying Steady at 100).
  fix: (world) => withSlice(world, 'stats', mapChanged(world.stats ?? [], (stat) => {
    if (!uncoveredSpan(stat)) return stat;
    const sorted = sortedDescriptors(stat);
    const top = sorted[sorted.length - 1];
    return {
      ...stat,
      descriptors: (stat.descriptors ?? []).map((d) => (d === top ? { ...d, threshold: valueThreshold(stat, stat.max) } : d)),
    };
  })),
};

const statDescriptorDuplicateThreshold: Rule = {
  id: 'stat-descriptor-duplicate-threshold',
  severity: 'warning',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} stats have two descriptors on one threshold, so the second can never apply`,
  check: (world) => (world.stats ?? []).flatMap((stat) => {
    // The band sort is stable, so among equal thresholds the one written first is the one that wins.
    const claimed = new Set<number>();
    const dead: StatDescriptor[] = [];
    for (const descriptor of stat.descriptors ?? []) {
      if (claimed.has(descriptor.threshold)) dead.push(descriptor);
      else claimed.add(descriptor.threshold);
    }
    if (dead.length === 0) return [];
    const item = namedItem(stat.id, stat.name, world);
    return [finding(
      statDescriptorDuplicateThreshold,
      `${quote(item.name)} has two descriptors at ${describeThreshold(stat, dead[0].threshold)} — only the first applies, so ${quote(dead[0].description)} never shows`,
      [item],
    )];
  }),
};

const isOffRangePercentage = (stat: Stat): boolean =>
  stat.type?.toLowerCase() === 'percentage' && (stat.min !== 0 || stat.max !== 100);

/** A percentage stat on the range the editor itself forces the moment the type is chosen (StatManager's
 *  `handleTypeChange`), with the start and live value carried into it. */
const pinnedToPercent = (stat: Stat): Stat => ({
  ...stat,
  min: 0,
  max: 100,
  ...(typeof stat.starting === 'number' ? { starting: clamp(stat.starting, 0, 100) } : {}),
  ...(typeof stat.value === 'number' ? { value: clamp(stat.value, 0, 100) } : {}),
});

const statPercentageBounds: Rule = {
  id: 'stat-percentage-bounds',
  severity: 'warning',
  section: 'stats',
  summary: (count) => `${count} percentage stats don’t run from 0 to 100, so the “%” the player sees is a raw number`,
  check: (world) => (world.stats ?? []).filter(isOffRangePercentage).map((stat) => {
    const item = namedItem(stat.id, stat.name, world);
    return finding(
      statPercentageBounds,
      `${quote(item.name)} is a percentage stat but runs from ${stat.min} to ${stat.max} — its value is displayed as a bare “%”, so the player is shown the raw number`,
      [item],
    );
  }),
  fix: (world) => withSlice(world, 'stats', mapChanged(world.stats ?? [], (stat) =>
    isOffRangePercentage(stat) ? pinnedToPercent(stat) : stat)),
};

const statCodeNeverTicks: Rule = {
  id: 'stat-code-never-ticks',
  severity: 'warning',
  section: 'stats',
  advanced: true,
  summary: (count) =>
    `${count} stats have code that runs only on turns the AI changed a stat — nothing in this world reads a clock variable`,
  check: (world) => {
    // The gate reads the *enabled* stats (GameViewer's `anyStatUsesClock` over `activeStats`), so a clock
    // reference on a stat no trait ever switches on grants nothing — and that stat's own code never runs.
    const coded = everActiveStats(world).filter((stat) => stat.code?.trim());
    // One clock reference among them puts every coded stat on the every-turn schedule.
    if (coded.some((stat) => usesStatClock(stat.code))) return [];
    return coded.map((stat) => {
      const item = namedItem(stat.id, stat.name, world);
      return finding(
        statCodeNeverTicks,
        `Code on ${quote(item.name)} runs only on turns the AI reported a stat change — no stat in this world reads a clock variable, which is what puts code on the every-turn schedule`,
        [item],
      );
    });
  },
};

/** A trait's summed contribution to one stat on one axis. Traits are chosen one at a time, so a rule about a
 *  single trait reads only that trait's own numbers. */
const traitContribution = (stat: Stat, trait: Trait, type: 'starting' | 'min'): number => {
  let total = 0;
  for (const change of trait.statChanges ?? []) {
    if (change.statId === stat.id && change.type === type) total += change.value;
  }
  return total;
};

/** The floor a stat rests on while `trait` is active — bounds derive before the value settles, and a trait's
 *  min contribution only counts upward (traitRuntime's `deriveEffectiveStats`). */
const traitFloor = (stat: Stat, trait: Trait): number =>
  stat.min + Math.max(0, traitContribution(stat, trait, 'min'));

/** Every trait that moves a stat's starting value, with the delta it asks for. */
const traitValueChanges = (world: RuleWorld): Array<{ stat: Stat; trait: Trait; delta: number }> =>
  (world.stats ?? []).flatMap((stat) => (world.traits ?? []).flatMap((trait) => {
    const delta = traitContribution(stat, trait, 'starting');
    return delta === 0 ? [] : [{ stat, trait, delta }];
  }));

/** The two ways in a stat/trait finding offers: the stat it is about, and the trait that caused it. */
const statAndTrait = (stat: Stat, trait: Trait, world: RuleWorld): FindingItem[] => [
  namedItem(stat.id, stat.name, world),
  namedItem(trait.id, trait.name, world, 'traits'),
];

const statTraitDeltaClamped: Rule = {
  id: 'stat-trait-delta-clamped',
  severity: 'warning',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} trait stat penalties land on a stat already at its floor, so the clamp swallows them whole`,
  check: (world) => traitValueChanges(world)
    .filter(({ stat, trait, delta }) => delta < 0 && statStartValue(stat) <= traitFloor(stat, trait))
    .map(({ stat, trait, delta }) => {
      const items = statAndTrait(stat, trait, world);
      return finding(
        statTraitDeltaClamped,
        `${quote(items[1].name)} lowers ${quote(items[0].name)} by ${Math.abs(delta)}, but it already starts at its floor of ${traitFloor(stat, trait)} — the clamp swallows the whole change`,
        items,
      );
    }),
};

/** Whether a stat's code builds on the stat's own current value, which is the one thing that lets a trait's
 *  starting change survive the first recompute. Both ways code can find itself count: the injected
 *  `currentStatId`, and its own name written as a literal. */
const codeReadsSelf = (stat: Stat, world: RuleWorld): boolean => {
  const code = stat.code ?? '';
  // The id has to be quoted to be a lookup: bare containment would read a stat whose id is "1" out of
  // `return 100;` and silently quiet the rule. An idless stat has no lookup to find, rather than an empty one.
  const quotedId = stat.id
    ? new RegExp(`["'\`]${stat.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'\`]`)
    : undefined;
  if (/\bcurrentStatId\b/.test(code) || quotedId?.test(code)) return true;
  const names = new Set([stat.name, describePlaceholders(stat.name ?? '', world.placeholders)]);
  return statNamesInCode(code).some((name) => names.has(name));
};

const statCodeOverridesTrait: Rule = {
  id: 'stat-code-overrides-trait',
  severity: 'warning',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} trait stat changes target stats whose code recomputes them from scratch, which erases the change`,
  check: (world) => traitValueChanges(world)
    .filter(({ stat }) => stat.code?.trim() && !codeReadsSelf(stat, world))
    .map(({ stat, trait, delta }) => {
      const items = statAndTrait(stat, trait, world);
      return finding(
        statCodeOverridesTrait,
        `${quote(items[1].name)} ${delta < 0 ? 'lowers' : 'raises'} ${quote(items[0].name)} by ${Math.abs(delta)}, but that stat’s code recomputes its value without reading it — the change is gone by the next run`,
        items,
      );
    }),
};

const statAiLockFrozen: Rule = {
  id: 'stat-ai-lock-frozen',
  severity: 'info',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} stats are locked against the AI with nothing else able to move them`,
  check: (world) => {
    const movedByTrait = new Set((world.traits ?? []).flatMap((trait) =>
      (trait.statChanges ?? []).filter((change) => change.type === 'starting').map((change) => change.statId),
    ));
    return (world.stats ?? [])
      .filter((stat) => stat.noIncrease && stat.noDecrease && !stat.code?.trim() && !stat.regen
        && !movedByTrait.has(stat.id))
      .map((stat) => {
        const item = namedItem(stat.id, stat.name, world);
        return finding(
          statAiLockFrozen,
          `${quote(item.name)} is locked against the AI in both directions and has no code, regen or trait change to move it — its value never changes during play`,
          [item],
        );
      });
  },
};

// ── Reference integrity, continued: cross-slice references that point at nothing ──────────────────────────

const locationParentOrphan: Rule = {
  id: 'location-parent-orphan',
  severity: 'error',
  section: 'locations',
  summary: (count) => `${count} locations sit under a parent location that doesn’t exist`,
  check: (world) => {
    const known = new Set((world.locations ?? []).map((l) => l.id));
    return (world.locations ?? [])
      .filter((location) => location.parentId != null && !known.has(location.parentId))
      .map((location) => {
        const item = namedItem(location.id, location.name, world);
        return finding(
          locationParentOrphan,
          `${quote(item.name)} sits under a parent location that doesn’t exist — the containment tree is silently broken`,
          [item],
        );
      });
  },
  // A dead parent already contributes nothing in play, so making the location top-level states what is
  // already true; which real parent it belongs under instead is the author's call, made from a working tree.
  fix: (world) => {
    const known = new Set((world.locations ?? []).map((l) => l.id));
    return withSlice(world, 'locations', mapChanged(world.locations ?? [], (location) =>
      location.parentId != null && !known.has(location.parentId) ? { ...location, parentId: null } : location));
  },
};

const connectionEndpointOrphan: Rule = {
  id: 'connection-endpoint-orphan',
  severity: 'warning',
  section: 'locations',
  summary: (count) => `${count} travel links point at locations that don’t exist`,
  check: (world) => {
    const byId = new Map((world.locations ?? []).map((l) => [l.id, l]));
    return (world.connections ?? []).flatMap((connection) => {
      const from = byId.get(connection.from);
      const to = byId.get(connection.to);
      if (from && to) return [];
      const survivor = from ?? to;
      // The way in is the endpoint that still exists — the link itself has no row of its own to open.
      const item = survivor ? namedItem(survivor.id, survivor.name, world) : worldItem(world);
      const message = survivor
        ? `A travel link ${from ? 'from' : 'to'} ${quote(item.name)} points at a location that doesn’t exist — it can never be traveled`
        : 'A travel link runs between two locations that don’t exist';
      return [finding(connectionEndpointOrphan, message, [item])];
    });
  },
};

const statUpdateUnknownStat: Rule = {
  id: 'stat-update-unknown-stat',
  severity: 'warning',
  section: 'stats',
  summary: (count) => `${count} stat updates target stats that don’t exist`,
  check: (world) => {
    // Updates target runtime names, where chips have resolved — so both spellings are valid targets.
    const known = new Set((world.stats ?? []).flatMap(
      (s) => [s.name, describePlaceholders(s.name ?? '', world.placeholders)],
    ));
    return (world.statUpdates ?? []).flatMap((update) => {
      const item = namedItem(update.id, update.name, world);
      return (update.stats ?? [])
        .filter((name) => name && !known.has(name))
        .map((name) => finding(
          statUpdateUnknownStat,
          `${quote(item.name)} targets a stat named ${quote(name)}, which doesn’t exist`,
          [item],
        ));
    });
  },
};

// ── Entity hygiene, continued ─────────────────────────────────────────────────────────────────────────────

const aliasLowercaseNoTwin: Rule = {
  id: 'alias-lowercase-no-twin',
  severity: 'info',
  section: 'entities',
  matching: true,
  advanced: true,
  summary: (count) =>
    `${count} lowercase multi-word aliases have no capitalized twin — alias matching is case-sensitive, so they miss wherever the text capitalizes them`,
  check: (world) => (world.entities ?? []).flatMap((entity) => {
    const aliases = aliasesOf(entity, world);
    const name = describePlaceholders(entity.name ?? '', world.placeholders);
    return aliases
      // The leading article is the sharper diagnosis; once its fix strips it, this rule picks the alias up.
      .filter((alias) => !LEADING_ARTICLE.test(alias))
      // The name is the twin: a multi-word name matches any casing, so telling the author to add a
      // capitalized copy of an alias the self-duplicate rule is about to delete is two contrary answers.
      .filter((alias) => !nameCoversAlias(name, alias))
      .filter((alias) => /\s/.test(alias) && /[a-z]/.test(alias) && alias === alias.toLowerCase())
      .filter((alias) => !aliases.some((twin) => twin !== alias && twin.toLowerCase() === alias.toLowerCase()))
      .map((alias) => finding(
        aliasLowercaseNoTwin,
        `Alias ${quote(alias)} is all lowercase with no capitalized twin — alias matching is case-sensitive, so ${quote(alias.charAt(0).toUpperCase() + alias.slice(1))} at a sentence start is never detected`,
        [asItem(entity, world)],
      ));
  }),
};

const entityNameInWildcardPool: Rule = {
  id: 'entity-name-in-wildcard-pool',
  severity: 'warning',
  section: 'entities',
  matching: true,
  advanced: true,
  summary: (count) => `${count} entity names double as Wildcard values, so a roll can impersonate the entity`,
  check: (world) => (world.entities ?? []).flatMap((entity) => {
    const nameKey = matchKey(describePlaceholders(entity.name ?? '', world.placeholders));
    if (!nameKey) return [];
    return (world.placeholders ?? [])
      .filter((ph) => (ph.values ?? []).length >= 2 && (ph.values ?? []).some((v) => matchKey(v.text) === nameKey))
      .map((ph) => {
        const item = asItem(entity, world);
        return finding(
          entityNameInWildcardPool,
          `${quote(item.name)} is also a value of the Wildcard ${quote(ph.name)} — a roll that lands on it reads as a mention of the entity`,
          [item, placeholderItem(ph.id, world, 'placeholders')],
        );
      });
  }),
};

// An authored summary is served wherever a prompt prefers one, so only the narrator's roster of who is
// here is left with a bare name. Saying "only its name" for that entity would simply be untrue.
const aiBlindTail = (entity: Entity): string => entity.aiSummary?.trim()
  ? ' — the narrator’s roster of who is here carries only its name, while every other prompt serves the summary'
  : ' — the prompt carries only its name';

/** The description-coverage rules, one per gap — split so each grouped row counts one kind of gap. They are
 *  mutually exclusive: an entity missing both descriptions is only the both-rule's finding. */
const descriptionRule = (
  id: string,
  summary: (count: number) => string,
  fires: (noPlayer: boolean, noAi: boolean) => boolean,
  message: (entity: Entity, name: string) => string,
): Rule => {
  const rule: Rule = {
    id,
    severity: 'info',
    section: 'entities',
    summary,
    check: (world) => (world.entities ?? []).flatMap((entity) => {
      if (!fires(!entity.playerDescription?.trim(), !entity.aiDescription?.trim())) return [];
      const item = asItem(entity, world);
      return [finding(rule, message(entity, quote(item.name)), [item])];
    }),
  };
  return rule;
};

const entityMissingPlayerDescription = descriptionRule(
  'entity-missing-player-description',
  (count) => `${count} entities have no player description`,
  (noPlayer, noAi) => noPlayer && !noAi,
  (_entity, name) => `${name} has no player description`,
);

const entityMissingAiDescription = descriptionRule(
  'entity-missing-ai-description',
  (count) => `${count} entities have no AI description`,
  (noPlayer, noAi) => noAi && !noPlayer,
  (entity, name) => `${name} has no AI description${aiBlindTail(entity)}`,
);

const entityMissingBothDescriptions = descriptionRule(
  'entity-missing-both-descriptions',
  (count) => `${count} entities have neither a player nor an AI description`,
  (noPlayer, noAi) => noPlayer && noAi,
  (entity, name) => `${name} has neither a player nor an AI description${aiBlindTail(entity)}`,
);

/** What the two summary rules read: the AI description/summary pair, and the item as its own tab's list
 *  labels it. Entities and locations share the field pair and the per-turn cost, so they share the rules. */
interface SummaryOwner {
  item: FindingItem;
  text: { aiDescription?: string; aiSummary?: string };
}

const summaryOwners = (world: RuleWorld): SummaryOwner[] => [
  ...(world.entities ?? []).map((e) => ({
    item: { ...asItem(e, world), section: 'entities' as const }, text: e,
  })),
  ...(world.locations ?? []).map((l) => ({
    item: namedItem(l.id, l.name, world, 'locations'), text: l,
  })),
];

/** A field's cost as the prompt will actually pay it — chips resolved first, the same way AI Context
 *  estimates, so chip syntax can neither push a short description over a bound nor hide a bloated summary. */
const resolvedTokens = (text: string | undefined, world: RuleWorld): number =>
  estimateTokens(describePlaceholders(text ?? '', world.placeholders).length);

// Long enough that serving the full text on every turn is a real cost to a small model's budget — the
// summary field exists exactly to shorten these.
const LONG_AI_DESCRIPTION_TOKENS = 150;

// A summary that doesn't cut the description at least in half isn't buying the delivery cost it adds.
const SUMMARY_COMPRESSION_RATIO = 0.5;

// A summary clearing this many tokens a turn has earned its keep whatever the ratio says. Doubles as the
// description floor: an item smaller than this isn't worth a row over a handful of tokens either way.
const SUMMARY_SAVINGS_FLOOR_TOKENS = 40;

const entityLongDescriptionNoSummary: Rule = {
  id: 'entity-long-description-no-summary',
  severity: 'info',
  section: 'entities',
  advanced: true,
  summary: (count) =>
    `${count} items have a long AI description and no AI summary, so the whole text enters the prompt every time`,
  check: (world) => summaryOwners(world).flatMap((owner) => {
    const tokens = resolvedTokens(owner.text.aiDescription, world);
    if (owner.text.aiSummary?.trim() || tokens <= LONG_AI_DESCRIPTION_TOKENS) return [];
    return [finding(
      entityLongDescriptionNoSummary,
      `${quote(owner.item.name)}’s AI description is ~${tokens} tokens with no AI summary — the whole text enters the prompt every time`,
      [owner.item],
    )];
  }),
};

const aiSummaryHidesDescription: Rule = {
  id: 'ai-summary-hides-description',
  severity: 'info',
  section: 'entities',
  advanced: true,
  summary: (count) => `${count} items’ AI summaries save almost nothing over the descriptions they hide`,
  // The summary against the description it replaces, not the description alone: a summary earns hiding the
  // full text by what it saves, so real savings clear a marginal ratio and tiny savings don't.
  check: (world) => summaryOwners(world).flatMap((owner) => {
    if (!owner.text.aiSummary?.trim() || !owner.text.aiDescription?.trim()) return [];
    const description = resolvedTokens(owner.text.aiDescription, world);
    if (description < SUMMARY_SAVINGS_FLOOR_TOKENS) return [];
    const summary = resolvedTokens(owner.text.aiSummary, world);
    if (summary <= description * SUMMARY_COMPRESSION_RATIO) return [];
    const savings = description - summary;
    if (savings >= SUMMARY_SAVINGS_FLOOR_TOKENS) return [];
    const trade = savings > 0
      ? `this only saves ~${savings} tokens a turn`
      : savings === 0
        ? 'this saves nothing'
        : `this costs ~${-savings} tokens more a turn`;
    return [finding(
      aiSummaryHidesDescription,
      `${quote(owner.item.name)} has a ~${description}-token AI description and a ~${summary}-token AI summary — ${trade}`,
      [owner.item],
    )];
  }),
};

const locationNoEntities: Rule = {
  id: 'location-no-entities',
  severity: 'info',
  section: 'locations',
  summary: (count) => `${count} locations contain no entities`,
  check: (world) => {
    const occupied = new Set((world.entities ?? []).flatMap((e) => e.locations ?? []));
    return (world.locations ?? [])
      .filter((location) => !occupied.has(location.id))
      .map((location) => {
        const item = namedItem(location.id, location.name, world);
        return finding(locationNoEntities, `${quote(item.name)} contains no entities`, [item]);
      });
  },
};

// ── Trait groups ──────────────────────────────────────────────────────────────────────────────────────────

const traitGroupMultipleDefaults: Rule = {
  id: 'trait-group-multiple-defaults',
  severity: 'warning',
  section: 'traits',
  summary: (count) => `${count} exclusive trait groups mark two or more traits as default`,
  check: (world) => {
    const traits = world.traits ?? [];
    return (world.traitGroups ?? [])
      .filter((group) => group.exclusive)
      .flatMap((group) => {
        const defaults = traits.filter((t) => t.groupId === group.id && t.isDefault);
        if (defaults.length < 2) return [];
        const groupItem = namedItem(group.id, group.name, world);
        const defaultItems = defaults.map((t) => namedItem(t.id, t.name, world));
        return [finding(
          traitGroupMultipleDefaults,
          `${quote(groupItem.name)} allows one active trait but marks ${listNames(defaultItems.map((i) => i.name))} as defaults — only one can actually apply`,
          [groupItem, ...defaultItems],
        )];
      });
  },
};

const traitGroupTooSmall: Rule = {
  id: 'trait-group-too-small',
  severity: 'info',
  section: 'traits',
  summary: (count) => `${count} exclusive trait groups hold fewer than two traits`,
  check: (world) => {
    const traits = world.traits ?? [];
    return (world.traitGroups ?? [])
      .filter((group) => group.exclusive)
      .map((group) => ({ group, size: traits.filter((t) => t.groupId === group.id).length }))
      .filter(({ size }) => size < 2)
      .map(({ group, size }) => {
        const item = namedItem(group.id, group.name, world);
        return finding(
          traitGroupTooSmall,
          `${quote(item.name)} is an exclusive group with ${size === 0 ? 'no traits' : 'only one trait'} — a choice that isn’t a choice`,
          [item],
        );
      });
  },
};

// ── Placeholder pools ─────────────────────────────────────────────────────────────────────────────────────

/** The values a roll can actually land on. Every value benched falls back to a uniform draw
 *  (`weightedPick`), so an all-zero weight map benches nothing. */
const drawableValues = (ph: Placeholder): PlaceholderValue[] => {
  const values = ph.values ?? [];
  const positive = values.filter((value) => placeholderWeight(ph, value) > 0);
  return positive.length > 0 ? positive : values;
};

/** The weight-map keys naming no value in the pool — each one a weight applying to nothing. Keys are
 *  value ids, so this is what a value the author deleted leaves behind. */
const deadWeightKeys = (ph: Placeholder): string[] => {
  const ids = new Set((ph.values ?? []).map((v) => v.id));
  return Object.keys(ph.weights ?? {}).filter((key) => !ids.has(key));
};

const placeholderWeightUnknownValue: Rule = {
  id: 'placeholder-weight-unknown-value',
  severity: 'warning',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} placeholders weight values their pool doesn’t contain`,
  check: (world) => (world.placeholders ?? []).flatMap((ph) => {
    const dead = deadWeightKeys(ph);
    if (dead.length === 0) return [];
    const item = placeholderItem(ph.id, world);
    // A dead key names a value id, which says nothing to an author, so the count carries the finding.
    return [finding(
      placeholderWeightUnknownValue,
      dead.length === 1
        ? `${quote(item.name)} weights a value it no longer has — that weight applies to nothing`
        : `${quote(item.name)} weights ${dead.length} values it no longer has — those weights apply to nothing`,
      [item],
    )];
  }),
  fix: (world) => withSlice(world, 'placeholders', mapChanged(world.placeholders ?? [], (ph) => {
    const dead = new Set(deadWeightKeys(ph));
    if (dead.size === 0) return ph;
    const weights = Object.fromEntries(Object.entries(ph.weights ?? {}).filter(([key]) => !dead.has(key)));
    // A weight map the repair empties goes entirely — absent already means a uniform draw.
    if (Object.keys(weights).length === 0) {
      const { weights: _dead, ...rest } = ph;
      return rest;
    }
    return { ...ph, weights };
  })),
};

const wildcardSingleValue: Rule = {
  id: 'wildcard-single-value',
  severity: 'info',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} Wildcards can only ever draw one value, so they never vary`,
  check: (world) => (world.placeholders ?? [])
    // One authored value is a Variable, which is supposed to be fixed — only weights can strand a Wildcard.
    .filter((ph) => (ph.values ?? []).length >= 2 && drawableValues(ph).length === 1)
    .map((ph) => {
      const item = placeholderItem(ph.id, world);
      return finding(
        wildcardSingleValue,
        `${quote(item.name)} benches every value but ${quote(drawableValues(ph)[0].text)} by weight, so every roll lands the same`,
        [item],
      );
    }),
};

// ── Structured placeholders ───────────────────────────────────────────────────────────────────────────────

/** Every chip in one text, decoded; a token too malformed to read is dropped, since nothing below can say
 *  anything true about where it points. */
const chipTokens = (text: string | undefined): PlaceholderToken[] =>
  (text && hasPlaceholders(text) ? parsePlaceholderText(text) : [])
    .flatMap((segment) => (segment.type === 'variable' ? [decodePlaceholderToken(segment.token)] : []))
    .filter((token): token is PlaceholderToken => token !== null);

/** How many branch rounds a probe walks at most. */
const PROBE_ROUNDS = 8;

/**
 * Round *i* of a probe sends every choice to its *i*-th value. One playthrough only ever sees one variant,
 * so a sweep is what turns "this roll works" into "every roll works" — and one round is enough for a world
 * whose values carry no chips, where there is no branch to route through in the first place.
 */
const probeRounds = (world: RuleWorld): number => {
  const placeholders = world.placeholders ?? [];
  if (!placeholders.some((ph) => (ph.values ?? []).some((v) => hasPlaceholders(v.text ?? '')))) return 1;
  return Math.min(PROBE_ROUNDS, Math.max(1, ...placeholders.map((ph) => (ph.values ?? []).length)));
};

const branchPick = (round: number): PlaceholderPick =>
  (values) => values[Math.min(round, values.length - 1)].text;

/**
 * `text` resolved once per branch round, with everything each walk reported. The real resolver runs it, so a
 * diagnostic can never drift from what play does. Rolls are absent and nothing persists: every round draws
 * fresh, and the union describes what the world *can* do rather than what one playthrough did.
 */
const probeText = (
  text: string, world: RuleWorld, rounds: number,
): { findings: PlaceholderFinding[]; results: string[] } => {
  const findings: PlaceholderFinding[] = [];
  const results: string[] = [];
  for (let round = 0; round < rounds; round++) {
    results.push(resolvePlaceholders(text, {
      placeholders: world.placeholders ?? [],
      rolls: {},
      pick: branchPick(round),
      onFinding: (raised) => findings.push(raised),
    }));
  }
  return { findings, results };
};

const placeholderSlotMiss: Rule = {
  id: 'placeholder-slot-miss',
  severity: 'warning',
  section: 'placeholders',
  advanced: true,
  summary: (count) =>
    `${count} placed paths name a slot some variant doesn’t carry, so they resolve to nothing whenever it rolls`,
  // Reported against the variant that came up short, not the chip that asked: one missing slot strands every
  // sentence pointing at it, and the repair is always in the placeholder, never in the text.
  check: (world) => {
    const rounds = probeRounds(world);
    const misses = new Map<string, { placeholderId: string; asked: string }>();
    for (const text of chipBearingTexts(world)) {
      for (const raised of probeText(text, world, rounds).findings) {
        if (raised.kind !== 'slot-miss' || raised.segment !== 'slot') continue;
        const { placeholderId, asked } = raised;
        if (!placeholderId || !asked) continue;
        misses.set(`${placeholderId} ${asked}`, { placeholderId, asked });
      }
    }
    return [...misses.values()].map(({ placeholderId, asked }) => {
      const item = placeholderItem(placeholderId, world);
      return finding(
        placeholderSlotMiss,
        `${quote(item.name)} carries no ${quote(asked)}, so a placed ${quote(asked)} path routed through it resolves to nothing`,
        [item],
      );
    });
  },
};

/** The two references `chip-unknown-placeholder` cannot see: it reads the root id of a chip in world text,
 *  which leaves out every chip living inside a value and every explicit pick a drill path names. */
const placeholderDanglingReference: Rule = {
  id: 'placeholder-dangling-reference',
  severity: 'error',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} placeholder chips point at a placeholder that no longer exists`,
  check: (world) => {
    const known = new Set((world.placeholders ?? []).map((p) => p.id));
    const gone = (id: string) => !known.has(id);
    const drilledIntoNothing = (token: PlaceholderToken) =>
      (token.path ?? []).some((segment) => segment.kind === 'val' && gone(segment.ref));
    const inValues = (world.placeholders ?? []).flatMap((ph) => {
      const item = placeholderItem(ph.id, world);
      return (ph.values ?? [])
        .flatMap((v) => chipTokens(v.text))
        .filter((token) => gone(token.id) || drilledIntoNothing(token))
        .map(() => finding(
          placeholderDanglingReference,
          `A value of ${quote(item.name)} points at a placeholder that no longer exists`,
          [item],
        ));
    });
    const inText = chipOwners(world).flatMap((owner) => owner.texts
      .flatMap(chipTokens)
      .filter(drilledIntoNothing)
      .map(() => finding(
        placeholderDanglingReference,
        `${quote(owner.item.name)} drills into a placeholder that no longer exists`,
        [owner.item],
      )));
    return [...inValues, ...inText];
  },
};

/** Every placeholder id one placeholder's values reach: a chip anywhere in a value, plus every explicit pick
 *  its path names. These are the edges a cycle can run along. */
const valueReferences = (ph: Placeholder): string[] =>
  (ph.values ?? []).flatMap((v) => chipTokens(v.text)).flatMap((token) =>
    [token.id, ...(token.path ?? []).flatMap((segment) => (segment.kind === 'val' ? [segment.ref] : []))]);

/** Each reference cycle among `placeholders`, as the ids standing on it. A tangle is reported once, by the
 *  first ring found in it — the author untangles a knot, not one edge of it at a time. */
const referenceCycles = (placeholders: Placeholder[]): string[][] => {
  const edges = new Map(placeholders.map((ph) => [ph.id, valueReferences(ph)]));
  const cycles = new Map<string, string[]>();
  const settled = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const walk = (id: string) => {
    if (onStack.has(id)) {
      const ring = stack.slice(stack.indexOf(id));
      cycles.set([...ring].sort().join(' '), ring);
      return;
    }
    if (settled.has(id) || !edges.has(id)) return;
    stack.push(id);
    onStack.add(id);
    for (const next of edges.get(id) ?? []) walk(next);
    stack.pop();
    onStack.delete(id);
    settled.add(id);
  };
  for (const ph of placeholders) walk(ph.id);
  return [...cycles.values()];
};

const placeholderReferenceCycle: Rule = {
  id: 'placeholder-reference-cycle',
  severity: 'error',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} placeholders reference themselves in a loop, so every chip of one shows nothing`,
  check: (world) => {
    const placeholders = world.placeholders ?? [];
    return referenceCycles(placeholders).map((ring) => {
      const items = ring.map((id) => placeholderItem(id, world));
      const loop = items.length === 1
        ? `${quote(items[0].name)} references itself`
        : `${listNames(items.map((i) => quote(i.name)))} reference each other in a loop`;
      return finding(placeholderReferenceCycle, `${loop}, so every chip of them shows nothing`, items);
    });
  },
};

const placeholderEmptyRecord: Rule = {
  id: 'placeholder-empty-record',
  severity: 'warning',
  section: 'placeholders',
  advanced: true,
  // Both nouns can land here, so the count line names neither: an Object joins every value, and a Variable
  // has the one. Each finding says which it is.
  summary: (count) => `${count} placeholders join their values into nothing, so a chip of one shows no text`,
  // Never a Wildcard: one of those showing nothing is one empty value in a pool, which is the author's business.
  check: (world) => {
    const rounds = probeRounds(world);
    return (world.placeholders ?? [])
      .filter((ph) => (ph.values ?? []).length > 0 && !placeholderIsChoice(ph))
      .flatMap((ph) => {
        const token = encodePlaceholderToken({ id: ph.id, mode: 'world', placementId: 'bench' });
        const { findings: raised, results } = probeText(token, world, rounds);
        // A cycle, a dead reference and an over-deep walk all empty the join as well, and each already has
        // a rule saying so in the terms the author can act on.
        if (raised.some((f) => f.kind === 'cycle' || f.kind === 'dangling' || f.kind === 'depth')) return [];
        if (results.some((text) => text !== '')) return [];
        const item = placeholderItem(ph.id, world);
        return [finding(
          placeholderEmptyRecord,
          placeholderKindNoun(ph) === 'Object'
            ? `${quote(item.name)} is an Object whose values join into nothing — a chip of it shows no text at all`
            : `${quote(item.name)} is a Variable whose one value reads as nothing — a chip of it shows no text at all`,
          [item],
        )];
      });
  },
};

const placeholderDuplicateSlot: Rule = {
  id: 'placeholder-duplicate-slot',
  severity: 'warning',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} placeholders carry two slots under one name, so a path naming it always takes the first`,
  check: (world) => (world.placeholders ?? []).flatMap((ph) => {
    const names = placeholderChildren(ph, world.placeholders ?? []).map((child) => child.target.name);
    const repeated = [...new Set(names.filter((name, i) => names.indexOf(name) !== i))];
    if (repeated.length === 0) return [];
    const item = placeholderItem(ph.id, world);
    return [finding(
      placeholderDuplicateSlot,
      `${quote(item.name)} carries ${listNames(repeated.map(quote))} more than once — a path naming it always takes the first, and the rest are unreachable`,
      [item],
    )];
  }),
};

// ── Ownership and sharing ─────────────────────────────────────────────────────────────────────────────────
//
// Three conditions the app's own gestures cannot produce: the store releases a stale owner reference on
// every write, and cutting a shared row prunes the override map with it. A hand-edited world is what gets
// here, and none of it is visible anywhere else — an owner reference is data, and a dead override key
// silently changes no odds at all.

/**
 * The original a shared row's override key names: the value holding the row's chip, then each placeholder
 * the key walks below it. `null` where any step is gone — a key routing through nothing weights nothing,
 * and the broken chip it routes through is already the dangling rule's finding.
 */
const sharedWeightOriginal = (
  holder: Placeholder, byId: Map<string, Placeholder>, key: string,
): Placeholder | null => {
  const [valueId, ...under] = key.split(SHARED_PATH_SEP);
  const value = (holder.values ?? []).find((v) => v.id === valueId);
  const lone = value && lonePlaceholderToken(value.text);
  let at = lone ? byId.get(decodePlaceholderToken(lone)?.id ?? '') : undefined;
  for (const id of under) {
    if (!at || !holdsAsChip(at, id)) return null;
    at = byId.get(id);
  }
  return at ?? null;
};

/** Each of a holder's overrides that weights values its original no longer carries — the twin of
 *  {@link deadWeightKeys} for a shared row, whose weights live on the holder rather than on the pool. */
const deadSharedWeights = (
  holder: Placeholder, byId: Map<string, Placeholder>,
): Array<{ key: string; original: Placeholder; dead: string[] }> =>
  Object.entries(holder.sharedWeights ?? {}).flatMap(([key, map]) => {
    const original = sharedWeightOriginal(holder, byId, key);
    if (!original) return [];
    const ids = new Set((original.values ?? []).map((v) => v.id));
    const dead = Object.keys(map).filter((id) => !ids.has(id));
    return dead.length ? [{ key, original, dead }] : [];
  });

const placeholdersById = (world: RuleWorld) =>
  new Map((world.placeholders ?? []).map((ph) => [ph.id, ph]));

const placeholderSharedWeightUnknownValue: Rule = {
  id: 'placeholder-shared-weight-unknown-value',
  severity: 'warning',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} shared rows weight values their original no longer carries`,
  check: (world) => {
    const byId = placeholdersById(world);
    return (world.placeholders ?? []).flatMap((ph) => deadSharedWeights(ph, byId).map(({ original, dead }) => {
      const item = placeholderItem(ph.id, world);
      const from = quote(placeholderItem(original.id, world).name);
      // Dead keys are value ids, which say nothing to an author, so the count carries the finding.
      return finding(
        placeholderSharedWeightUnknownValue,
        dead.length === 1
          ? `${quote(item.name)} weights a value ${from} no longer carries — that weight applies to nothing`
          : `${quote(item.name)} weights ${dead.length} values ${from} no longer carries — those weights apply to nothing`,
        [item],
      );
    }));
  },
  fix: (world) => {
    const byId = placeholdersById(world);
    return withSlice(world, 'placeholders', mapChanged(world.placeholders ?? [], (ph) => {
      const dead = deadSharedWeights(ph, byId);
      if (dead.length === 0) return ph;
      const drop = new Map(dead.map((d) => [d.key, new Set(d.dead)]));
      const kept = Object.entries(ph.sharedWeights ?? {}).flatMap(([key, map]) => {
        const gone = drop.get(key);
        if (!gone) return [[key, map] as const];
        const live = Object.entries(map).filter(([id]) => !gone.has(id));
        return live.length ? [[key, Object.fromEntries(live)] as const] : [];
      });
      // An override the repair empties goes entirely — absent already means the original's own odds.
      if (kept.length === 0) {
        const { sharedWeights: _dead, ...rest } = ph;
        return rest;
      }
      return { ...ph, sharedWeights: Object.fromEntries(kept) };
    }));
  },
};

/** Every placeholder whose owner reference points at nothing that can hold it, split by which half is
 *  wrong: the owner is not in the world at all, or it is and no longer holds the placeholder as a value. */
const staleOwners = (world: RuleWorld, kind: 'orphan' | 'dropped'): Placeholder[] => {
  const byId = placeholdersById(world);
  return (world.placeholders ?? []).filter((ph) => {
    if (ph.ownerId === undefined) return false;
    const owner = byId.get(ph.ownerId);
    return kind === 'orphan' ? !owner : !!owner && !holdsAsChip(owner, ph.id);
  });
};

/** Clear the owner reference on exactly the placeholders the calling rule flagged — never on the other
 *  rule's, so a Fix button repairs only the rows its own finding named. */
const releaseOwners = (world: RuleWorld, kind: 'orphan' | 'dropped'): RuleWorld => {
  const stale = new Set(staleOwners(world, kind).map((ph) => ph.id));
  return withSlice(world, 'placeholders', mapChanged(world.placeholders ?? [], (ph) => {
    if (!stale.has(ph.id)) return ph;
    const { ownerId: _gone, ...rest } = ph;
    return rest;
  }));
};

const placeholderOwnerOrphan: Rule = {
  id: 'placeholder-owner-orphan',
  severity: 'warning',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} placeholders belong to a placeholder that doesn’t exist`,
  check: (world) => staleOwners(world, 'orphan').map((ph) => {
    const item = placeholderItem(ph.id, world);
    return finding(
      placeholderOwnerOrphan,
      `${quote(item.name)} belongs to a placeholder that no longer exists, so it sits at the top level instead`,
      [item],
    );
  }),
  // Dropping the reference states what the tree already draws; whose it should be instead is the author's
  // call, made by dragging it there.
  fix: (world) => releaseOwners(world, 'orphan'),
};

const placeholderOwnerDropped: Rule = {
  id: 'placeholder-owner-dropped',
  severity: 'warning',
  section: 'placeholders',
  advanced: true,
  summary: (count) => `${count} owned placeholders are no longer held by the placeholder they belong to`,
  check: (world) => staleOwners(world, 'dropped').map((ph) => {
    const item = placeholderItem(ph.id, world);
    const owner = quote(placeholderItem(ph.ownerId ?? '', world).name);
    return finding(
      placeholderOwnerDropped,
      `${quote(item.name)} says it belongs to ${owner}, which no longer holds it — so it sits at the top level instead`,
      [item],
    );
  }),
  fix: (world) => releaseOwners(world, 'dropped'),
};

// ── Dictionary authoring, continued ───────────────────────────────────────────────────────────────────────

const dictionaryKeywordSubstring: Rule = {
  id: 'dictionary-keyword-substring',
  severity: 'warning',
  section: 'dictionary',
  matching: true,
  summary: (count) =>
    `${count} dictionary keywords are substrings of another entry’s keyword with whole-word matching off, so text meant for one fires both`,
  check: (world) => {
    const entries = allEntries(world);
    return entries.flatMap((entry) => {
      if (entry.useRegex || entry.matchWholeWords) return [];
      // Folding mirrors the matcher's own flags: this entry matches case-insensitively unless it says otherwise.
      const fold = (text: string) => (entry.caseSensitive ? text.trim() : text.trim().toLowerCase());
      return primaryKeys(entry).flatMap((keyword) => {
        const needle = fold(keyword);
        if (!needle) return [];
        return entries
          .filter((other) => other !== entry && !other.useRegex)
          .flatMap((other) => {
            const hit = primaryKeys(other).find((k) => {
              const hay = fold(k);
              return hay.length > needle.length && hay.includes(needle);
            });
            if (!hit) return [];
            const item = entryItem(entry, world);
            const otherItem = entryItem(other, world);
            return [finding(
              dictionaryKeywordSubstring,
              `${quote(item.name)}’s keyword ${quote(keyword)} is a substring of ${quote(hit)} on ${quote(otherItem.name)} — with whole-word matching off, text meant for one fires both`,
              [item, otherItem],
            )];
          });
      });
    });
  },
};

/** Deliberately not in the matching subset: the tracer already grays a muted book and its entries with the
 *  reason on the row, and the rule would say it a second time in the same place. */
const dictionaryDisabled: Rule = {
  id: 'dictionary-disabled',
  severity: 'info',
  section: 'dictionary',
  advanced: true,
  summary: (count) => `${count} dictionary books or entries are disabled`,
  check: (world) => (world.dictionaries ?? []).flatMap((bookRecord) => {
    if (bookRecord.enabled === false) {
      const item = namedItem(bookRecord.id, bookRecord.name, world);
      // The book is the broader diagnosis, so its entries' own toggles aren't repeated under it.
      return [finding(
        dictionaryDisabled,
        `The book ${quote(item.name)} is disabled — none of its entries can fire`,
        [item],
      )];
    }
    return (bookRecord.entries ?? [])
      .filter((entry) => entry.enabled === false)
      .map((entry) => {
        const item = entryItem(entry, world);
        return finding(dictionaryDisabled, `${quote(item.name)} is disabled and can’t fire`, [item]);
      });
  }),
};

// ── The world itself ──────────────────────────────────────────────────────────────────────────────────────

/** The world as a finding names it — for rules whose subject has no list row of its own. */
const worldItem = (world: RuleWorld): FindingItem => ({
  id: 'overview',
  name: describePlaceholders(world.worldOverview?.name ?? '', world.placeholders).trim() || 'This World',
});

const worldEmptySystemPrompt: Rule = {
  id: 'world-empty-system-prompt',
  severity: 'warning',
  section: 'overview',
  summary: () => 'The world’s system prompt is empty',
  check: (world) => world.worldOverview?.systemPrompt?.trim() ? [] : [finding(
    worldEmptySystemPrompt,
    'The system prompt is empty — the AI is told nothing about how to run this world',
    [worldItem(world)],
  )],
};

const worldNoReadme: Rule = {
  id: 'world-no-readme',
  severity: 'info',
  section: 'overview',
  summary: () => 'The world has no readme',
  // An introduction readme counts: the two share one show-on-enter toggle, so either one greets the player.
  check: (world) => world.worldOverview?.readme?.trim() || world.worldOverview?.introReadme?.trim() ? [] : [finding(
    worldNoReadme,
    'The world has no readme — a player entering it gets no introduction',
    [worldItem(world)],
  )],
};

/** Every embedded image with its display budget — the same slots the Optimize Images action walks. Only the
 *  byte budget is checked: measuring pixels needs a decode the live pass can't afford, so anything this
 *  flags, that action also flags — never the reverse. */
const embeddedImageSlots = (world: RuleWorld): Array<{ item: FindingItem; url: string; cap: ImageCap }> => [
  ...(world.worldOverview?.thumbnail
    ? [{ item: worldItem(world), url: world.worldOverview.thumbnail, cap: IMAGE_CAPS.thumbnail }]
    : []),
  ...(world.entities ?? []).flatMap((e) => entityImages(e).map((url) => ({
    item: { ...asItem(e, world), section: 'entities' as const }, url, cap: IMAGE_CAPS.entity,
  }))),
  ...(world.locations ?? []).flatMap((l) => (l.backgroundImage
    ? [{ item: namedItem(l.id, l.name, world, 'locations'), url: l.backgroundImage, cap: IMAGE_CAPS.background }]
    : [])),
];

const worldOversizedImages: Rule = {
  id: 'world-oversized-images',
  severity: 'info',
  section: 'overview',
  summary: (count) => `${count} embedded images are over their size budget — Optimize Images can shrink them`,
  check: (world) => embeddedImageSlots(world)
    // A linked image contributes no bytes to the world, so no budget applies.
    .filter(({ url, cap }) => !isRemoteImage(url) && dataUrlBytes(url) > cap.maxBytes)
    .map(({ item, url, cap }) => finding(
      worldOversizedImages,
      `${quote(item.name)}’s image is ${formatBytes(dataUrlBytes(url))}, over its ${formatBytes(cap.maxBytes)} budget — Optimize Images can shrink it`,
      [item],
    )),
};

/** The id of the one rule whose repair can't be a pure `fix` — named here so the Bench hook that fulfills
 *  it and the row that offers it agree on which rule that is. */
export const IMAGE_WEBP_RULE_ID = 'image-not-webp';

const imageNotWebp: Rule = {
  id: IMAGE_WEBP_RULE_ID,
  severity: 'info',
  section: 'overview',
  // The repair decodes and re-encodes every image, which the pure pass can't do — `useTestBench` runs it.
  asyncFix: true,
  summary: (count) => `${count} embedded images would be smaller as lossless WebP`,
  check: (world) => embeddedImageSlots(world)
    .filter(({ url }) => isConvertibleImage(url))
    .map(({ item, url }) => finding(
      imageNotWebp,
      `${quote(item.name)}’s image is ${imageFormatLabel(dataUrlRealMime(url))}`
      + ' — converting it to lossless WebP would shrink it with no quality loss',
      [item],
    )),
};

/** True when this image's stored label claims a different format than its bytes are. */
const isMislabeledImage = (url: string): boolean => {
  const real = sniffDataUrlMime(url);
  return !!real && real !== dataUrlMime(url);
};

const imageMislabeled: Rule = {
  id: 'image-mislabeled',
  severity: 'info',
  section: 'overview',
  summary: (count) => `${count} embedded images are labeled as a format their bytes are not`,
  check: (world) => embeddedImageSlots(world)
    .filter(({ url }) => isMislabeledImage(url))
    .map(({ item, url }) => finding(
      imageMislabeled,
      `${quote(item.name)}’s image is labeled ${imageFormatLabel(dataUrlMime(url))} but its bytes are `
      + `${imageFormatLabel(sniffDataUrlMime(url))} — Fix corrects the label`,
      [item],
    )),
  // Format decisions everywhere already read the bytes, so the label is corrected, never trusted.
  fix: (world) => {
    const thumb = world.worldOverview?.thumbnail;
    const nextThumb = thumb ? relabelDataUrl(thumb) : thumb;
    let out = nextThumb === thumb ? world
      : { ...world, worldOverview: { ...world.worldOverview, thumbnail: nextThumb } };
    out = withSlice(out, 'entities', mapChanged(world.entities ?? [], (entity) => {
      const images = entityImages(entity);
      const next = mapChanged(images, relabelDataUrl);
      return next === images ? entity : { ...entity, images: next };
    }));
    out = withSlice(out, 'locations', mapChanged(world.locations ?? [], (location) => {
      const next = location.backgroundImage ? relabelDataUrl(location.backgroundImage) : location.backgroundImage;
      return next === location.backgroundImage ? location : { ...location, backgroundImage: next };
    }));
    return out;
  },
};

/** Every rule the Bench runs, in catalog order. Display order comes from severity, not this list. */
export const RULES: readonly Rule[] = [
  aliasLeadingArticle, entityMatchCollision, aliasSelfDuplicate,
  entityLocationOrphan, traitToggleMissingStat, traitPinInvalid,
  chipUnknownPlaceholder, chipNeverScanned, placeholderUnused, placeholderPinnedUnused, statCodeUnknownStat,
  entrySecondaryWithoutPrimary, entryInert, entryRegexInvalid,
  noStartingLocation, legacyStartLocation, entityNowhere, statDisabledForever,
  statStartingOutOfRange, statStartNoDescriptor, statDescriptorDuplicateThreshold, statDescriptorOutOfRange,
  statDescriptorCoverageGap, statPercentageBounds,
  statCodeNeverTicks, statTraitDeltaClamped, statCodeOverridesTrait, statAiLockFrozen,
  locationParentOrphan, connectionEndpointOrphan, statUpdateUnknownStat,
  aliasLowercaseNoTwin, entityNameInWildcardPool,
  entityMissingPlayerDescription, entityMissingAiDescription, entityMissingBothDescriptions,
  entityLongDescriptionNoSummary, aiSummaryHidesDescription, locationNoEntities,
  traitGroupMultipleDefaults, traitGroupTooSmall,
  placeholderWeightUnknownValue, wildcardSingleValue,
  placeholderSlotMiss, placeholderDanglingReference, placeholderReferenceCycle, placeholderEmptyRecord,
  placeholderDuplicateSlot,
  placeholderSharedWeightUnknownValue, placeholderOwnerOrphan, placeholderOwnerDropped,
  dictionaryKeywordSubstring, dictionaryDisabled,
  worldEmptySystemPrompt, worldNoReadme, worldOversizedImages, imageNotWebp, imageMislabeled,
];

/**
 * The stat-code execution check's row. It is a head without a `check` because it can't run in the live pass:
 * every stat costs a sandbox VM, and the badge has to stay instant. `lib/testBench/statCodeCheck` raises its
 * findings from the explicit action; they group and sort here like any other row.
 */
export const STAT_CODE_EXECUTION: RuleHead = {
  id: 'stat-code-execution',
  severity: 'error',
  section: 'stats',
  advanced: true,
  summary: (count) => `${count} stats’ code fails when it actually runs`,
};

/** Everything that can put a row in the Issues list — the live rules plus the on-demand check. */
const RULE_HEADS: readonly RuleHead[] = [...RULES, STAT_CODE_EXECUTION];

/** The one lookup from a finding's rule id back to what raised it. */
const HEAD_BY_ID = new Map(RULE_HEADS.map((rule) => [rule.id, rule]));

/**
 * The matching-related rules — the subset Triggers surfaces inline. Derived from the same array Issues
 * runs, so a rule cannot exist on one surface and not the other: a warning shown in the tracer is the
 * Issues row, and its Fix is the Issues fix.
 *
 * A broken regex pattern is deliberately not here: the tracer already flags it on the entry from the
 * matcher's own compilation, and the rule would say it a second time on the same row.
 */
export const MATCHING_RULES: readonly Rule[] = RULES.filter((rule) => rule.matching);

/** The rules Simple mode folds away, execution head included — every row the Issues list can show is
 *  classified, so the fold can never be decided by whether someone remembered to mark a rule. */
const ADVANCED_RULE_IDS = new Set(RULE_HEADS.filter((rule) => rule.advanced).map((rule) => rule.id));

/** Whether acting on this rule's findings needs a field Simple mode hides. An id no rule owns reads as
 *  Simple-visible: a row nothing can classify is better shown than silently folded away. */
export function isAdvancedRule(ruleId: string): boolean {
  return ADVANCED_RULE_IDS.has(ruleId);
}

/** Every finding the world raises. Pure — safe to run on each debounced world change. */
export function runRules(world: RuleWorld): Finding[] {
  return RULES.flatMap((rule) => rule.check(world));
}

/** The matching-related findings among `findings` — the tracer's filter over a pass that already ran, so
 *  the rules are never run twice for the two surfaces. */
export function selectMatchingFindings<F extends Finding>(findings: F[]): F[] {
  const matching = new Set(MATCHING_RULES.map((rule) => rule.id));
  return findings.filter((finding) => matching.has(finding.ruleId));
}

/** Whether the rule behind a finding carries a repair — what puts a Fix button on a row, wherever the row is.
 *  Either kind counts: a pure `fix` the pass applies, or the async one the Bench runs. */
export function isRuleFixable(ruleId: string): boolean {
  const head = HEAD_BY_ID.get(ruleId);
  return !!head?.fix || !!head?.asyncFix;
}

/** `world` with `ruleId`'s fix applied — the same world back when that rule carries none, or has nothing
 *  left to repair. */
export function applyRuleFix(world: RuleWorld, ruleId: string): RuleWorld {
  return HEAD_BY_ID.get(ruleId)?.fix?.(world) ?? world;
}

/** A rule's findings collapsed into the single row the Issues list shows for them. */
export interface FindingGroup {
  ruleId: string;
  severity: Severity;
  section: FindingSection;
  /** The row's line: the lone finding's own wording, or the rule's count-carrying summary. */
  headline: string;
  /** Whether the rule behind the row carries a repair — what puts the Fix button on it, pure or async. */
  fixable: boolean;
  /** How many of the row's findings the author has not been shown yet. Zero when newness isn't being tracked. */
  newCount: number;
  /** Every item the group's findings name, each once, in first-seen order. */
  items: FindingItem[];
  findings: Finding[];
}

/**
 * Collapse findings per rule so fourteen bad aliases read as one problem, and order the rows by severity.
 * Within a severity, rows carrying something new come first; the rest keep the order they fired in.
 *
 * `isNew` is how the caller reports newness — the rules themselves know nothing about what the author has
 * already been shown.
 */
export function groupFindings<F extends Finding>(findings: F[], isNew?: (finding: F) => boolean): FindingGroup[] {
  const byRule = new Map<string, F[]>();
  for (const finding of findings) {
    const bucket = byRule.get(finding.ruleId);
    if (bucket) bucket.push(finding);
    else byRule.set(finding.ruleId, [finding]);
  }
  const groups = [...byRule.entries()].map(([ruleId, ruleFindings]) => {
    const rule = HEAD_BY_ID.get(ruleId);
    const items: FindingItem[] = [];
    const seen = new Set<string>();
    for (const item of ruleFindings.flatMap((f) => f.items)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    return {
      ruleId,
      severity: ruleFindings[0].severity,
      section: ruleFindings[0].section,
      headline: ruleFindings.length === 1 || !rule
        ? ruleFindings[0].message
        : rule.summary(ruleFindings.length),
      fixable: isRuleFixable(ruleId),
      newCount: isNew ? ruleFindings.filter(isNew).length : 0,
      items,
      findings: ruleFindings,
    };
  });
  return groups.sort((a, b) =>
    SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
    || Number(b.newCount > 0) - Number(a.newCount > 0));
}
