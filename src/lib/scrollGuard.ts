/** Exceptions the Design System allows to a native scroller; each names a row of its scrollbar standard. */
export const SCROLL_GUARD_TAGS = [
  'native-editor',
  'popover-list',
  'horizontal',
  'canvas',
  'drag-list',
  'responsive-columns',
  'migration-candidate',
] as const;

export interface ScrollGuardViolation {
  line: number;
  text: string;
}

const NATIVE_CLASS = /(?<![\w-])overflow-(?:[xy]-)?(?:auto|scroll)(?![\w-])/;
const NATIVE_STYLE = /\boverflow[XY]?\s*:\s*['"](?:auto|scroll)['"]/;
const ALLOW = /^\s*\/\/\s*scroll-guard:\s*allow\s+([a-z-]+):\s+\S/m;

const isAllowed = (source: string): boolean => {
  const tag = ALLOW.exec(source)?.[1];
  return tag !== undefined && (SCROLL_GUARD_TAGS as readonly string[]).includes(tag);
};

/** Lists each native overflow scroller in a source file with no allow comment, whether or not it imports ScrollArea. */
export function checkScrollSource(source: string): ScrollGuardViolation[] {
  if (isAllowed(source)) return [];
  return source.split('\n').flatMap((text, i) =>
    NATIVE_CLASS.test(text) || NATIVE_STYLE.test(text) ? [{ line: i + 1, text: text.trim().slice(0, 100) }] : [],
  );
}
