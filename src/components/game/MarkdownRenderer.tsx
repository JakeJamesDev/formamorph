import { memo, type ComponentProps } from 'react';
import { Streamdown, defaultRehypePlugins } from 'streamdown';
import { createCodePlugin } from '@streamdown/code';
import { markdownCodeThemes } from '@/lib/markdownCodeTheme';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkFlexibleMarkers from 'remark-flexible-markers';
import { remarkSubSuper } from '@/lib/remarkSubSuper';
import { rehypePreviewTint } from '@/lib/previewTint';
import { getRevealTiming } from '@/lib/revealTimingStore';
import { cn } from '@/lib/utils';
import 'streamdown/styles.css';

// `singleTilde: false` hands `~x~` to remarkSubSuper (subscript); GFM keeps `~~strike~~`.
// The marker plugin is Obsidian's `==highlight==`, plus `=r=…==` for a color key; `remove` drops an empty
// marker rather than leaving a hollow mark for the stylesheet to paint. Styling lives in index.css against
// the classes it emits.
const REMARK_PLUGINS: ComponentProps<typeof Streamdown>['remarkPlugins'] = [
  [remarkGfm, { singleTilde: false }],
  remarkBreaks,
  remarkSubSuper,
  [remarkFlexibleMarkers, { actionForEmptyContent: 'remove' }],
];

// Streamdown boxes every table in a bordered card inside a second bordered scroller. Our markdown
// surfaces are already panels, so that reads as a box in a box. Keep the scroller and the solid fill
// that sets rows off against a translucent panel; drop the borders.
// Streamdown ships no highlighter of its own; the code plugin supplies Shiki, themed off the app's
// palette so a fence matches the stat-code editor.
const PLUGINS: ComponentProps<typeof Streamdown>['plugins'] = {
  code: createCodePlugin({ themes: markdownCodeThemes }),
};

/** The fields of Streamdown's sanitize schema we extend. It ships as an opaque plugin tuple. */
interface SanitizeSchema { tagNames?: string[]; attributes?: Record<string, unknown> }

// Highlights reach the sanitizer as `<mark class="flexible-marker …">`, and the default schema allows
// neither the tag nor a class on it. Streamdown's `allowedTags` prop only reaches the sanitizer while
// Streamdown still owns the rehype array — the tinted panes below pass their own — so the allowance goes
// into the schema both arrays share. Classes only: no inline style is allowlisted.
// The tuple check keeps a Streamdown that stops shipping the schema this way from throwing at import: the
// renderer then loses highlights rather than the app losing its markdown.
const { raw, sanitize, harden } = defaultRehypePlugins;
const [sanitizePlugin, sanitizeSchema] =
  (Array.isArray(sanitize) ? sanitize : [sanitize, {}]) as [unknown, SanitizeSchema];
const MARK_SCHEMA: SanitizeSchema = {
  ...sanitizeSchema,
  tagNames: [...(sanitizeSchema.tagNames ?? []), 'mark'],
  attributes: { ...sanitizeSchema.attributes, mark: ['className'] },
};

// Module constants because Streamdown memoizes each block on plugin-array identity.
const REHYPE_PLUGINS = [raw, [sanitizePlugin, MARK_SCHEMA], harden] as
  ComponentProps<typeof Streamdown>['rehypePlugins'];

// The tint runs after the sanitizer, so it neither relaxes what author markdown may contain nor has its own
// marks stripped.
const TINT_REHYPE_PLUGINS: ComponentProps<typeof Streamdown>['rehypePlugins'] =
  [...(REHYPE_PLUGINS ?? []), rehypePreviewTint];

const COMPONENTS: ComponentProps<typeof Streamdown>['components'] = {
  table: ({ node: _node, className, children, ...props }) => (
    <div
      className="my-4 overflow-x-auto rounded-md bg-background [&_tr]:divide-x [&_tr]:divide-border"
      data-streamdown="table-wrapper"
    >
      <table className={cn('w-full divide-y divide-border', className)} data-streamdown="table" {...props}>
        {children}
      </table>
    </div>
  ),
};

/**
 * Renders text as GitHub-flavored Markdown via Streamdown, which formats incomplete markdown as it
 * streams in. Used for AI narration and for world descriptions. `controls={false}` hides the
 * table/code copy/download buttons we don't need.
 *
 * `animate` runs the per-word entrance animation on newly-streamed words (used for the live narration
 * reveal; off for committed/static text so it doesn't re-animate on pagination). `animation` is the
 * Streamdown keyframe name (e.g. `moveIn`) and `easing` its timing function; timing (duration/stagger)
 * comes from the model's smoothed rate. Move/Grow/Stretch also read `--rl-*` vars + transform-origin
 * from the narration container (set by the caller).
 *
 * `tinted` turns on the author-side chip highlighting: the caller marks up resolved placeholder values and
 * they come back as chip-colored marks. Off everywhere the player reads.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer(
  { text, animate = false, animation = 'fadeIn', easing, tinted = false }: { text: string; animate?: boolean; animation?: string; easing?: string; tinted?: boolean },
) {
  // Read the current fade timing at render (a new sentence's release re-renders us via the text prop),
  // so the words just added animate at the model's current smoothed rate.
  return (
    <div className="[overflow-wrap:anywhere] [&_ul]:list-outside [&_ul]:pl-6 [&_ol]:list-outside [&_ol]:pl-6">
      <Streamdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={tinted ? TINT_REHYPE_PLUGINS : REHYPE_PLUGINS}
        components={COMPONENTS}
        plugins={PLUGINS}
        controls={false}
        // Committed text renders straight from the parsed blocks. Streamdown's `streaming` mode routes
        // them through state committed in a transition, which leaves finished text a render behind —
        // visible when paging history, where nothing follows to flush it.
        mode={animate ? 'streaming' : 'static'}
        animated={animate ? { animation, sep: 'word', easing, ...getRevealTiming() } : false}
        isAnimating={animate}
      >
        {text}
      </Streamdown>
    </div>
  );
});
