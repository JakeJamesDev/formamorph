/**
 * The Test Bench's rule engine: one pure pass over an authored world producing the findings the Issues
 * instrument lists. A rule is data — id, severity, owning editor section, and a `check` — so the same set
 * can be run whole (Issues) or filtered to a subset (Triggers) without a second implementation.
 *
 * Everything here is pure: no React, no storage, no world mutation. A rule diagnoses; where the repair is
 * unambiguous it also carries a `fix`, which returns a new world rather than editing the one it was given.
 */
import { collectPlaceholderPlacements, describePlaceholders, hasPlaceholders } from '@/lib/placeholders';
import { matchKey } from '@/lib/entityMatch';
import type { DictionaryEntry, Entity, GameLocation, Placeholder, World } from '@/types';

/** The world a rule reads — the editor's live payload, which carries no record id or version. */
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

export interface Rule {
  id: string;
  severity: Severity;
  section: FindingSection;
  check(world: RuleWorld): Finding[];
  /** Headline for the collapsed row when this rule fired `count` times. */
  summary(count: number): string;
  /**
   * The world with every unambiguous instance of this rule repaired — present only where the repair
   * needs no authorial judgment. It re-derives what to repair from the world it is handed, so applying
   * it twice equals applying it once, and it returns the world untouched when there is nothing to do.
   */
  fix?(world: RuleWorld): RuleWorld;
}

const quote = (text: string) => `“${text}”`;

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

/** `world` carrying `value` for `key`, or `world` itself when that slice is the one it already had. */
const withSlice = <K extends keyof RuleWorld>(world: RuleWorld, key: K, value: RuleWorld[K]): RuleWorld =>
  value === world[key] ? world : { ...world, [key]: value };

/** "a, b and c" — how a finding names the handful of items it covers. */
const listNames = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** An entity as a finding names it: chips resolved, so the row reads like the editor's own list. */
const asItem = (entity: Entity, world: RuleWorld): FindingItem => ({
  id: entity.id,
  name: describePlaceholders(entity.name, world.placeholders) || 'Untitled',
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
  summary: (count) =>
    `${count} aliases begin with an article — alias matching is case-sensitive, so they miss wherever the sentence capitalizes them differently`,
  check: (world) => world.entities.flatMap((entity) =>
    aliasesOf(entity, world)
      .filter((alias) => LEADING_ARTICLE.test(alias))
      .map((alias) => ({
        ruleId: aliasLeadingArticle.id,
        severity: aliasLeadingArticle.severity,
        section: aliasLeadingArticle.section,
        message: `Alias ${quote(alias)} begins with an article — alias matching is case-sensitive, so it misses wherever the sentence capitalizes it differently`,
        items: [asItem(entity, world)],
      })),
  ),
  fix: (world) => withSlice(world, 'entities', mapChanged(world.entities, (entity) => {
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
  summary: (count) =>
    `${count} written forms match more than one entity — a mention of either detects both`,
  check: (world) => {
    // One bucket per piece of text the matcher can see, holding every entity that lays claim to it.
    const claims = new Map<string, { text: string; entities: Entity[] }>();
    for (const entity of world.entities) {
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
        return {
          ruleId: entityMatchCollision.id,
          severity: entityMatchCollision.severity,
          section: entityMatchCollision.section,
          message: `${quote(bucket.text)} matches ${listNames(items.map((i) => i.name))} — a mention of ${items.length > 2 ? 'any one detects them all' : 'either detects both'}`,
          items,
        };
      });
  },
};

const aliasSelfDuplicate: Rule = {
  id: 'alias-self-duplicate',
  severity: 'info',
  section: 'entities',
  summary: (count) => `${count} aliases repeat their own entity’s name, which already matches on its own`,
  check: (world) => world.entities.flatMap((entity) => {
    const nameKey = matchKey(describePlaceholders(entity.name ?? '', world.placeholders));
    if (!nameKey) return [];
    return aliasesOf(entity, world)
      .filter((alias) => matchKey(alias) === nameKey)
      .map((alias) => ({
        ruleId: aliasSelfDuplicate.id,
        severity: aliasSelfDuplicate.severity,
        section: aliasSelfDuplicate.section,
        message: `Alias ${quote(alias)} repeats its own entity’s name, which already matches on its own`,
        items: [asItem(entity, world)],
      }));
  }),
  fix: (world) => withSlice(world, 'entities', mapChanged(world.entities, (entity) => {
    const nameKey = matchKey(describePlaceholders(entity.name ?? '', world.placeholders));
    const aliases = entity.aliases;
    if (!nameKey || !aliases?.length) return entity;
    const next = aliases.filter(
      (alias) => matchKey(describePlaceholders(alias ?? '', world.placeholders).trim()) !== nameKey,
    );
    return next.length === aliases.length ? entity : { ...entity, aliases: next };
  })),
};

/** A finding for `rule` — the boilerplate trio copied from the rule itself. */
const finding = (rule: Rule, message: string, items: FindingItem[]): Finding => ({
  ruleId: rule.id, severity: rule.severity, section: rule.section, message, items,
});

/** A non-entity item, chips resolved like the editor's own lists resolve them. */
const namedItem = (id: string, name: string | undefined, world: RuleWorld, section?: FindingSection): FindingItem => ({
  id,
  name: describePlaceholders(name ?? '', world.placeholders).trim() || 'Untitled',
  ...(section ? { section } : {}),
});

/** An entry as its list labels it: the free name, else the first keyword. */
const entryItem = (entry: DictionaryEntry, world: RuleWorld): FindingItem =>
  namedItem(entry.id, entry.name || entry.key?.[0], world);

/** Every entry in every book — definition checks apply whether or not a book is currently enabled. */
const allEntries = (world: RuleWorld): DictionaryEntry[] =>
  world.dictionaries.flatMap((book) => book.entries ?? []);

const primaryKeys = (entry: DictionaryEntry): string[] => (entry.key ?? []).filter(Boolean);
const secondaryKeys = (entry: DictionaryEntry): string[] => (entry.secondaryKeys ?? []).filter(Boolean);

// ── Reference integrity: everything that points at nothing ────────────────────────────────────────────────

const entityLocationOrphan: Rule = {
  id: 'entity-location-orphan',
  severity: 'error',
  section: 'entities',
  summary: (count) => `${count} entities are placed at locations that don’t exist`,
  check: (world) => {
    const known = new Set(world.locations.map((l) => l.id));
    return world.entities
      .filter((entity) => (entity.locations ?? []).some((id) => !known.has(id)))
      .map((entity) => {
        const item = asItem(entity, world);
        return finding(entityLocationOrphan, `${quote(item.name)} is placed at a location that doesn’t exist`, [item]);
      });
  },
  fix: (world) => {
    const known = new Set(world.locations.map((l) => l.id));
    return withSlice(world, 'entities', mapChanged(world.entities, (entity) => {
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
  summary: (count) => `${count} trait stat toggles point at stats that don’t exist`,
  check: (world) => {
    const known = new Set(world.stats.map((s) => s.id));
    return world.traits
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
  summary: (count) =>
    `${count} trait placeholder pins are broken — a missing placeholder, or a value it doesn’t offer`,
  check: (world) => {
    const byId = new Map((world.placeholders ?? []).map((p) => [p.id, p]));
    return world.traits.flatMap((trait) =>
      (trait.placeholderPins ?? []).flatMap((pin) => {
        const item = namedItem(trait.id, trait.name, world);
        const ph = byId.get(pin.placeholderId);
        if (!ph) {
          return [finding(traitPinInvalid, `${quote(item.name)} pins a placeholder that doesn’t exist`, [item])];
        }
        if (!ph.values.includes(pin.value)) {
          return [finding(
            traitPinInvalid,
            `${quote(item.name)} pins ${quote(ph.name)} to ${quote(pin.value)}, which isn’t one of its values`,
            [item],
          )];
        }
        return [];
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
    item: { id: 'overview', name: world.worldOverview.name || 'Overview', section: 'overview' },
    texts: [world.worldOverview.systemPrompt, world.worldOverview.readme, world.worldOverview.introReadme],
  },
  ...world.entities.map((e) => ({
    item: { ...asItem(e, world), section: 'entities' as const },
    texts: [e.name, ...(e.aliases ?? []), e.playerDescription, e.aiDescription, e.aiSummary, e.imageTags],
  })),
  ...world.locations.map((l) => ({
    item: namedItem(l.id, l.name, world, 'locations'),
    texts: [l.name, l.playerDescription, l.aiDescription, l.aiSummary, l.description, l.imageTags],
  })),
  ...allEntries(world).map((entry) => ({
    item: { ...entryItem(entry, world), section: 'dictionary' as const },
    texts: [entry.name, ...(entry.key ?? []), ...(entry.secondaryKeys ?? []), entry.value],
  })),
  ...world.stats.map((s) => ({ item: namedItem(s.id, s.name, world, 'stats'), texts: [s.name] })),
  ...world.traits.map((t) => ({
    item: namedItem(t.id, t.name, world, 'traits'),
    texts: [t.name, t.playerDescription, t.aiDescription],
  })),
  ...(world.traitGroups ?? []).map((g) => ({
    item: namedItem(g.id, g.name, world, 'traits'),
    texts: [g.name, g.playerDescription, g.aiDescription],
  })),
];

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
  summary: (count) => `${count} stats carry chips in fields placeholders never resolve — they’ll read as raw text`,
  check: (world) => world.stats.flatMap((stat) => {
    const item = namedItem(stat.id, stat.name, world);
    const spots: string[] = [];
    if (stat.description && hasPlaceholders(stat.description)) spots.push('description');
    if (stat.descriptors.some((d) => d.description && hasPlaceholders(d.description))) spots.push('descriptors');
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
  world.worldOverview.description,
  ...world.stats.flatMap((s) => [s.description, ...s.descriptors.map((d) => d.description)]),
  ...world.statUpdates.map((u) => u.prompt),
];

/** The placeholders nothing in the world reaches for — no chip anywhere, and no trait pinning them. */
const unusedPlaceholders = (world: RuleWorld): Placeholder[] => {
  const used = chipIds(allChipTexts(world));
  for (const trait of world.traits) {
    for (const pin of trait.placeholderPins ?? []) used.add(pin.placeholderId);
  }
  return (world.placeholders ?? []).filter((p) => !used.has(p.id));
};

const placeholderUnused: Rule = {
  id: 'placeholder-unused',
  severity: 'info',
  section: 'placeholders',
  summary: (count) => `${count} placeholders are defined but never used`,
  check: (world) => unusedPlaceholders(world).map((placeholder) => {
    const item = namedItem(placeholder.id, placeholder.name, world);
    return finding(placeholderUnused, `${quote(item.name)} is defined but never used`, [item]);
  }),
  fix: (world) => {
    const dead = new Set(unusedPlaceholders(world).map((p) => p.id));
    if (dead.size === 0) return world;
    return withSlice(world, 'placeholders', (world.placeholders ?? []).filter((p) => !dead.has(p.id)));
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
  summary: (count) => `${count} stats’ code looks up stat names that don’t exist`,
  check: (world) => {
    // Code compares against runtime names, where chips have resolved — so both spellings are valid targets.
    const known = new Set(world.stats.flatMap((s) => [s.name, describePlaceholders(s.name ?? '', world.placeholders)]));
    return world.stats.flatMap((stat) => {
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
  check: (world) => world.locations.some((l) => l.isStarting) ? [] : [finding(
    noStartingLocation,
    'No location is flagged as a starting location — a new game picks any location at random',
    [{ id: 'locations', name: world.worldOverview.name || 'This World' }],
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
  check: (world) => world.locations.filter(hasLegacyStart).map((location) => {
    const item = namedItem(location.id, location.name, world);
    // Only a truthy value signals start intent; a false-valued leftover just needs deleting.
    const advice = legacyStartValue(location)
      ? 'flag it as a starting location instead'
      : 'delete the field';
    return finding(
      legacyStartLocation,
      `${quote(item.name)} carries the legacy isStartLocation field, which the game no longer reads — ${advice}`,
      [item],
    );
  }),
  fix: (world) => {
    // A truthy leftover is the world's only surviving record of its start intent, so deleting it outright
    // would trade this finding for a world with no starting location. The first one carries that intent
    // over to the live flag — but only when nothing already claims it, since a real flag supersedes it.
    const promoteId = world.locations.some((l) => l.isStarting)
      ? undefined
      : world.locations.find((l) => hasLegacyStart(l) && legacyStartValue(l))?.id;
    return withSlice(world, 'locations', mapChanged(world.locations, (location) => {
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
  check: (world) => world.entities
    .filter((entity) => (entity.locations ?? []).length === 0)
    .map((entity) => {
      const item = asItem(entity, world);
      return finding(entityNowhere, `${quote(item.name)} is placed in no location, so it can never appear`, [item]);
    }),
};

const statDisabledForever: Rule = {
  id: 'stat-disabled-forever',
  severity: 'warning',
  section: 'stats',
  summary: (count) => `${count} stats start disabled and no trait ever enables them`,
  check: (world) => {
    const enabledBy = new Set(world.traits.flatMap((trait) =>
      (trait.statToggles ?? []).filter((toggle) => toggle.enabled).map((toggle) => toggle.statId),
    ));
    return world.stats
      .filter((stat) => stat.enabled === false && !enabledBy.has(stat.id))
      .map((stat) => {
        const item = namedItem(stat.id, stat.name, world);
        return finding(statDisabledForever, `${quote(item.name)} starts disabled and no trait ever enables it`, [item]);
      });
  },
};

/** Every rule the Bench runs, in catalog order. Display order comes from severity, not this list. */
export const RULES: readonly Rule[] = [
  aliasLeadingArticle, entityMatchCollision, aliasSelfDuplicate,
  entityLocationOrphan, traitToggleMissingStat, traitPinInvalid,
  chipUnknownPlaceholder, chipNeverScanned, placeholderUnused, statCodeUnknownStat,
  entrySecondaryWithoutPrimary, entryInert, entryRegexInvalid,
  noStartingLocation, legacyStartLocation, entityNowhere, statDisabledForever,
];

/** Every finding the world raises. Pure — safe to run on each debounced world change. */
export function runRules(world: RuleWorld): Finding[] {
  return RULES.flatMap((rule) => rule.check(world));
}

/** `world` with `ruleId`'s fix applied — the same world back when that rule carries none, or has nothing
 *  left to repair. */
export function applyRuleFix(world: RuleWorld, ruleId: string): RuleWorld {
  return RULES.find((rule) => rule.id === ruleId)?.fix?.(world) ?? world;
}

/** A rule's findings collapsed into the single row the Issues list shows for them. */
export interface FindingGroup {
  ruleId: string;
  severity: Severity;
  section: FindingSection;
  /** The row's line: the lone finding's own wording, or the rule's count-carrying summary. */
  headline: string;
  /** Whether the rule behind the row carries a fix — what puts the Fix button on it. */
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
    const rule = RULES.find((r) => r.id === ruleId);
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
      fixable: !!rule?.fix,
      newCount: isNew ? ruleFindings.filter(isNew).length : 0,
      items,
      findings: ruleFindings,
    };
  });
  return groups.sort((a, b) =>
    SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
    || Number(b.newCount > 0) - Number(a.newCount > 0));
}
