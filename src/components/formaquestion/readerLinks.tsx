import type { ComponentPropsWithoutRef } from 'react';
import type { ExtraProps } from 'streamdown';
import type { MarkdownComponents } from '@/components/game/MarkdownRenderer';
import { readerLinkTarget } from '@/lib/docs/docsReader';
import { cn } from '@/lib/utils';
import { CodeSnippet, type SnippetActions } from './CodeSnippet';

/** The focus ring of a plain control in the window. */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

const LINK_CLASS = cn('rounded-sm font-medium text-primary underline underline-offset-2', FOCUS_RING);

/**
 * Renderers for docs text: a docs link opens its section in the reader, every other link opens the browser,
 * and a code block gets a toolbar with Copy and the `snippetActions` controls.
 */
export function readerComponents(onOpen: (id: string) => void, snippetActions?: SnippetActions): MarkdownComponents {
  return {
    pre: ({ node, children }: ComponentPropsWithoutRef<'pre'> & ExtraProps) => (
      <CodeSnippet node={node} actions={snippetActions}>{children}</CodeSnippet>
    ),
    // The link's own target and rel are left out: a docs link must not open a browser tab.
    a: ({ href, children }: ComponentPropsWithoutRef<'a'> & { node?: unknown }) => {
      const target = readerLinkTarget(href);
      if (target === null) {
        return <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>{children}</a>;
      }
      return (
        <a
          href={href}
          className={LINK_CLASS}
          onClick={(event) => {
            event.preventDefault();
            onOpen(target);
          }}
        >
          {children}
        </a>
      );
    },
  };
}
