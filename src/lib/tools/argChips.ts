import type { PromptSegment } from '@/lib/promptTemplate';

/** One parameter's chip in a Template body. A name holds no braces. */
const ARG_CHIP_RE = /\{\{arg:([^{}]+)\}\}/g;
const WHOLE_ARG_CHIP_RE = new RegExp(`^${ARG_CHIP_RE.source}$`);

/** The chip a Template body carries for the parameter `name`. */
export const argChipToken = (name: string): string => `{{arg:${name}}}`;

/** The parameter an arg chip names, or null when `token` is not one. */
export function argChipName(token: string): string | null {
  return WHOLE_ARG_CHIP_RE.exec(token)?.[1] ?? null;
}

/** Split text into literal runs and arg chips, as the other chip parsers split theirs. */
export function splitArgChips(text: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(ARG_CHIP_RE)) {
    if (match.index > last) segments.push({ type: 'text', value: text.slice(last, match.index) });
    segments.push({ type: 'variable', token: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}
