import { Info, AlertTriangle, AlertOctagon, type LucideIcon } from 'lucide-react';
import type { MessageSeverity } from '@/types';

/**
 * Presentation for each severity: the icon and colors a reader sees, and the composer's label.
 *
 * Severity describes how loud a message is, never what it does — an `urgent` message is styled like a
 * serious one and nothing more. A label naming an action (say, "Suspension") would read as though
 * choosing it performed that action.
 */
export const MESSAGE_SEVERITY_STYLES: Record<MessageSeverity, {
  label: string;
  icon: LucideIcon;
  /** Card border/fill for the message in the inbox. */
  card: string;
  /** Icon and heading color. */
  accent: string;
}> = {
  info: {
    label: 'Info',
    icon: Info,
    card: 'border-border bg-muted/40',
    accent: 'text-muted-foreground',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    card: 'border-warning/30 bg-warning/10',
    accent: 'text-warning',
  },
  urgent: {
    label: 'Urgent',
    icon: AlertOctagon,
    card: 'border-destructive/30 bg-destructive/10',
    accent: 'text-destructive',
  },
};

/** Composer options, quietest first. */
export const MESSAGE_SEVERITIES: MessageSeverity[] = ['info', 'warning', 'urgent'];

// A message timestamp is a server timestamp like any other — see `lib/serverDate`.
export { formatServerDateTime as formatMessageDate } from './serverDate';
