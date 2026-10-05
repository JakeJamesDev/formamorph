import { useRef } from 'react';
import { Eraser, MoreVertical, ScrollText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tip } from '@/components/ui/tooltip';
import { openBubbleMenu } from '@/lib/bubbleMenuOpen';
import { isChatStyle, type ChatStyle } from '@/lib/formaquestion/helpSettings';
import { isMascotPlacement, type MascotPlacement } from '@/lib/formaquestion/windowBox';
import { cn } from '@/lib/utils';
import { GENERAL_COPY } from './formaquestionSettingsTabs';

/**
 * The ⋮ menu of both chromes: Clear Conversation, which is off while the conversation is empty, the Chat Style
 * choices, the Mascot Position choices where a Mascot can stand, then AI Context and Settings. It hangs from the corner of the button that has room, so it always comes from the button. The chosen action runs after the menu has closed, so a dialog it opens does not
 * fight the menu's focus return. `container` is where the menu renders; the window sits in a layer above the
 * dialogs, so its menu must render in that layer too.
 */
/** The menu's width, which decides the corner it hangs from. Matches the `w-52` on the content. */
const MENU_WIDTH = 208;

/** What the ⋮ menu does, the same in both chromes. */
export interface MenuActions {
  onOpenAiContext: () => void;
  onOpenSettings: () => void;
  /** Turns on Clear Conversation. */
  onClear?: () => void;
  /** The Chat Style the radio items mark. A pick applies after the menu closes, since it can swap the chrome that holds the menu. */
  chatStyle: ChatStyle;
  onChatStyleChange: (chatStyle: ChatStyle) => void;
  /** The Mascot Position the radio items mark. The sheet draws no Mascot, so it leaves the choices out. */
  mascotPlacement?: MascotPlacement;
  onMascotPlacementChange?: (placement: MascotPlacement) => void;
}

export function FormaquestionMenu({ onOpenAiContext, onOpenSettings, onClear, chatStyle, onChatStyleChange, mascotPlacement, onMascotPlacementChange, container, onOpenChange, large = false, round = false }: MenuActions & {
  container?: HTMLElement;
  /** Called as the menu opens and closes. */
  onOpenChange?: (open: boolean) => void;
  large?: boolean;
  /** A round button with no border, as the other buttons of the minimal chrome's pill. */
  round?: boolean;
}) {
  const pending = useRef<(() => void) | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <Tip tip="More Actions">
        <ContextMenuTrigger asChild>
          <Button
            ref={button}
            variant="ghost"
            size="icon"
            aria-label="More Actions"
            aria-haspopup="menu"
            className={cn(large ? 'h-12 w-12' : 'h-8 w-8', round && 'rounded-full border-transparent')}
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
        <ContextMenuLabel>{GENERAL_COPY.chatStyle.label}</ContextMenuLabel>
        <ContextMenuRadioGroup
          aria-label={GENERAL_COPY.chatStyle.label}
          value={chatStyle}
          onValueChange={(value) => {
            if (isChatStyle(value) && value !== chatStyle) pending.current = () => onChatStyleChange(value);
          }}
        >
          {/* The shared radio item takes its checked state explicitly. */}
          {GENERAL_COPY.chatStyle.options.map(({ value, label }) => (
            <ContextMenuRadioItem key={value} value={value} checked={chatStyle === value}>{label}</ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
        {mascotPlacement && onMascotPlacementChange && (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel>{GENERAL_COPY.mascotPosition.label}</ContextMenuLabel>
            <ContextMenuRadioGroup
              aria-label={GENERAL_COPY.mascotPosition.label}
              value={mascotPlacement}
              onValueChange={(value) => {
                if (isMascotPlacement(value) && value !== mascotPlacement) pending.current = () => onMascotPlacementChange(value);
              }}
            >
              {GENERAL_COPY.mascotPosition.options.map(({ value, label }) => (
                <ContextMenuRadioItem key={value} value={value} checked={mascotPlacement === value}>{label}</ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </>
        )}
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
