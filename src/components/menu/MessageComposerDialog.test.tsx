import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageComposerDialog } from './MessageComposerDialog';
import MessageService from '@/services/MessageService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// jsdom can't drive a real Lexical selection, and these cover the composer's own logic rather than the
// editor's. The stub keeps the body a plain textarea so a value can be set; PromptField has its own tests.
const fieldProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => {
    fieldProps.last = props;
    return <textarea id="messageBody" aria-label={props.ariaLabel} value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
  },
}));

const BROADCAST = { broadcast: true, recipients: [] };
const DIRECT = { broadcast: false, recipients: [{ id: 'u1', username: 'alice' }] };

const setField = (id: string, value: string) => {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

/** Fill the required fields so a send is accepted. */
const fillDraft = () => {
  setField('messageSubject', 'A subject');
  setField('messageBody', 'A body.');
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the message body field', () => {
  it('is the markdown editor, named for a screen reader', () => {
    // Readers see the message rendered, so it is authored the way the world editor's prose is. Lexical
    // renders a div, so `ariaLabel` is what a label would otherwise have done.
    render(<MessageComposerDialog open onOpenChange={() => {}} target={DIRECT} adminUsername="root-admin" />);

    expect(fieldProps.last).toMatchObject({ markdown: true, ariaLabel: 'Message' });
  });

  it('holds the body to the length the server accepts', () => {
    // PromptField has no maxLength of its own, so the cap the textarea used to enforce is applied here.
    render(<MessageComposerDialog open onOpenChange={() => {}} target={DIRECT} adminUsername="root-admin" />);

    setField('messageBody', 'x'.repeat(5000));

    expect(String((fieldProps.last as { value: string }).value)).toHaveLength(4000);
  });
});

describe('scope control', () => {
  it('offers all three reach levels for a broadcast', () => {
    render(<MessageComposerDialog open onOpenChange={() => {}} target={BROADCAST} adminUsername="root" />);

    expect(screen.getByRole('radio', { name: 'Existing' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Existing + New' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Pinned' })).toBeTruthy();
  });

  it('offers only the permanence choice for a direct message', () => {
    // A 1:1 goes to one named person, so there is no audience to widen.
    render(<MessageComposerDialog open onOpenChange={() => {}} target={DIRECT} adminUsername="root" />);

    expect(screen.getByRole('radio', { name: 'Normal' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Pinned' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Existing + New' })).toBeNull();
  });

  it('starts on the quietest level', () => {
    render(<MessageComposerDialog open onOpenChange={() => {}} target={BROADCAST} adminUsername="root" />);

    expect(screen.getByRole('radio', { name: 'Existing' }).getAttribute('data-state')).toBe('on');
  });

  it('sends the level the admin picked', async () => {
    const send = vi.spyOn(MessageService, 'send').mockResolvedValue([]);
    render(<MessageComposerDialog open onOpenChange={() => {}} target={BROADCAST} adminUsername="root" />);

    fillDraft();
    fireEvent.click(screen.getByRole('radio', { name: 'Pinned' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][0]).toMatchObject({ scope: 'pinned' });
  });

  it('keeps the value when the active option is clicked again', async () => {
    // A single-select ToggleGroup clears its value on a second click of the active item. Scope is
    // required, so an unguarded control would send an empty one.
    const send = vi.spyOn(MessageService, 'send').mockResolvedValue([]);
    render(<MessageComposerDialog open onOpenChange={() => {}} target={BROADCAST} adminUsername="root" />);

    fillDraft();
    const pinned = screen.getByRole('radio', { name: 'Pinned' });
    fireEvent.click(pinned);
    fireEvent.click(pinned);

    expect(pinned.getAttribute('data-state')).toBe('on');

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][0]).toMatchObject({ scope: 'pinned' });
  });

  it('maps the direct Normal option to the unpinned scope', async () => {
    const send = vi.spyOn(MessageService, 'send').mockResolvedValue([]);
    render(<MessageComposerDialog open onOpenChange={() => {}} target={DIRECT} adminUsername="root" />);

    fillDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][0]).toMatchObject({ scope: 'existing', recipientIds: ['u1'] });
  });
});

describe('scope hint', () => {
  it('explains the selected level', () => {
    render(<MessageComposerDialog open onOpenChange={() => {}} target={BROADCAST} adminUsername="root" />);

    expect(screen.getByText(/Only accounts that exist right now/)).toBeTruthy();
  });

  it('swaps to the newly selected level', () => {
    render(<MessageComposerDialog open onOpenChange={() => {}} target={BROADCAST} adminUsername="root" />);

    fireEvent.click(screen.getByRole('radio', { name: 'Pinned' }));

    expect(screen.getByText(/cannot be dismissed/)).toBeTruthy();
    expect(screen.queryByText(/Only accounts that exist right now/)).toBeNull();
  });

  it('shows one hint at a time, not all of them', () => {
    // The whole point of the segmented control was collapsing three stacked hints into one line.
    render(<MessageComposerDialog open onOpenChange={() => {}} target={BROADCAST} adminUsername="root" />);

    expect(screen.queryByText(/Also everyone who signs up later/)).toBeNull();
  });
});
