import React, { useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
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
import { openBubbleMenu } from '@/lib/bubbleMenuOpen';
import type { PresetHeaderAction } from '@/lib/presetHeaderActions';

/** The narrow preset header's ⋯ button and its menu. It lists `actions` by section, destructive last. */
export function PresetHeaderMenu({ actions, className }: { actions: PresetHeaderAction[]; className?: string }) {
  const sections = (['file', 'destructive'] as const)
    .map((section) => actions.filter((a) => a.section === section))
    .filter((group) => group.length > 0);
  const pending = useRef<(() => void) | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <ContextMenu>
      <Tip tip="Preset Actions">
        <ContextMenuTrigger asChild>
          <Button
            ref={button}
            variant="ghost"
            size="icon"
            aria-label="Preset Actions"
            aria-haspopup="menu"
            className={cn('h-9 w-9 shrink-0', className)}
            onClick={(event) => openBubbleMenu(event.currentTarget)}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </ContextMenuTrigger>
      </Tip>
      <ContextMenuContent
        className="w-48"
        collisionPadding={8}
        onCloseAutoFocus={(event) => {
          // The chosen action runs after teardown, so its dialog does not fight the menu's focus return.
          const next = pending.current;
          pending.current = null;
          if (!next) return;
          event.preventDefault();
          button.current?.focus();
          next();
        }}
      >
        {sections.map((group, i) => (
          <React.Fragment key={group[0].section}>
            {i > 0 && <ContextMenuSeparator />}
            {group.map((action) => (
              <ContextMenuItem
                key={action.key}
                onSelect={() => { pending.current = action.run; }}
                className={cn(action.section === 'destructive' && 'text-destructive focus:text-destructive')}
              >
                <action.icon className="h-4 w-4 shrink-0" aria-hidden />
                {action.label}
              </ContextMenuItem>
            ))}
          </React.Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
