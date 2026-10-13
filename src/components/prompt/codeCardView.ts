/** Draws a code card model as plain DOM, in the app's popover and code tokens. */

import { ACCESS_LABEL } from '@/lib/codeSurface';
import type { CodeCard, CodeCardSignature } from '@/lib/codeCards';

/** `path: type`, or `path(params): result` for a method whose type is an arrow. */
export function signatureText({ kind, path, type }: CodeCardSignature): string {
  if (type === undefined) return path;
  const arrow = kind === 'method' ? /^\((.*)\)\s*=>\s*(.+)$/.exec(type) : null;
  return arrow ? `${path}(${arrow[1]}): ${arrow[2]}` : `${path}: ${type}`;
}

/** What a screen reader hears when a card opens: the signature, the badge, the description and World Details. */
export function cardAnnouncement({ signature, access, description, rows = [] }: CodeCard): string {
  const parts = [
    `${signature.kind} ${signatureText(signature)}`, access ? ACCESS_LABEL[access] : '', description ?? '',
    ...rows.map((row) => `${row.label}: ${row.value}`),
  ];
  return parts.filter(Boolean).map((part) => part.replace(/\.+$/, '')).join('. ');
}

/** What the card's controls do. A host that leaves one out gets the card without that control. */
export interface CodeCardActions {
  /** Move the caret to the declaration at this offset. */
  goTo?: (at: number) => void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** An info line for a completion option that has no card, padded to sit in the same pane. */
export function renderInfoLine(text: string): HTMLElement {
  return element('div', 'px-2.5 py-1.5 text-helper text-muted-foreground', text);
}

/** The card's DOM: the signature with its badge, the description, World Details, a slot's default, then its
 *  links, one rule between sections. */
export function renderCodeCard(card: CodeCard, actions: CodeCardActions = {}): HTMLElement {
  const root = element('div', 'code-card w-[22.5rem] max-w-[calc(100vw-2rem)] divide-y divide-border text-helper');
  root.dataset.codeCard = '';

  const signature = element('section', 'flex items-baseline justify-between gap-2 px-2.5 py-1.5');
  const text = element('span', 'min-w-0 break-words font-mono text-label text-popover-foreground');
  text.append(element('span', 'text-muted-foreground', `(${card.signature.kind})`), ` ${signatureText(card.signature)}`);
  signature.append(text);
  if (card.access) {
    const tone = card.access === 'readOnly'
      ? 'border-border text-muted-foreground'
      : 'border-[hsl(var(--code-string)/0.4)] text-[hsl(var(--code-string))]';
    signature.append(element('span', `shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-meta ${tone}`, ACCESS_LABEL[card.access]));
  }
  root.append(signature);

  if (card.description) {
    // Three lines at most (Q6). Clamped inside the padding, so no part of a fourth line shows.
    const description = element('section', 'px-2.5 py-1.5 text-muted-foreground');
    description.append(element('p', 'line-clamp-3', card.description));
    root.append(description);
  }

  if (card.rows?.length) {
    const rows = element('dl', 'grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 px-2.5 py-1.5');
    rows.setAttribute('aria-label', 'World Details');
    for (const row of card.rows) {
      rows.append(element('dt', 'text-muted-foreground', row.label), element('dd', 'min-w-0 break-words text-popover-foreground', row.value));
    }
    root.append(rows);
  }

  if (card.defaultValue !== undefined) {
    const row = element('section', 'flex items-baseline gap-2 px-2.5 py-1.5');
    row.append(element('span', 'text-muted-foreground', 'Default'), element('span', 'min-w-0 break-words font-mono text-popover-foreground', card.defaultValue));
    root.append(row);
  }

  const { goTo } = actions;
  if (goTo && card.links?.length) {
    const bar = element('section', 'flex flex-wrap gap-x-3 gap-y-1 px-2.5 py-1.5');
    for (const link of card.links) {
      const button = element('button', 'text-primary underline-offset-2 hover:underline focus-visible:underline', `Go to Line ${link.line}`);
      button.type = 'button';
      button.addEventListener('click', () => goTo(link.at));
      bar.append(button);
    }
    root.append(bar);
  }
  return root;
}
