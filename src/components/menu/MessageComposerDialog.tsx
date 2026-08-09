import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MESSAGE_SEVERITIES, MESSAGE_SEVERITY_STYLES } from "@/lib/messageSeverity";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import MessageService from "@/services/MessageService";
import type { MessageSeverity, MessageSenderMode, MessageScope, SentMessage } from "@/types";

/** The broadcast reach choice, quietest first. Pinning always includes new accounts, so there is no
 *  "permanent but hidden from new signups" rung. */
const BROADCAST_SCOPES: { value: MessageScope; label: string; hint: string }[] = [
  { value: 'existing', label: 'Existing', hint: 'Only accounts that exist right now. They can dismiss it once read.' },
  { value: 'new', label: 'Existing + New', hint: 'Also everyone who signs up later. They can dismiss it once read.' },
  { value: 'pinned', label: 'Pinned', hint: 'Everyone including later signups. Kept at the top of their inbox, and cannot be dismissed.' },
];

/** A direct message goes to one named person, so only the permanence half of the choice applies. */
const DIRECT_SCOPES: { value: MessageScope; label: string; hint: string }[] = [
  { value: 'existing', label: 'Normal', hint: 'They can dismiss it from their inbox once read.' },
  { value: 'pinned', label: 'Pinned', hint: 'Kept at the top of their inbox, and cannot be dismissed until you unpin or recall it.' },
];

/** Mirrors the server's composer limits so the field caps and counter agree with what it will accept. */
const SUBJECT_MAX = 120;
const BODY_MAX = 4000;

/** Who a draft is addressed to. An empty `recipients` list with `broadcast` set goes to everyone. */
export interface ComposerTarget {
  broadcast: boolean;
  recipients: { id: string; username: string }[];
}

interface MessageComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ComposerTarget;
  /** The sending admin's name, offered as an alternative to the generic team signature. */
  adminUsername: string;
  /** Prefills for a templated send (the suspension notice offered after suspending someone). */
  initialSubject?: string;
  initialBody?: string;
  initialSeverity?: MessageSeverity;
  initialScope?: MessageScope;
  /** When set, the form rewrites this message in place instead of sending a new one. */
  editing?: SentMessage;
  /** Called after a successful send or save, so a sent list can refresh. */
  onSent?: () => void;
}

/** Admin composer for a 1:1, multi-select, or broadcast message — and the same form for editing one. */
export function MessageComposerDialog({
  open, onOpenChange, target, adminUsername,
  initialSubject = '', initialBody = '', initialSeverity = 'info', initialScope = 'existing',
  editing, onSent,
}: MessageComposerDialogProps) {
  // An edit starts from the stored message; a send from whatever prefill the caller passed.
  const start = editing
    ? {
        subject: editing.subject,
        body: editing.body,
        severity: editing.severity,
        senderAs: editing.senderAs,
        scope: editing.scope,
      }
    : { subject: initialSubject, body: initialBody, severity: initialSeverity, senderAs: 'team' as MessageSenderMode, scope: initialScope };

  const [subject, setSubject] = useState(start.subject);
  const [body, setBody] = useState(start.body);
  const [severity, setSeverity] = useState<MessageSeverity>(start.severity);
  const [senderAs, setSenderAs] = useState<MessageSenderMode>(start.senderAs);
  const [scope, setScope] = useState<MessageScope>(start.scope);
  // Opt-in: most edits are typo fixes, and re-badging everyone for one would be noise.
  const [renotify, setRenotify] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // No chip family: a message is prose, and an authored world's placeholders mean nothing to a reader.
  const plainVocab = useMemo(() => plainVocabulary(), []);

  // Reset on open rather than on close, so the fields don't blank out during the fade-out.
  useResetOnOpen(open, () => {
    setSubject(start.subject);
    setBody(start.body);
    setSeverity(start.severity);
    setSenderAs(start.senderAs);
    setScope(start.scope);
    setRenotify(false);
    setIsSending(false);
  });

  const audience = target.broadcast
    ? 'everyone'
    : target.recipients.length === 1
      ? target.recipients[0].username
      : `${target.recipients.length} users`;

  const scopeOptions = target.broadcast ? BROADCAST_SCOPES : DIRECT_SCOPES;
  const activeHint = scopeOptions.find((option) => option.value === scope)?.hint ?? '';

  const title = editing
    ? 'Edit Message'
    : target.broadcast
      ? 'Broadcast to All Users'
      : target.recipients.length === 1
        ? `Message ${target.recipients[0].username}`
        : `Message ${target.recipients.length} Users`;

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error('A subject is required');
      return;
    }

    if (!body.trim()) {
      toast.error('A message body is required');
      return;
    }

    setIsSending(true);
    const draft = { subject: subject.trim(), body: body.trim(), severity, senderAs, scope };

    try {
      if (editing) {
        await MessageService.edit(editing.id, { ...draft, renotify });
        toast.success('Message saved');
      } else {
        const sent = await MessageService.send({
          ...draft,
          ...(target.broadcast
            ? { broadcast: true }
            : { recipientIds: target.recipients.map((r) => r.id) }),
        });
        toast.success(sent.length === 1 ? 'Message sent' : `Message sent to ${sent.length} users`);
      }

      onSent?.();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || (editing ? 'Failed to save the message' : 'Failed to send the message'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Rewrites the message everyone already has. Markdown is supported.'
              : `This is delivered to ${audience} and cannot be replied to. Markdown is supported.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="messageSubject" className="text-label font-medium">Subject</label>
            <Input
              id="messageSubject"
              value={subject}
              maxLength={SUBJECT_MAX}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="A short summary"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-label font-medium">Message</span>
              <span className="text-meta text-muted-foreground">{body.length} / {BODY_MAX}</span>
            </div>
            {/* Readers see this rendered, so it is authored the same way the world editor's prose is.
                No placeholders here: any `{{ph…}}` stays inert text, exactly as it would read. */}
            <PromptField
              value={body}
              onChange={(next) => setBody(next.slice(0, BODY_MAX))}
              vocabulary={plainVocab}
              markdown
              ariaLabel="Message"
              placeholder="What you want them to know"
              className="h-[280px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              {/* "Severity", not "Type": this only sets how loudly the message is styled, and a label
                  naming an action read as though choosing it performed one. */}
              <label className="text-label font-medium">Severity</label>
              <Select value={severity} onValueChange={(value) => setSeverity(value as MessageSeverity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESSAGE_SEVERITIES.map((option) => (
                    <SelectItem key={option} value={option}>{MESSAGE_SEVERITY_STYLES[option].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-label font-medium">Send As</label>
              <Select value={senderAs} onValueChange={(value) => setSenderAs(value as MessageSenderMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">Formamorph Team</SelectItem>
                  <SelectItem value="username">{adminUsername}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reach and permanence are one escalating choice, since pinning always means everyone gets
              it. A direct message has no audience to widen, so it gets the permanence half only. */}
          <div className="space-y-2">
            <label className="text-label font-medium">Who Sees This</label>

            <ToggleGroup
              type="single"
              value={scope}
              // A single ToggleGroup clears its value when the active item is clicked again; this field
              // is required, so an empty result is ignored rather than stored.
              onValueChange={(value) => { if (value) setScope(value as MessageScope); }}
              className="w-full"
            >
              {scopeOptions.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {/* Two lines are reserved so switching options can't shift the fields below. */}
            <p className="text-meta text-muted-foreground min-h-8">{activeHint}</p>
          </div>

          {/* Editing only. Off by default because most edits are typo fixes. */}
          {editing && (
            <label className="flex items-start gap-2 text-label">
              <Checkbox
                checked={renotify}
                onCheckedChange={(checked) => setRenotify(checked === true)}
                className="mt-0.5"
              />
              <span>
                Mark unread again
                <span className="block text-meta text-muted-foreground">
                  Re-badges everyone, restarts the read count, and returns it to anyone who dismissed it.
                </span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            <Send className="mr-2 h-4 w-4" />
            {editing
              ? (isSending ? 'Saving…' : 'Save')
              : (isSending ? 'Sending…' : 'Send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
