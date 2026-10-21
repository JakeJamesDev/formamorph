import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Meta } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { isNotice, type ScriptPromptAnswer, type ScriptPromptRequest, type ScriptPromptStore } from '@/lib/scriptPrompts';

/** The most options a single `ask` shows as pills; past that it is a dropdown (Q17). */
const PILL_LIMIT = 4;

const CONFIRM_OPTIONS = ['Yes', 'No'];

/** Where the line sits: Pages spans the column, Chat centers it at bubble width. */
export type PromptLineLayout = 'pages' | 'chat';

const LAYOUT: Record<PromptLineLayout, string> = { pages: '', chat: 'mx-auto w-full max-w-[85%]' };

// The action line's rule, so a prompt reads as part of the turn.
const RULE = 'border-l-2 border-primary pl-3';
const LINE_TEXT = 'whitespace-pre-wrap text-label italic text-foreground';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
const LINK = cn('rounded-sm text-label underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50', FOCUS_RING);

type Asked = Exclude<ScriptPromptRequest, { kind: 'tell' | 'toast' }>;
type Ask = Extract<ScriptPromptRequest, { kind: 'ask' }>;
type Answer = (value: ScriptPromptAnswer) => void;

/** Each tell of one turn, in call order: the prompt line with its text alone (Q16). Nothing when there are none. */
export function ScriptTellLines({ tells, layout = 'pages', className }: { tells: readonly { text: string }[]; layout?: PromptLineLayout; className?: string }) {
  if (!tells.length) return null;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {tells.map(({ text }, index) => (
        <p key={index} data-testid="script-tell" className={cn(RULE, LINE_TEXT, LAYOUT[layout])}>{text}</p>
      ))}
    </div>
  );
}

/**
 * The oldest open prompt of `store` as the inline prompt line: the question, its control under it, and text-link
 * actions (Q17). Cancel, or Escape while focus is inside, fails the script as canceled (Q15).
 */
export function ScriptPromptLine({ store, layout = 'pages', className }: { store: ScriptPromptStore; layout?: PromptLineLayout; className?: string }) {
  const pending = useSyncExternalStore(store.subscribe, store.pending);
  const prompt = pending.find(({ request }) => !isNotice(request));
  if (!prompt || isNotice(prompt.request)) return null;
  // A new prompt starts from a fresh draft and takes focus again.
  return <PromptLine key={prompt.id} store={store} id={prompt.id} request={prompt.request} className={cn(LAYOUT[layout], className)} />;
}

function PromptLine({ store, id, request, className }: { store: ScriptPromptStore; id: string; request: Asked; className?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = frame.current;
    if (node && !node.contains(document.activeElement)) node.focus();
  }, []);

  // The prompt can close under a second press, so only a prompt still open takes the answer.
  const answer: Answer = (value) => {
    if (store.pending().some((open) => open.id === id)) store.answer(id, value);
  };
  const cancel = () => store.cancel(id);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A key in a portaled menu, such as the dropdown's list, bubbles here through React; that menu owns it.
    if (event.key !== 'Escape' || !event.currentTarget.contains(event.target as Node)) return;
    event.stopPropagation();
    cancel();
  };

  return (
    <div
      ref={frame}
      tabIndex={-1}
      role="group"
      aria-label={request.question}
      data-testid="script-prompt"
      className={cn(RULE, 'focus:outline-none', className)}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-baseline gap-2">
        <p className={cn(LINE_TEXT, 'min-w-0 flex-1')}>{request.question}</p>
        {request.asker && <Meta className="max-w-[40%] shrink-0 truncate">{request.asker}</Meta>}
      </div>
      <Control request={request} answer={answer} cancel={cancel} />
    </div>
  );
}

/** The control each kind takes: one press for a confirm or a short ask, else a control and OK. */
function Control({ request, answer, cancel }: { request: Asked; answer: Answer; cancel: () => void }) {
  switch (request.kind) {
    case 'confirm':
      return <ActionRow onCancel={cancel}><Pills options={CONFIRM_OPTIONS} onPress={(index) => answer(index === 0)} /></ActionRow>;
    case 'input':
      return <TextControl request={request} answer={answer} cancel={cancel} />;
    case 'ask':
      if (request.multiple) return <ToggleControl request={request} answer={answer} cancel={cancel} />;
      if (request.options.length > PILL_LIMIT) return <DropdownControl request={request} answer={answer} cancel={cancel} />;
      return <ActionRow onCancel={cancel}><Pills options={request.options} onPress={answer} /></ActionRow>;
  }
}

/** The control, then Cancel, then OK when the answer takes more than one press. */
function ActionRow({ children, onCancel, ok }: { children: ReactNode; onCancel: () => void; ok?: { onPress: () => void; disabled?: boolean } }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" className={cn(LINK, 'text-muted-foreground')} onClick={onCancel}>Cancel</button>
      {ok && <button type="button" className={cn(LINK, 'font-medium text-primary')} disabled={ok.disabled} onClick={ok.onPress}>OK</button>}
    </div>
  );
}

function TextControl({ request, answer, cancel }: { request: Extract<Asked, { kind: 'input' }>; answer: Answer; cancel: () => void }) {
  const [text, setText] = useState('');
  return (
    <ActionRow onCancel={cancel} ok={{ onPress: () => answer(text) }}>
      <Input
        autoFocus
        aria-label={request.question}
        className="h-8"
        placeholder={request.placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          answer(text);
        }}
      />
    </ActionRow>
  );
}

function ToggleControl({ request, answer, cancel }: { request: Ask; answer: Answer; cancel: () => void }) {
  const [toggled, setToggled] = useState<number[]>([]);
  const toggle = (index: number) =>
    setToggled((now) => (now.includes(index) ? now.filter((at) => at !== index) : [...now, index].sort((a, b) => a - b)));
  return (
    <ActionRow onCancel={cancel} ok={{ onPress: () => answer(toggled) }}>
      <Pills options={request.options} isOn={(index) => toggled.includes(index)} onPress={toggle} />
    </ActionRow>
  );
}

function DropdownControl({ request, answer, cancel }: { request: Ask; answer: Answer; cancel: () => void }) {
  const [dropdownPick, setDropdownPick] = useState<number | null>(null);
  return (
    <ActionRow onCancel={cancel} ok={{ onPress: () => { if (dropdownPick !== null) answer(dropdownPick); }, disabled: dropdownPick === null }}>
      <Select value={dropdownPick === null ? '' : String(dropdownPick)} onValueChange={(next) => setDropdownPick(Number(next))}>
        <SelectTrigger autoFocus aria-label={request.question} className="h-8">
          <SelectValue placeholder="Choose One" />
        </SelectTrigger>
        <SelectContent>
          {request.options.map((option, index) => <SelectItem key={index} value={String(index)}>{option}</SelectItem>)}
        </SelectContent>
      </Select>
    </ActionRow>
  );
}

/** Pill buttons: one press answers, or with `isOn` each press toggles its pill. */
function Pills({ options, isOn, onPress }: { options: readonly string[]; isOn?: (index: number) => boolean; onPress: (index: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option, index) => {
        const on = isOn?.(index) ?? false;
        return (
          <button
            key={index}
            type="button"
            aria-pressed={isOn ? on : undefined}
            onClick={() => onPress(index)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-label transition-colors',
              FOCUS_RING,
              on ? 'border-primary bg-primary text-primary-foreground focus-visible:ring-primary-foreground' : 'border-border hover:bg-primary/10',
            )}
          >
            {on && <Check className="h-3 w-3" aria-hidden />}
            {option}
          </button>
        );
      })}
    </div>
  );
}
