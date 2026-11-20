// The Release Summary parser. No imports and no DOM, because the release workflow's validator loads it too.

/** A `**Title** — body` highlight. */
export interface SummaryItem {
  title: string;
  body: string;
}

/** A Major highlight: its leading emoji, the Lucide icon that emoji maps to, and its optional paired New item. */
export interface MajorItem extends SummaryItem {
  emoji: string;
  icon: string | null;
  pair: SummaryItem | null;
}

export interface ReleaseSummary {
  version: string | null;
  intro: string[];
  major: MajorItem[];
  newItems: SummaryItem[];
  fixes: string[];
}

/** What a problem is about. `unmapped-emoji` is the one error the app renders around, with a default icon. */
export type SummaryProblemCode =
  | 'new-emoji' | 'new-item-shape' | 'text-above-title' | 'title-shape' | 'title-version' | 'duplicate-section'
  | 'unknown-heading' | 'stray-text' | 'fixes-list' | 'major-item-shape' | 'major-no-emoji' | 'unmapped-emoji'
  | 'extra-pair' | 'new-item-pair' | 'no-title' | 'empty' | 'no-intro' | 'length';

export interface SummaryProblem {
  severity: 'error' | 'warning';
  code: SummaryProblemCode;
  /** The 1-based source line, when the problem sits on one. */
  line: number | null;
  message: string;
}

export interface ParsedReleaseSummary {
  summary: ReleaseSummary;
  problems: SummaryProblem[];
}

const ICON_SOURCE: Record<string, string> = {
  '⏳': 'Hourglass',
  '🗓️': 'CalendarClock',
  '🗺️': 'Map',
  '📍': 'MapPin',
  '🎨': 'Palette',
  '🧭': 'Route',
  '✨': 'Sparkles',
  '💬': 'MessageSquare',
  '🧠': 'Brain',
  '🎭': 'Drama',
  '👤': 'User',
  '👥': 'Users',
  '🎒': 'Backpack',
  '📦': 'Package',
  '💰': 'Coins',
  '⚔️': 'Swords',
  '🛡️': 'Shield',
  '🔊': 'Volume2',
  '🖼️': 'Image',
  '📱': 'Smartphone',
  '🖥️': 'Monitor',
  '🌐': 'Globe',
  '🔧': 'Wrench',
  '⚡': 'Zap',
  '📝': 'NotebookPen',
  '🔍': 'Search',
  '🧩': 'Puzzle',
  '❤️': 'Heart',
  '⭐': 'Star',
  '🚀': 'Rocket',
};

const VARIATION_SELECTOR = /\uFE0F/g;

function emojiKey(emoji: string): string {
  return emoji.replace(VARIATION_SELECTOR, '');
}

/** The emoji a Major item may start with, keyed without U+FE0F, to the Lucide icon name it shows. */
export const MAJOR_ICONS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(Object.entries(ICON_SOURCE).map(([emoji, icon]) => [emojiKey(emoji), icon])),
);

/** The Lucide icon name for a Major item's emoji, or null when the map lacks it. */
export function majorIcon(emoji: string): string | null {
  return MAJOR_ICONS[emojiKey(emoji)] ?? null;
}

/** Visible characters past which What's New scrolls at 1440×900: about 10% past the 3.7.0 seed. */
export const SUMMARY_LENGTH_WARNING = 1450;

const SECTIONS = ['Major', 'New', 'Fixes'] as const;
type SectionName = (typeof SECTIONS)[number];

const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const BULLET = /^([ \t]*)[-*+][ \t]+(.*)$/;
const LEADING_WHITESPACE = /^[ \t]*/;
const TITLE = /^Formamorph v(\S+)$/;
const ITEM = /^\*\*(.+?)\*\*[ \t]*[—–-][ \t]*(\S[\s\S]*)$/;
const LEADING_EMOJI = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*)[ \t]*/u;

interface RawLine {
  line: number;
  text: string;
}

interface RawItem extends RawLine {
  children: RawLine[];
}

type Report = (line: number | null, code: SummaryProblemCode, message: string) => void;

function isSection(text: string): text is SectionName {
  return (SECTIONS as readonly string[]).includes(text);
}

/** Indent width with a tab as four spaces, so a tab-indented bullet nests. */
function indentWidth(line: string): number {
  return (LEADING_WHITESPACE.exec(line)?.[0] ?? '').replace(/\t/g, '    ').length;
}

/** Splits a leading emoji off an item's text. */
function splitEmoji(text: string): { emoji: string | null; rest: string } {
  const match = LEADING_EMOJI.exec(text);
  return match ? { emoji: match[1], rest: text.slice(match[0].length) } : { emoji: null, rest: text };
}

function parseItem(text: string): SummaryItem | null {
  const item = ITEM.exec(text);
  return item ? { title: item[1].trim(), body: item[2].trim() } : null;
}

/** A New item, alone or as a Major item's pair. */
function newItem(raw: RawLine, error: Report, warn: Report): SummaryItem | null {
  const { emoji, rest } = splitEmoji(raw.text);
  if (emoji) warn(raw.line, 'new-emoji', `New items show no icon; the emoji ${emoji} is dropped.`);
  const item = parseItem(rest);
  if (!item) error(raw.line, 'new-item-shape', `A New item must read "**Title** — body": "${raw.text}".`);
  return item;
}

/** Visible text length, with emphasis, code and link markup removed. */
function visibleLength(text: string): number {
  const plain = text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '');
  return [...plain].length;
}

/**
 * Parses one Release Summary up to its first thematic break (`---`). Errors are what the release workflow refuses;
 * warnings are what the app renders around. `version` is the version the title must name.
 */
export function parseReleaseSummary(markdown: string, options: { version?: string } = {}): ParsedReleaseSummary {
  const problems: SummaryProblem[] = [];
  const error: Report = (line, code, message) => problems.push({ severity: 'error', code, line, message });
  const warn: Report = (line, code, message) => problems.push({ severity: 'warning', code, line, message });

  const summary: ReleaseSummary = { version: null, intro: [], major: [], newItems: [], fixes: [] };
  let titleSeen = false;
  let section: SectionName | 'intro' | 'unknown' = 'intro';
  const seenSections = new Set<SectionName>();

  let paragraph: string[] = [];
  const items: Record<'Major' | 'New', RawItem[]> = { Major: [], New: [] };
  let current: RawItem | null = null;
  let previousBlank = true;
  let fixesListWarned = false;

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    if (section === 'intro') summary.intro.push(text);
    else if (section === 'Fixes') summary.fixes.push(text);
    paragraph = [];
  };

  const lines = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNo = index + 1;
    const blank = line.trim() === '';

    if (THEMATIC_BREAK.test(line)) break;

    const heading = HEADING.exec(line);
    if (heading) {
      closeParagraph();
      current = null;
      previousBlank = true;
      const [, hashes, text] = heading;
      if (hashes.length === 1 && !titleSeen && section === 'intro') {
        titleSeen = true;
        if (summary.intro.length > 0) {
          warn(lineNo, 'text-above-title', 'Text above the title is dropped.');
          summary.intro = [];
        }
        const title = TITLE.exec(text);
        if (!title) {
          error(lineNo, 'title-shape', `The title must read "# Formamorph v<version>", not "${line.trim()}".`);
        } else {
          summary.version = title[1];
          if (options.version !== undefined && title[1] !== options.version) {
            error(lineNo, 'title-version', `The title names v${title[1]}, but this summary is for v${options.version}.`);
          }
        }
      } else if (hashes.length === 2 && isSection(text)) {
        if (seenSections.has(text)) warn(lineNo, 'duplicate-section', `"## ${text}" appears twice; its items are merged.`);
        seenSections.add(text);
        section = text;
      } else {
        error(lineNo, 'unknown-heading', `Unknown heading "${line.trim()}". Use only "## Major", "## New" and "## Fixes".`);
        section = 'unknown';
      }
      continue;
    }

    if (blank) {
      closeParagraph();
      previousBlank = true;
      continue;
    }

    if (section === 'Major' || section === 'New') {
      const bullet = BULLET.exec(line);
      if (bullet && indentWidth(line) <= 1) {
        current = { line: lineNo, text: bullet[2].trim(), children: [] };
        items[section].push(current);
      } else if (bullet && current) {
        current.children.push({ line: lineNo, text: bullet[2].trim() });
      } else if (current && (!previousBlank || indentWidth(line) >= 2)) {
        const target = current.children.at(-1) ?? current;
        target.text = `${target.text} ${line.trim()}`;
      } else {
        warn(lineNo, 'stray-text', `Text outside a list item in "## ${section}" is dropped.`);
      }
    } else if (section === 'Fixes') {
      if (BULLET.test(line) && !fixesListWarned) {
        fixesListWarned = true;
        warn(lineNo, 'fixes-list', '"## Fixes" is prose; its list markers show as text.');
      }
      paragraph.push(line.trim());
    } else if (section === 'intro') {
      paragraph.push(line.trim());
    }
    previousBlank = false;
  }
  closeParagraph();

  for (const raw of items.Major) {
    const { emoji, rest } = splitEmoji(raw.text);
    const item = parseItem(rest);
    if (!item) {
      error(raw.line, 'major-item-shape', `A Major item must read "<emoji> **Title** — body": "${raw.text}".`);
      continue;
    }
    const icon = emoji ? majorIcon(emoji) : null;
    if (!emoji) error(raw.line, 'major-no-emoji', `The Major item "${item.title}" has no emoji.`);
    else if (!icon) error(raw.line, 'unmapped-emoji', `The emoji ${emoji} on "${item.title}" has no icon. Use one from the icon map.`);
    const [first, ...extra] = raw.children;
    const pair = first ? newItem(first, error, warn) : null;
    for (const child of extra) warn(child.line, 'extra-pair', `"${item.title}" already has a paired item; this one is dropped.`);
    summary.major.push({ ...item, emoji: emoji ?? '', icon, pair });
  }

  for (const raw of items.New) {
    const parsed = newItem(raw, error, warn);
    if (parsed) summary.newItems.push(parsed);
    for (const child of raw.children) warn(child.line, 'new-item-pair', 'A New item has no paired items; this one is dropped.');
  }

  if (!titleSeen) error(null, 'no-title', 'The summary has no "# Formamorph v<version>" title.');
  if (summary.major.length === 0 && summary.newItems.length === 0 && summary.fixes.length === 0) {
    error(null, 'empty', 'The summary has no Major, New or Fixes content.');
  }
  if (summary.intro.length === 0) warn(null, 'no-intro', 'The summary has no intro paragraph.');

  const length = [
    ...summary.intro,
    ...summary.major.flatMap((m) => [m.title, m.body, ...(m.pair ? [m.pair.title, m.pair.body] : [])]),
    ...summary.newItems.flatMap((n) => [n.title, n.body]),
    ...summary.fixes,
  ].reduce((total, text) => total + visibleLength(text), 0);
  if (length > SUMMARY_LENGTH_WARNING) {
    warn(null, 'length', `The summary has ${length} visible characters, past ${SUMMARY_LENGTH_WARNING}; What's New will scroll.`);
  }

  problems.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity));
  return { summary, problems };
}
