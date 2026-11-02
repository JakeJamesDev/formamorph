import { useRef, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { ItemRowArt } from '@/components/ItemIconArt';
import { useIsCut } from '@/components/TruncatedText';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import type { ShownItemIcon } from '@/lib/itemIcons';
import { cn } from '@/lib/utils';

export const BOUND_TIP = "Bound: you can't drop or give it";

/** A row name's button. It covers the row, so the picture and the meta text press it too. */
const ROW_NAME = 'rounded-sm text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring';

/** A row's name on one line, with the full text in a tooltip while it is cut (Q5, Q23). */
function CutRowName({ name, onOpen }: { name: string; onOpen: () => void }) {
  const text = useRef<HTMLSpanElement>(null);
  const cut = useIsCut(text, name);
  return (
    <Tip tip={name} labelsChild={false} disabled={!cut}>
      <button type="button" className={cn(ROW_NAME, 'min-w-0')} onClick={onOpen}>
        <span ref={text} className="block truncate">{name}</span>
      </button>
    </Tip>
  );
}

/** One Item Copy in a list. Pressing the row opens the item popup. `line` is the second line, and `wrapName` wraps the name instead of cutting it. */
export function ItemRow({ name, shown, state, quantity, bound, line, wrapName, onOpen, actions }: {
  name: string;
  shown: ShownItemIcon;
  state?: string;
  quantity: number;
  bound?: boolean;
  line?: string | null;
  wrapName?: boolean;
  onOpen: () => void;
  actions: ReactNode;
}) {
  return (
    <li className="relative flex min-h-9 items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary/60">
      <ItemRowArt shown={shown} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-label">
          {wrapName
            ? <button type="button" onClick={onOpen} className={cn(ROW_NAME, 'min-w-0 [overflow-wrap:anywhere]')}>{name}</button>
            : <CutRowName name={name} onOpen={onOpen} />}
          {state && <Meta className="shrink-0">{state}</Meta>}
          {quantity > 1 && <Meta className="shrink-0">×{quantity}</Meta>}
          {bound && (
            <Tip tip={BOUND_TIP}>
              <span role="img" aria-label="Bound" className="relative shrink-0">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              </span>
            </Tip>
          )}
        </p>
        {line && <Meta as="p">{line}</Meta>}
      </div>
      <div className="relative shrink-0">{actions}</div>
    </li>
  );
}
