import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DictionaryStoreProvider, useDictionaryStoreState } from '@/contexts/DictionaryStoreContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import DictionaryTree from './DictionaryTree';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Dictionary, Placeholder } from '@/types';

const book = (entryCount: number): Dictionary => ({
  id: 'b1',
  name: 'Book',
  enabled: true,
  entries: Array.from({ length: entryCount }, (_, i) => ({ id: `e${i}`, name: `Entry ${i}`, key: [], value: 'x' })),
});

/** The tree as its hosts mount it: real stores, and a real ScrollArea viewport for the virtualizer. */
function Harness({ books, placeholders = [] }: { books: Dictionary[]; placeholders?: Placeholder[] }) {
  const store = useDictionaryStoreState(books);
  return (
    <DictionaryStoreProvider value={store}>
      <PlaceholderStoreProvider value={placeholderStore(placeholders, () => {})}>
        <ScrollArea style={{ height: 400 }}>
          <DictionaryTree selectedId={null} onSelect={() => {}} />
        </ScrollArea>
      </PlaceholderStoreProvider>
    </DictionaryStoreProvider>
  );
}

const renderedEntryRows = () => screen.queryAllByText(/^Entry \d+$/).length;

// jsdom has no layout, so every measurement is 0 and the virtualizer's window collapses to nothing.
// Simulate the real geometry the browser would report: a 600px scroll viewport and 56px rows (EditorRow's
// min-h-14). The virtualizer reads offsetWidth/offsetHeight (its getRect) and element rects (measureElement).
const elementHeight = (el: Element) => (el.hasAttribute('data-radix-scroll-area-viewport') ? 600 : 56);
const realGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const realOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const realOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function () {
    const height = elementHeight(this as Element);
    return { x: 0, y: 0, top: 0, left: 0, right: 600, bottom: height, width: 600, height, toJSON: () => ({}) } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) { return elementHeight(this); },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 600 });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realGetBoundingClientRect;
  if (realOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', realOffsetHeight);
  if (realOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffsetWidth);
});

describe('DictionaryTree — large books virtualize', () => {
  it('mounts only a window of rows for a huge book', () => {
    // A 34 MB imported book (30k entries) crashed the renderer when every row mounted; 1000 is enough
    // to prove the mount is bounded without a slow test.
    render(<Harness books={[book(1000)]} />);
    const rows = renderedEntryRows();
    expect(rows).toBeLessThan(100);
    // The zone must not degrade to rendering nothing (e.g. the scroll-viewport lookup failing).
    expect(rows).toBeGreaterThan(0);
    // The book header still reports the real total (enabled/total, advanced-mode default).
    expect(screen.getByText('1000/1000')).toBeInTheDocument();
  });

  it('renders every row of a small book, as before', () => {
    render(<Harness books={[book(3)]} />);
    expect(renderedEntryRows()).toBe(3);
  });
});

describe('DictionaryTree — a book named with a placeholder', () => {
  it('shows the book’s name by its chip, never as the token behind it', () => {
    const town: Placeholder = { id: 'ph-town', name: 'Town', values: phValues(['Sedge', 'Marrow']) };
    const named = { ...book(1), name: `${encodePlaceholderToken({ id: 'ph-town', mode: 'world', placementId: 'pl-1' })} Lore` };
    render(<Harness books={[named]} placeholders={[town]} />);
    expect(screen.getByText('Town')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('{{ph:');
  });
});
