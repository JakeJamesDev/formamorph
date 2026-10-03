import { useRef } from 'react';
import { Eraser, MoreVertical, ScrollText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tip } from '@/components/ui/tooltip';
import { openBubbleMenu } from '@/lib/bubbleMenuOpen';
import { cn } from '@/lib/utils';

/**
 * The title bar's ⋮ menu: Clear Conversation, which is off while the conversation is empty, then AI Context
 * and Settings. It hangs from the corner of the button that has room, so it always comes from the button. The chosen action runs after the menu has closed, so a dialog it opens does not
 * fight the menu's focus return. `container` is where the menu renders; the window sits in a layer above the
 * dialogs, so its menu must render in that layer too.
 */
/** The menu's width, which decides the corner it hangs from. Matches the `w-52` on the content. */
const MENU_WIDTH = 208;

export function FormaquestionMenu({ onOpenAiContext, onOpenSettings, onClear, container, large = false }: {
  onOpenAiContext: () => void;
  onOpenSettings: () => void;
  onClear?: () => void;
  container?: HTMLElement;
  large?: boolean;
}) {
  const pending = useRef<(() => void) | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <ContextMenu>
      <Tip tip="More Actions">
        <ContextMenuTrigger asChild>
          <Button
            ref={button}
            variant="ghost"
            size="icon"
            aria-label="More Actions"
            aria-haspopup="menu"
            className={large ? 'h-12 w-12' : 'h-8 w-8'}
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              openBubbleMenu(event.currentTarget, bounds.left + MENU_WIDTH <= window.innerWidth ? 'left' : 'right');
            }}
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </Button>
        </ContextMenuTrigger>
      </Tip>
      <ContextMenuContent
        className="w-52"
        collisionPadding={8}
        container={container}
        onCloseAutoFocus={(event) => {
          const next = pending.current;
          pending.current = null;
          if (!next) return;
          event.preventDefault();
          button.current?.focus();
          next();
        }}
      >
        <ContextMenuItem
          disabled={!onClear}
          onSelect={() => { pending.current = onClear ?? null; }}
          className={cn(onClear && 'text-destructive focus:text-destructive')}
        >
          <Eraser className="h-4 w-4 shrink-0" aria-hidden />
          Clear Conversation
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => { pending.current = onOpenAiContext; }}>
          <ScrollText className="h-4 w-4 shrink-0" aria-hidden />
          AI Context
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => { pending.current = onOpenSettings; }}>
          <Settings className="h-4 w-4 shrink-0" aria-hidden />
          Settings
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
