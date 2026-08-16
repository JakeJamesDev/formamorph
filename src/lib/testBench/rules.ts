/**
 * The Test Bench's rule engine: one pure pass over an authored world producing the findings the Issues
 * instrument lists. A rule is data — id, severity, owning editor section, and a `check` — so the same set
 * can be run whole (Issues) or filtered to a subset (Triggers) without a second implementation.
 *
 * Everything here is pure: no React, no storage, no world mutation. Rules diagnose; they never rewrite.
 */
import { collectPlaceholderPlacements, describePlaceholders, hasPlaceholders } from '@/lib/placeholders';
import { matchKey } from '@/lib/entityMatch';
import type { DictionaryEntry, Entity, GameLocation, World } from '@/types';

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
}

const quote = (text: string) => `“${text}”`;

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

const legacyStartLocation: Rule = {
  id: 'legacy-start-location',
  severity: 'warning',
  section: 'locations',
  summary: (count) => `${count} locations carry the legacy isStartLocation field, which the game no longer reads`,
  check: (world) => world.locations.filter(hasLegacyStart).map((location) => {
    const item = namedItem(location.id, location.name, world);
    // Only a truthy value signals start intent; a false-valued leftover just needs deleting.
    const advice = (location as GameLocation & { isStartLocation?: unknown }).isStartLocation
      ? 'flag it as a starting location instead'
      : 'delete the field';
    return finding(
      legacyStartLocation,
      `${quote(item.name)} carries the legacy isStartLocation field, which the game no longer reads — ${advice}`,
      [item],
    );
  }),
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
  chipUnknownPlaceholder, chipNeverScanned, statCodeUnknownStat,
  entrySecondaryWithoutPrimary, entryInert, entryRegexInvalid,
  noStartingLocation, legacyStartLocation, entityNowhere, statDisabledForever,
];

/** Every finding the world raises. Pure — safe to run on each debounced world change. */
export function runRules(world: RuleWorld): Finding[] {
  return RULES.flatMap((rule) => rule.check(world));
}

/** A rule's findings collapsed into the single row the Issues list shows for them. */
export interface FindingGroup {
  ruleId: string;
  severity: Severity;
  section: FindingSection;
  /** The row's line: the lone finding's own wording, or the rule's count-carrying summary. */
  headline: string;
  /** Every item the group's findings name, each once, in first-seen order. */
  items: FindingItem[];
  findings: Finding[];
}

/**
 * Collapse findings per rule so fourteen bad aliases read as one problem, and order the rows by severity.
 * Within a severity, rules keep the order they fired in.
 */
export function groupFindings(findings: Finding[]): FindingGroup[] {
  const byRule = new Map<string, Finding[]>();
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
      items,
      findings: ruleFindings,
    };
  });
  return groups.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}
