import type React from 'react';
import type { BubbleAction } from '@/lib/bubbleActions';
import { BubbleActionRow } from './BubbleActionRow';
import { BubbleMenu } from './BubbleMenu';

/**
 * The narration surface of one turn: the card, its right-click menu, and its action row. The caller supplies
 * the body. The row hides when there are no actions or the turn is live.
 */
export function TurnCard({ actions, turnNumber, live, style, children }: {
  actions: BubbleAction[];
  turnNumber: number;
  live?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <BubbleMenu actions={actions}>
      <div className="rounded-lg border border-border bg-card px-3.5 py-2.5" style={style}>
        {children}
        {!live && actions.length > 0 && <BubbleActionRow turnNumber={turnNumber} actions={actions} />}
      </div>
    </BubbleMenu>
  );
}
