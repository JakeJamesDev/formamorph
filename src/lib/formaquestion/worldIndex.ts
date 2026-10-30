/**
 * The World Index: every authored part of the open world as sections in the Docs Index shape, one page per
 * item, so the help search ranks them as it ranks guide sections. Placeholders read as their authored chips.
 */
import { builtinLabel } from '@/lib/builtinPlaceholders';
import { createDocsIndex, type DocSection, type DocsIndex } from '@/lib/docs/docsIndex';
import { WHEN_EMPTY_LABEL, stateWord, whenEmptyOf } from '@/lib/items';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { decodePlaceholderToken, parsePlaceholderText } from '@/lib/placeholders';
import type { DictionaryEntry, Item, Placeholder, Script, Stat, Tool, Trait, World } from '@/types';
import { sourceKey, type WorldItemKind, type WorldSource } from './helpWorldSource';

/** The world slices the index reads: an editor's live world. */
export type WorldIndexInput = Pick<World, 'worldOverview' | 'stats' | 'locations' | 'entities' | 'traits' | 'dictionaries'>
  & Partial<Pick<World, 'scripts' | 'tools' | 'items' | 'placeholders' | 'connections'>>;

export interface WorldIndex {
  /** The world's sections, searched like the guide's. */
  docs: DocsIndex;
  /** The item a section of `docs` comes from. */
  sourceOf(section: Pick<DocSection, 'page'>): WorldSource | undefined;
  /** One pick-list line per item, with that item's sections. */
  pickList(): { lines: string[]; sections: DocSection[][] };
  /** Every section of the item's page, in page order; empty when the index has no such item. */
  sectionsOf(source: WorldSource): DocSection[];
}

/** The type name each kind reads as in a pick line and a source link. */
export const WORLD_KIND_NAMES: Record<WorldItemKind, string> = {
  entity: 'Entity', location: 'Location', item: 'Item', trait: 'Trait', stat: 'Stat', script: 'Script', tool: 'Tool', dictionary: 'Dictionary Entry', prompt: 'World Prompt',
};

/** The world prompts, by source id: the AI-Facing Description, then the overrides. */
const PROMPT_NAMES = { systemPrompt: 'AI-Facing Description', narration: 'Narration Prompt', choices: 'Choices Prompt', statUpdates: 'Stat Updates Prompt' } as const;

/** One item's page of a World Index. */
export interface WorldPage {
  source: WorldSource;
  /** The owner names above the item in its pick line. */
  trail: string[];
  markdown: string;
}

/** Text with each chip as the author sees it: `{Name}`, never a roll. */
function chipText(text: string, placeholders: readonly Placeholder[]): string {
  if (!text.includes('{{')) return text;
  return parsePlaceholderText(text).map((segment) => {
    if (segment.type === 'text') return segment.value;
    const token = decodePlaceholderToken(segment.token);
    const name = token ? token.label || placeholders.find((placeholder) => placeholder.id === token.id)?.name : builtinLabel(segment.token);
    return `{${name ?? '?'}}`;
  }).join('');
}

/** A code fence longer than any backtick run in the code, so the code never closes it. */
function fenced(code: string): string {
  const longest = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}js\n${code}\n${fence}`;
}

/** Builds the markdown of one item from its lines; blank and missing lines drop out. */
export const lines = (...parts: (string | false | undefined | null)[]): string => parts.filter((part): part is string => !!part && part.trim() !== '').join('\n\n');

/** A dictionary entry's display name: its name, else its first keyword. */
export const entryName = (entry: DictionaryEntry): string => entry.name || entry.key[0] || 'Entry';

/** A labeled field, or nothing when the value is blank. */
const field = (label: string, value: string | undefined): string | undefined => (value?.trim() ? `**${label}:** ${value.trim()}` : undefined);

/** The facts line under a heading: the parts that hold a value, joined. */
const facts = (...parts: (string | false | undefined)[]): string => parts.filter(Boolean).join(' · ');

function scriptsBlock(scripts: readonly Script[] | undefined, text: (value: string) => string): string | undefined {
  if (!scripts?.length) return undefined;
  return scripts.map((script) => `**Script${script.name?.trim() ? ` ${script.name.trim()}` : ''} (${script.timing}):**\n${fenced(text(script.code))}`).join('\n\n');
}

export function buildWorldIndex(world: WorldIndexInput): WorldIndex {
  const placeholders = allPlaceholders({ ...world, placeholders: world.placeholders ?? [], items: world.items ?? [] });
  const text = (value: string | undefined) => chipText(value ?? '', placeholders);
  const statName = (id: string, own: readonly Stat[] = []) => [...own, ...world.stats].find((stat) => stat.id === id)?.name ?? id;
  const traitName = (id: string) => world.traits.find((trait) => trait.id === id)?.name ?? world.entities.flatMap((entity) => entity.traits ?? []).find((trait) => trait.id === id)?.name ?? id;
  const locationName = (id: string) => world.locations.find((location) => location.id === id)?.name ?? id;
  const pages: WorldPage[] = [];
  const add = (worldKind: WorldItemKind, id: string, name: string, trail: string[], markdown: string) =>
    pages.push({ source: { kind: 'world', worldKind, id, name }, trail, markdown });

  const statPage = (stat: Stat, owner?: string) => add('stat', stat.id, stat.name, owner ? [owner] : [], lines(
    `# ${stat.name}`,
    facts(owner && `Stat of ${owner}`, `Type: ${stat.type}`, `Min: ${stat.min}`, `Max: ${stat.max}`, `Base Value: ${stat.starting ?? stat.value ?? stat.min}`,
      stat.regen ? `Regen: ${stat.regen}${stat.regenUnit ? ` per ${stat.regenUnit}` : ''}` : undefined, stat.hidden && 'Hidden', stat.enabled === false && 'Disabled'),
    field('Description', text(stat.description)),
    // Live editor state can hold a stat with no descriptors yet.
    (stat.descriptors?.length ?? 0) > 0 && `**Stat Descriptors:**\n${stat.descriptors.map((band) => `- From ${band.threshold}: ${text(band.description)}`).join('\n')}`,
    scriptsBlock(stat.scripts, text),
  ));
  // A stat named in a trait resolves among the owner's own stats first.
  const traitPage = (trait: Trait, owner?: string, own?: readonly Stat[]) => add('trait', trait.id, trait.name, owner ? [owner] : [], lines(
    `# ${trait.name}`,
    facts(owner && `Trait of ${owner}`, trait.isDefault && 'On by default', trait.playerToggle && 'Player can switch it', trait.mode === 'alwaysOn' && 'Always on', trait.mode === 'hidden' && 'Hidden'),
    field('Player Description', text(trait.playerDescription)),
    field('AI Description', text(trait.aiDescription)),
    trait.statChanges.length > 0 && `**Stat Changes:**\n${trait.statChanges.map((change) => `- ${statName(change.statId, own)}${change.type ? ` (${change.type})` : ''}: ${change.value > 0 ? '+' : ''}${change.value}`).join('\n')}`,
    scriptsBlock(trait.scripts, text),
  ));

  for (const entity of world.entities) {
    add('entity', entity.id, entity.name, [], lines(
      `# ${entity.name}`,
      facts(entity.persona && 'Persona', entity.type && `Type: ${entity.type}`, entity.pronouns && `Pronouns: ${entity.pronouns}`, entity.aliases?.length ? `Aliases: ${entity.aliases.join(', ')}` : undefined),
      field('Player Description', text(entity.playerDescription)),
      field('AI Description', text(entity.aiDescription)),
      field('AI Summary', text(entity.aiSummary)),
      entity.locations?.length ? field('Locations', entity.locations.map(locationName).join(', ')) : undefined,
      Array.isArray(entity.knownIn) ? field('Known In', entity.knownIn.map(locationName).join(', ')) : entity.knownIn === 'nowhere' && '**Known In:** nowhere',
      entity.tags?.length ? field('Tags', entity.tags.join(', ')) : undefined,
    ));
    for (const stat of entity.stats ?? []) statPage(stat, entity.name);
    for (const trait of entity.traits ?? []) traitPage(trait, entity.name, entity.stats);
  }
  for (const location of world.locations) {
    const parent = location.parentId ? locationName(location.parentId) : undefined;
    const linked = (world.connections ?? []).flatMap((connection) => {
      const other = connection.a === location.id ? connection.b : connection.b === location.id ? connection.a : undefined;
      return other ? [locationName(other)] : [];
    });
    add('location', location.id, location.name, [], lines(
      `# ${location.name}`,
      facts(location.isStarting && 'Starting Location', parent && `Inside: ${parent}`),
      field('Player Description', text(location.playerDescription ?? location.description)),
      field('AI Description', text(location.aiDescription)),
      field('AI Summary', text(location.aiSummary)),
      linked.length > 0 && field('Connections', linked.join(', ')),
    ));
  }
  // A Becomes target outside this world, such as an unmet item in the player view, goes unnamed.
  const whenEmptyText = (item: Item): string => {
    const empty = whenEmptyOf(item);
    if (empty.kind === 'changesState') return `${WHEN_EMPTY_LABEL.changesState} to ${empty.state.trim() || 'none'}`;
    if (empty.kind !== 'becomes') return WHEN_EMPTY_LABEL[empty.kind];
    const target = world.items?.find((i) => i.id === empty.itemId);
    return `${WHEN_EMPTY_LABEL.becomes} ${target?.name ?? 'another item'}`;
  };
  const stateLine = (item: Item): string | false => { const word = stateWord(item.state); return !!word && `State: ${word}`; };
  for (const item of world.items ?? []) {
    add('item', item.id, item.name, [], lines(
      `# ${item.name}`,
      facts(item.value !== undefined && `Value: ${item.value}`, item.stackable && 'Stackable', item.uses !== undefined && `Uses: ${item.uses}`, item.uses !== undefined && `When Empty: ${whenEmptyText(item)}`, stateLine(item), item.bound && 'Bound'),
      field('Player Description', text(item.playerDescription)),
      field('Unidentified Name', text(item.unidentifiedName)),
      field('Unidentified Description', text(item.unidentifiedDescription)),
      field('AI Description', text(item.aiDescription)),
      field('AI Summary', text(item.aiSummary)),
      item.statEffects.length > 0 && `**Stat Effects:**\n${item.statEffects.map((effect) => `- ${statName(effect.statId)} (${effect.facet}, ${effect.timing}): ${effect.amount > 0 ? '+' : ''}${effect.amount}`).join('\n')}`,
      item.traitEffects.length > 0 && `**Trait Effects:**\n${item.traitEffects.map((effect) => `- ${traitName(effect.traitId)} (${effect.timing})`).join('\n')}`,
      scriptsBlock(item.scripts, text),
    ));
  }
  for (const trait of world.traits) traitPage(trait);
  for (const stat of world.stats) statPage(stat);
  for (const script of world.scripts ?? []) {
    const name = script.name?.trim() || `World Script (${script.timing})`;
    add('script', script.id, name, [], lines(`# ${name}`, facts('World Script', `Timing: ${script.timing}`), fenced(text(script.code))));
  }
  for (const tool of world.tools ?? []) toolPage(tool);
  for (const book of world.dictionaries) {
    for (const entry of book.entries) {
      add('dictionary', entry.id, entryName(entry), [book.name], lines(
        `# ${entryName(entry)}`,
        facts(`Entry in ${book.name}`, entry.enabled === false && 'Off', book.enabled === false && 'Book off', entry.constant && 'Always Inject'),
        entry.key.length > 0 && field('Trigger Keywords', entry.key.join(', ')),
        entry.secondaryKeys?.length ? field('Secondary Keywords', entry.secondaryKeys.join(', ')) : undefined,
        field('Value', text(entry.value)),
      ));
    }
  }
  const overview = world.worldOverview;
  const overrides = overview.promptOverrides ?? {};
  const prompts: [keyof typeof PROMPT_NAMES, string | undefined, boolean | undefined][] = [
    ['systemPrompt', overview.systemPrompt, undefined],
    ['narration', overrides.systemPrompt, overrides.systemPromptEnabled],
    ['choices', overrides.choicesPrompt, overrides.choicesPromptEnabled],
    ['statUpdates', overrides.statUpdatesPrompt, overrides.statUpdatesPromptEnabled],
  ];
  for (const [id, value, enabled] of prompts) {
    if (!value?.trim()) continue;
    add('prompt', id, PROMPT_NAMES[id], [], lines(`# ${PROMPT_NAMES[id]}`, facts('World Prompt', enabled === false && 'Not applied'), text(value)));
  }

  function toolPage(tool: Tool) {
    const { handler } = tool;
    const run = handler.kind === 'lookup'
      ? `**Looks Up:** ${handler.source} by ${handler.param}, ${handler.returns === 'full' ? 'full text' : 'summary'}`
      : handler.kind === 'template'
        ? `**Template:**\n${fenced(text(handler.body))}`
        : `**Script (${handler.timing ?? 'call'}):**\n${fenced(text(handler.code))}`;
    add('tool', tool.id, tool.name, [], lines(
      `# ${tool.name}`,
      facts('World Tool', tool.offeredTo.length > 0 && `Offered To: ${tool.offeredTo.join(', ')}`, tool.callLimit !== undefined && `Call Limit: ${tool.callLimit}`),
      field('Description', text(tool.description)),
      tool.params.length > 0 && `**Parameters:**\n${tool.params.map((param) => `- ${param.name} (${param.type}${param.required ? ', required' : ''}): ${param.description}`).join('\n')}`,
      run,
      field('Empty Result', text(tool.emptyResult)),
    ));
  }

  return worldIndexOfPages(pages);
}

/** The World Index of `pages`, one page per item. */
export function worldIndexOfPages(pages: readonly WorldPage[]): WorldIndex {
  // The page name keys each item, so every part of a split item maps back to it.
  const byPage = new Map<string, WorldPage>();
  for (const page of pages) {
    const base = `world-${page.source.worldKind}-${encodeURIComponent(page.source.id)}`;
    let key = base;
    for (let n = 2; byPage.has(key); n++) key = `${base}-${n}`;
    byPage.set(key, page);
  }
  const pageNames = [...byPage.keys()];
  const docs = createDocsIndex({
    pages: Object.fromEntries([...byPage].map(([key, page]) => [key, page.markdown])),
    sidebar: pageNames.map((key) => `[${key}](${key})`).join('\n'),
    hubDemotion: false,
  });
  let picks: ReturnType<WorldIndex['pickList']> | undefined;
  // A split item's later parts stay out; the docs index joins them back to their first part.
  const wholeSections = (sections: readonly { id: string }[]) => docs.get(sections.filter((section) => !section.id.includes('-part-')).map((section) => section.id));
  return {
    docs,
    sourceOf: (section) => byPage.get(section.page)?.source,
    pickList: () => (picks ??= {
      lines: pageNames.map((key) => {
        const { source, trail } = byPage.get(key)!;
        return [WORLD_KIND_NAMES[source.worldKind], ...trail, source.name].join(' › ');
      }),
      sections: docs.contents().map(({ sections }) => wholeSections(sections)),
    }),
    sectionsOf: (source) => {
      const key = pageNames.find((name) => sourceKey(byPage.get(name)!.source) === sourceKey(source));
      const page = docs.contents().find((contents) => contents.page === key);
      return page ? wholeSections(page.sections) : [];
    },
  };
}

/** The slices one index was built from, so an unchanged world reuses it. */
let last: { input: WorldIndexInput; index: WorldIndex } | undefined;

const SLICES = ['worldOverview', 'stats', 'locations', 'entities', 'traits', 'dictionaries', 'scripts', 'tools', 'items', 'placeholders', 'connections'] as const;

/** The index of `world`, rebuilt only when one of its slices changed identity. */
export function worldIndexOf(world: WorldIndexInput): WorldIndex {
  if (last && SLICES.every((slice) => last!.input[slice] === world[slice])) return last.index;
  const index = buildWorldIndex(world);
  last = { input: world, index };
  return index;
}
