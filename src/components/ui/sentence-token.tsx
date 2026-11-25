import { useState, type ReactElement, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { BreadcrumbPickerList, type BreadcrumbPickerRow } from '@/components/ui/breadcrumb-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** The look of a sentence token, for a token button that opens something other than a popover. */
export const SENTENCE_TOKEN_CLASS =
  'rounded px-0.5 font-medium underline decoration-dotted decoration-[color:color-mix(in_srgb,currentColor_45%,transparent)] underline-offset-4 hover:bg-accent hover:decoration-current focus-visible:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A muted token, such as an add control at the end of a sentence. */
export const MUTED_SENTENCE_TOKEN_CLASS = cn(SENTENCE_TOKEN_CLASS, 'font-normal text-muted-foreground');

const BROKEN_CLASS = 'text-destructive decoration-destructive';

/** A broken token's warning icon. */
const brokenMark = <TriangleAlert className="ml-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />;

/** The tooltip that gives a broken token's reason. */
const withReason = (broken: string | undefined, trigger: ReactElement) => (broken ? <Tip tip={broken}>{trigger}</Tip> : trigger);

export interface SentenceTokenProps {
  children: ReactNode;
  /** The popover's content; a function gets a callback that closes the popover. */
  editor: ReactNode | ((close: () => void) => ReactNode);
  label: string;
  wide?: boolean;
  /** A modal popover, so the wheel scrolls it inside another popover or a dialog. */
  modal?: boolean;
  /** Why the part is broken: the token reads red with a warning icon, and its tooltip gives this. */
  broken?: string;
  /** No padding, for an editor that draws its own, such as a pick list. */
  flush?: boolean;
}

/** One part of a sentence: underlined text that opens its own editor. */
export function SentenceToken({ children, editor, label, wide, modal, broken, flush }: SentenceTokenProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      {withReason(broken, (
        <PopoverTrigger asChild>
          <button type="button" aria-label={label} aria-description={broken} data-broken={broken ? '' : undefined} className={cn(SENTENCE_TOKEN_CLASS, broken && BROKEN_CLASS)}>
            {children}
            {broken && brokenMark}
          </button>
        </PopoverTrigger>
      ))}
      <PopoverContent className={cn(flush ? 'p-0' : 'space-y-2', wide ? 'w-[min(24rem,calc(100vw-2rem))]' : 'w-72')} align="start" collisionPadding={16}>
        {typeof editor === 'function' ? editor(() => setOpen(false)) : editor}
      </PopoverContent>
    </Popover>
  );
}

/** A token that flips its part on one click, with no popover. */
export function SentenceFlipToken({ children, label, disabled, onFlip }: { children: ReactNode; label: string; disabled?: boolean; onFlip: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} className={cn(SENTENCE_TOKEN_CLASS, 'disabled:pointer-events-none disabled:opacity-50')} onClick={onFlip}>
      {children}
    </button>
  );
}

/** A token that opens a searchable pick list; a pick closes it. `header` sits above the list. */
export function SentenceListToken<V>({ children, label, rows, value, onPick, search, broken, modal, header, renderText, plainText }: {
  children: ReactNode;
  label: string;
  rows: readonly BreadcrumbPickerRow<V>[];
  /** The current choice, which shows a check. */
  value?: V;
  onPick: (value: V) => void;
  search: string;
  broken?: string;
  modal?: boolean;
  header?: (close: () => void) => ReactNode;
  renderText?: (text: string) => ReactNode;
  plainText?: (text: string) => string;
}) {
  return (
    <SentenceToken label={label} broken={broken} modal={modal} flush editor={(close) => (
      <>
        {header?.(close)}
        <BreadcrumbPickerList
          sections={[{ rows }]}
          value={value}
          onPick={(v) => { onPick(v); close(); }}
          searchPlaceholder={search}
          renderText={renderText}
          plainText={plainText}
        />
      </>
    )}>{children}</SentenceToken>
  );
}
