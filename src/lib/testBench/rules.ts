/**
 * The Test Bench's rule engine: one pure pass over an authored world producing the findings the Issues
 * instrument lists. A rule is data — id, severity, owning editor section, and a `check` — so the same set
 * can be run whole (Issues) or filtered to a subset (Triggers) without a second implementation.
 *
 * Everything here is pure: no React, no storage, no world mutation. Rules diagnose; they never rewrite.
 */
import { describePlaceholders } from '@/lib/placeholders';
import { matchKey } from '@/lib/entityMatch';
import type { Entity, World } from '@/types';

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

/** Every rule the Bench runs, in catalog order. Display order comes from severity, not this list. */
export const RULES: readonly Rule[] = [aliasLeadingArticle, entityMatchCollision, aliasSelfDuplicate];

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
