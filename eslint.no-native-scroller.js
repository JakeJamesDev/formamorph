/**
 * A native overflow scroller paints the browser's scrollbar, so a scroller uses `ScrollArea` unless its file
 * carries `// scroll-guard: allow <tag>: <reason>`. Each tag names a row of the Design System scrollbar standard.
 */
const SCROLL_GUARD_TAGS = [
  'native-editor',
  'popover-list',
  'horizontal',
  'canvas',
  'drag-list',
  'responsive-columns',
  'migration-candidate',
];

const NATIVE_CLASS = /(?<![\w-])overflow-(?:[xy]-)?(?:auto|scroll)(?![\w-])/;
const NATIVE_STYLE = /\boverflow[XY]?\s*:\s*['"](?:auto|scroll)['"]/;
const OVERFLOW_KEY = /^overflow[XY]?$/;
const ALLOW = /^\s*scroll-guard:\s*allow\s+([a-z-]+):\s+\S/;

/** Whether `comment` is an allow comment on its own line, naming a known tag. */
const isAllowed = (comment, sourceCode) => {
  const ownLine = sourceCode.lines[comment.loc.start.line - 1].slice(0, comment.loc.start.column).trim() === '';
  const tag = comment.type === 'Line' && ownLine ? ALLOW.exec(comment.value)?.[1] : undefined;
  return tag !== undefined && SCROLL_GUARD_TAGS.includes(tag);
};

export const noNativeScrollerRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid a native overflow scroller in a file with no scroll-guard allow comment.' },
    schema: [],
    messages: {
      nativeScroller: `Move this scroller to ScrollArea, or add "// scroll-guard: allow <${SCROLL_GUARD_TAGS.join('|')}>: <reason>".`,
    },
  },
  create(context) {
    if (context.sourceCode.getAllComments().some((comment) => isAllowed(comment, context.sourceCode))) return {};
    const check = (node, text) => {
      if (typeof text === 'string' && (NATIVE_CLASS.test(text) || NATIVE_STYLE.test(text))) {
        context.report({ node, messageId: 'nativeScroller' });
      }
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.raw),
      Property(node) {
        const key = node.key.name ?? node.key.value;
        if (OVERFLOW_KEY.test(key) && (node.value.value === 'auto' || node.value.value === 'scroll')) {
          context.report({ node, messageId: 'nativeScroller' });
        }
      },
    };
  },
};
