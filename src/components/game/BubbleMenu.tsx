import React, { type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { menuSections, type BubbleAction } from '@/lib/bubbleActions';
import { isRequestedOpen } from '@/lib/bubbleMenuOpen';

/** An action's icon, or a spinner while its own job runs. */
export function BubbleActionIcon({ action }: { action: BubbleAction }) {
  const Icon = action.spinning ? Loader2 : action.icon;
  return <Icon className={cn('h-4 w-4 shrink-0', action.spinning && 'animate-spin')} aria-hidden />;
}

/** One action as a row icon button, with its label as tooltip and accessible name. */
export function BubbleActionButton({ action, className }: { action: BubbleAction; className?: string }) {
  return (
    <Tip tip={action.label}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={action.label}
        aria-busy={action.spinning || undefined}
        disabled={action.disabled}
        onClick={action.run}
        className={cn('h-8 w-8', action.section === 'destructive' && 'text-destructive hover:text-destructive', className)}
      >
        <BubbleActionIcon action={action} />
      </Button>
    </Tip>
  );
}

/** Whether the page has a non-collapsed text selection that touches `node`. */
function selectionTouches(node: Node) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  for (let i = 0; i < selection.rangeCount; i++) {
    if (selection.getRangeAt(i).intersectsNode(node)) return true;
  }
  return false;
}

/**
 * The right-click and long-press menu of one Chat bubble. It lists `actions` by section. With no actions,
 * or `disabled`, the bubble keeps the browser menu. The trigger stays mounted, so the bubble never remounts.
 */
export function BubbleMenu({ actions, disabled, children }: {
  actions: BubbleAction[];
  disabled?: boolean;
  children: ReactElement;
}) {
  const sections = menuSections(actions);
  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        disabled={disabled || sections.length === 0}
        onContextMenuCapture={(event) => {
          // A right-click on selected text skips the menu's own handler, which prevents the default, so the browser menu opens.
          if (!isRequestedOpen(event.nativeEvent) && selectionTouches(event.target as Node)) event.stopPropagation();
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56" collisionPadding={8}>
        {sections.map((group, i) => (
          <React.Fragment key={group[0].section}>
            {i > 0 && <ContextMenuSeparator />}
            {group.map((action) => (
              <ContextMenuItem
                key={action.key}
                disabled={action.disabled}
                onSelect={action.run}
                className={cn(action.section === 'destructive' && 'text-destructive focus:text-destructive')}
              >
                <BubbleActionIcon action={action} />
                {action.label}
              </ContextMenuItem>
            ))}
          </React.Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
