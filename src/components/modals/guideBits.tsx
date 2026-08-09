import type { ReactNode } from 'react';

// The small typographic pieces the setup guides share (LLM, image provider, ComfyUI workflow), so the three
// sibling dialogs render inline code and snippets identically.

/** An inline literal — a URL, flag, or field value the reader may need to copy. */
export const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-meta break-all">{children}</code>
);

/** A multi-line block (a command or config excerpt) that scrolls sideways rather than wrapping. */
export const Snippet = ({ children }: { children: ReactNode }) => (
  <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-meta">{children}</pre>
);
