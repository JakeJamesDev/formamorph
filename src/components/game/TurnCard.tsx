import type React from 'react';
import type { BubbleAction } from '@/lib/bubbleActions';
import { TURN_CHROME_ENTER_MS } from '@/lib/turnChrome';
import { BubbleActionRow } from './BubbleActionRow';
import { BubbleMenu } from './BubbleMenu';

/**
 * The narration surface of one turn: the card, its right-click menu, and its action row. The caller supplies
 * the body. While the turn is live the menu is empty and the row is closed; the row then opens by growing from
 * zero height, so the text above and anything below move smoothly rather than jumping.
 */
export function TurnCard({ actions, turnNumber, live, style, children }: {
  actions: BubbleAction[];
  turnNumber: number;
  live?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const open = !live;
  return (
    <BubbleMenu actions={open ? actions : []}>
      <div className="rounded-lg border border-border bg-card px-3.5 py-2.5" style={style}>
        {children}
        {actions.length > 0 && (
          <div
            data-testid="turn-actions"
            data-open={open}
            aria-hidden={!open}
            className="grid motion-reduce:transition-none"
            style={{
              gridTemplateRows: open ? '1fr' : '0fr',
              opacity: open ? 1 : 0,
              visibility: open ? 'visible' : 'hidden',
              transition: `grid-template-rows ${TURN_CHROME_ENTER_MS}ms ease-out, opacity ${TURN_CHROME_ENTER_MS}ms ease-out, visibility ${TURN_CHROME_ENTER_MS}ms`,
            }}
          >
            <div className="min-h-0 overflow-hidden">
              <BubbleActionRow turnNumber={turnNumber} actions={actions} />
            </div>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
