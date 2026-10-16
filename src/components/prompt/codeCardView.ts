/** Draws a code card model as plain DOM, in the app's popover and code tokens. */

import { ACCESS_LABEL } from '@/lib/codeSurface';
import type { OpenCodeCardItem } from '@/lib/codeCardNavigation';
import { NO_OWNERS_LABEL, scopedKind, type CodeCard, type CodeCardItem, type CodeCardSignature } from '@/lib/codeCards';
import type { CodeUse } from '@/lib/codeUses';
import { docTargetId } from '@/lib/docs/docsLinks';
import { openDocsFromClick } from '@/lib/formaquestion/docsOpener';
import { wikiPageUrl } from '@/lib/helpTopics';
import { TIMING_SHORT } from '@/lib/statCodeTiming';

/** `path: type`, or `path(params): result` for a method whose type is an arrow. */
export function signatureText({ kind, path, type }: CodeCardSignature): string {
  if (type === undefined) return path;
  const arrow = kind === 'method' ? /^\((.*)\)\s*=>\s*(.+)$/.exec(type) : null;
  return arrow ? `${path}(${arrow[1]}): ${arrow[2]}` : `${path}: ${type}`;
}

/** What a screen reader hears when a card opens: the signature, the badge, the description and World Details. */
export function cardAnnouncement({ signature, access, description, rows = [], allowedValues }: CodeCard): string {
  const values = allowedValues?.values.map(({ text, weight }) => (weight === undefined ? text : `${text} weight ${weight}`)) ?? [];
  const parts = [
    `${scopedKind(signature)} ${signatureText(signature)}`, access ? ACCESS_LABEL[access] : '', description ?? '',
    ...rows.map((row) => `${row.label}: ${row.value.replace(/\n/g, ', ')}`),
    values.length ? `Allowed Values: ${values.join(', ')}${allowedValues?.more ? ` and ${allowedValues.more} more` : ''}` : '',
  ];
  return parts.filter(Boolean).map((part) => part.replace(/\.+$/, '')).join('. ');
}

/** What the card's controls do. A host that leaves one out gets the card without that control. */
export interface CodeCardActions {
  /** Move the caret to the declaration at this offset. */
  goTo?: (at: number) => void;
  /** Open the card's world item in the World Editor. */
  open?: OpenCodeCardItem;
  /** Pin the card and list every use of its item. */
  findUses?: (item: CodeCardItem) => void;
  /** Called after the Guide link is used, so the host can close the card. The link shows only where this is set. */
  guide?: () => void;
}

// `info`, not `primary`: a light theme's primary is a pale fill color, unreadable as text on the card.
const LINK_CLASS = 'text-info underline-offset-2 hover:underline focus-visible:underline';

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

/** The card's DOM: the signature with its badge, the description, World Details, Allowed Values, a slot's
 *  default, then its links, one rule between sections. */
export function renderCodeCard(card: CodeCard, actions: CodeCardActions = {}): HTMLElement {
  const root = element('div', 'code-card w-[22.5rem] max-w-[calc(100vw-2rem)] divide-y divide-border text-helper');
  root.dataset.codeCard = '';

  const signature = element('section', 'flex items-baseline justify-between gap-2 px-2.5 py-1.5');
  const text = element('span', 'min-w-0 break-words font-mono text-label text-popover-foreground');
  text.append(element('span', 'text-muted-foreground', `(${scopedKind(card.signature)})`), ` ${signatureText(card.signature)}`);
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
      // A multi-line value, such as one Requirement Row per line, keeps its lines.
      rows.append(element('dt', 'text-muted-foreground', row.label), element('dd', 'min-w-0 whitespace-pre-line break-words text-popover-foreground', row.value));
    }
    root.append(rows);
  }

  if (card.allowedValues) {
    const section = element('section', 'px-2.5 py-1.5');
    section.append(element('h3', 'text-muted-foreground', 'Allowed Values'));
    const list = element('ul', 'space-y-0.5 font-mono text-popover-foreground');
    for (const { text, weight } of card.allowedValues.values) {
      // A weight-0 value is benched, so it draws only when every value is (Q13).
      const item = element('li', weight === 0 ? 'opacity-50' : '', weight === undefined ? text : `${text} ×${weight}`);
      if (weight === 0) item.dataset.benched = '';
      list.append(item);
    }
    if (card.allowedValues.more) list.append(element('li', 'font-sans text-muted-foreground', `and ${card.allowedValues.more} more`));
    section.append(list);
    root.append(section);
  }

  if (card.defaultValue !== undefined) {
    const row = element('section', 'flex items-baseline gap-2 px-2.5 py-1.5');
    row.append(element('span', 'text-muted-foreground', 'Default'), element('span', 'min-w-0 break-words font-mono text-popover-foreground', card.defaultValue));
    root.append(row);
  }

  const { goTo, open, findUses, guide } = actions;
  const bar = element('section', 'flex flex-wrap gap-x-3 gap-y-1 px-2.5 py-1.5');
  const link = (text: string, onClick: () => void) => {
    const button = element('button', LINK_CLASS, text);
    button.type = 'button';
    button.addEventListener('click', onClick);
    bar.append(button);
  };
  const { item } = card;
  if (open && item) link('Open', () => open(item));
  if (findUses && item) link('Find All Uses', () => findUses(item));
  for (const entry of card.links ?? []) {
    if (entry.id === 'goToLine' && goTo) link(`Go to Line ${entry.line}`, () => goTo(entry.at));
    // A real link, so a modified click or a window with no reader still reaches the wiki.
    if (entry.id === 'guide' && guide) {
      const anchor = element('a', LINK_CLASS, 'Read in the Guide');
      anchor.href = wikiPageUrl(docTargetId(entry.target));
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      // A modified click opens a tab and leaves the page, and the card, as they were.
      anchor.addEventListener('click', (event) => { if (openDocsFromClick(event, entry.target)) guide(); });
      bar.append(anchor);
    }
  }
  if (bar.childElementCount) root.append(bar);
  return root;
}

/** A use as its row reads: the stat or trait, its box and its line. */
export function rowText({ entity, name, timing, line }: CodeUse): string {
  return `${entity ? `${entity} › ` : ''}${name} · ${TIMING_SHORT[timing]} · Line ${line}`;
}

/** The Find All Uses popover: a count, then one button per box and line. */
export function renderCodeUses(uses: readonly CodeUse[], onPick: (use: CodeUse) => void): HTMLElement {
  const root = element('section', 'code-uses w-[22.5rem] max-w-[calc(100vw-2rem)] py-1 text-helper');
  root.dataset.codeUses = '';
  root.setAttribute('aria-label', 'Uses');
  if (!uses.length) {
    root.append(element('p', 'px-2.5 py-1 text-muted-foreground', 'No uses in scripts'));
    return root;
  }
  root.append(element('h3', 'px-2.5 py-1 text-muted-foreground', uses.length === 1 ? '1 Use' : `${uses.length} Uses`));
  const list = element('ul', '');
  for (const use of uses) {
    const button = element('button', 'flex w-full items-baseline justify-between gap-2 px-2.5 py-1 text-left text-popover-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none');
    button.type = 'button';
    button.append(element('span', 'min-w-0 break-words', rowText(use)));
    if (use.noOwners) button.append(element('span', 'shrink-0 text-meta text-muted-foreground', NO_OWNERS_LABEL));
    button.addEventListener('click', () => onPick(use));
    const item = element('li', '');
    item.append(button);
    list.append(item);
  }
  root.append(list);
  return root;
}
