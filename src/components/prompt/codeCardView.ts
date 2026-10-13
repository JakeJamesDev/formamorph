/** Draws a code card model as plain DOM, in the app's popover and code tokens. */

import { ACCESS_LABEL } from '@/lib/codeSurface';
import type { CodeCard, CodeCardSignature } from '@/lib/codeCards';

/** `path: type`, or `path(params): result` for a method whose type is an arrow. */
export function signatureText({ kind, path, type }: CodeCardSignature): string {
  const arrow = kind === 'method' ? /^\((.*)\)\s*=>\s*(.+)$/.exec(type) : null;
  return arrow ? `${path}(${arrow[1]}): ${arrow[2]}` : `${path}: ${type}`;
}

/** What a screen reader hears when a card opens: the signature, the badge and the description. */
export function cardAnnouncement({ signature, access, description }: CodeCard): string {
  const parts = [`${signature.kind} ${signatureText(signature)}`, access ? ACCESS_LABEL[access] : '', description ?? ''];
  return parts.filter(Boolean).map((part) => part.replace(/\.+$/, '')).join('. ');
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

/** The card's DOM: the signature with its badge, then the description, one rule between sections. */
export function renderCodeCard(card: CodeCard): HTMLElement {
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

  if (card.description) root.append(element('section', 'px-2.5 py-1.5 text-muted-foreground', card.description));
  return root;
}
