import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import type { ExtraProps } from 'streamdown';
import { Button } from '@/components/ui/button';
import { FlashTip, Tip } from '@/components/ui/tooltip';
import { copyText } from '@/lib/clipboard';
import { useMountedRef } from '@/lib/useMountedRef';

type HastElement = NonNullable<ExtraProps['node']>;
type HastChild = HastElement['children'][number];

/** One fenced code block. `meta` is the fence's info string after the language, such as a slot tag. */
export interface SnippetBlock {
  code: string;
  language: string;
  meta: string | undefined;
}

/** Controls a surface adds to a block's toolbar beside Copy. */
export type SnippetActions = (block: SnippetBlock) => ReactNode;

function textOf(node: HastChild): string {
  if (node.type === 'text') return node.value;
  return node.type === 'element' ? node.children.map(textOf).join('') : '';
}

/** The block a `pre` element holds, or null when it holds no `code` element. */
function snippetBlock(pre: HastElement | undefined): SnippetBlock | null {
  const code = pre?.children.find((child): child is HastElement => child.type === 'element' && child.tagName === 'code');
  if (!code) return null;
  const classes = code.properties.className;
  const languageClass = Array.isArray(classes) ? classes.find((name) => String(name).startsWith('language-')) : undefined;
  const meta = code.properties.metastring;
  return {
    // The markdown tree ends a fence's text with a newline that the block does not show.
    code: code.children.map(textOf).join('').replace(/\n+$/, ''),
    language: languageClass === undefined ? '' : String(languageClass).slice('language-'.length),
    meta: typeof meta === 'string' && meta !== '' ? meta : undefined,
  };
}

/** How long the copy result shows before it fades. */
const FLASH_MS = 1200;

/** Copy, confirmed by a tip at the button rather than a toast. */
function CopyButton({ code }: { code: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const mounted = useMountedRef();
  // `shown` counts presses, so a second copy restarts the timer even with the same text.
  const [flash, setFlash] = useState({ tip: '', open: false, shown: 0 });
  useEffect(() => {
    if (!flash.open) return;
    const timer = setTimeout(() => setFlash((prev) => ({ ...prev, open: false })), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash.open, flash.shown]);
  const copy = () => {
    void copyText(code).then((copied) => {
      if (!mounted.current) return;
      setFlash((prev) => ({ tip: copied ? 'Copied' : "Couldn't copy", open: true, shown: prev.shown + 1 }));
    });
  };
  return (
    <>
      <Tip tip="Copy">
        <Button ref={button} variant="ghost" size="icon" className="h-6 w-6" onClick={copy}>
          <Copy aria-hidden className="h-3.5 w-3.5" />
        </Button>
      </Tip>
      <FlashTip anchor={button} tip={flash.tip} open={flash.open} />
    </>
  );
}

/**
 * The `pre` renderer of the help window: Streamdown's highlighted block under a toolbar with Copy.
 * It wraps the block rather than replacing `code`, which would replace the highlighter.
 */
export function CodeSnippet({ node, children, actions }: { node?: HastElement; children?: ReactNode; actions?: SnippetActions }) {
  // Streamdown's own `pre` marks its child as a block; the `code` renderer reads that mark.
  const body = isValidElement(children) ? cloneElement(children, { 'data-block': 'true' } as Record<string, unknown>) : children;
  const block = snippetBlock(node);
  if (!block) return <>{body}</>;
  return (
    <div className="relative my-4 [&>[data-streamdown=code-block]]:my-0">
      {body}
      <div className="absolute right-2 top-2 flex h-8 items-center gap-1">
        <CopyButton code={block.code} />
        {actions?.(block)}
      </div>
    </div>
  );
}
