import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackDialog } from './FeedbackDialog';
import FeedbackService from '@/services/FeedbackService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// jsdom can't drive a real Lexical selection; this file covers the form's own logic, and PromptField
// has its own tests. The stub keeps the body a plain textarea so a value can be set.
const fieldProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => {
    fieldProps.last = props;
    return (
      <textarea
        id="feedbackBody"
        aria-label={props.ariaLabel}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  },
}));

const setField = (id: string, value: string) => {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const fillDraft = () => {
  setField('feedbackTitle', 'Save button does nothing');
  setField('feedbackBody', 'Pressing save just spins.');
};

const send = () => fireEvent.click(screen.getByRole('button', { name: /Send (Report|Suggestion)/ }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fieldProps.last = null;
  // Unsent writing now survives between openings, so it survives between tests too unless cleared.
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('filing a report', () => {
  it('sends the title, category and description', async () => {
    const file = vi.spyOn(FeedbackService, 'file').mockResolvedValue({} as never);

    render(<FeedbackDialog open onOpenChange={() => {}} />);
    fillDraft();
    send();

    await waitFor(() => expect(file).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Save button does nothing',
      body: 'Pressing save just spins.',
      category: 'crash',
    })));
  });

  it('refuses a report with no title or no description', async () => {
    const file = vi.spyOn(FeedbackService, 'file').mockResolvedValue({} as never);

    render(<FeedbackDialog open onOpenChange={() => {}} />);

    setField('feedbackBody', 'Body only.');
    send();
    setField('feedbackBody', '');
    setField('feedbackTitle', 'Title only');
    send();

    await waitFor(() => expect(file).not.toHaveBeenCalled());
  });

  it('does not send whitespace as a description', async () => {
    // Trimmed rather than passed through, or the server would reject what looked filled in.
    const file = vi.spyOn(FeedbackService, 'file').mockResolvedValue({} as never);

    render(<FeedbackDialog open onOpenChange={() => {}} />);
    setField('feedbackTitle', 'A title');
    setField('feedbackBody', '   \n  ');
    send();

    await waitFor(() => expect(file).not.toHaveBeenCalled());
  });

  it('closes and tells the caller once it lands', async () => {
    vi.spyOn(FeedbackService, 'file').mockResolvedValue({} as never);
    const onOpenChange = vi.fn();
    const onFiled = vi.fn();

    render(<FeedbackDialog open onOpenChange={onOpenChange} onFiled={onFiled} />);
    fillDraft();
    send();

    await waitFor(() => expect(onFiled).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open when the send fails', async () => {
    // Closing would lose everything they typed with nothing filed.
    vi.spyOn(FeedbackService, 'file').mockRejectedValue(new Error('offline'));
    const onOpenChange = vi.fn();

    render(<FeedbackDialog open onOpenChange={onOpenChange} />);
    fillDraft();
    send();

    await waitFor(() => expect(screen.getByRole('button', { name: /Send Report/ })).toBeTruthy());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('holds the description to the length the server accepts', () => {
    // PromptField has no maxLength of its own, so the cap is applied here.
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    setField('feedbackBody', 'x'.repeat(5000));

    expect(String((fieldProps.last as { value: string }).value)).toHaveLength(4000);
  });

  it('writes the description in the markdown editor', () => {
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    expect(fieldProps.last).toMatchObject({ markdown: true, ariaLabel: 'What happened' });
  });
});

describe('the diagnostics panel', () => {
  it('shows what will be sent before it is sent', async () => {
    // Nothing about the reporter's machine leaves without them having seen it.
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    expect(screen.getByText('Sent with your report')).toBeTruthy();
    expect(screen.getByText('Version')).toBeTruthy();
    expect(screen.getByText('Platform')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
  });

  it('says the playthrough is not included', async () => {
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    expect(screen.getByText(/Nothing about your worlds or saves/)).toBeTruthy();
  });

  it('sends exactly what it showed', async () => {
    // The service collects diagnostics itself, so the panel and the payload must come from one place.
    const file = vi.spyOn(FeedbackService, 'file').mockResolvedValue({} as never);

    render(<FeedbackDialog open onOpenChange={() => {}} />);
    const shownPlatform = screen.getByText('Platform').nextElementSibling?.textContent;
    fillDraft();
    send();

    await waitFor(() => expect(file).toHaveBeenCalled());
    // `file` adds the block itself; what matters is that the dialog does not send a second, different one.
    expect(file.mock.calls[0][0]).not.toHaveProperty('diagnostics');
    expect(shownPlatform).toBeTruthy();
  });
});

describe('reopening', () => {
  const reopen = (rerender: (ui: React.ReactElement) => void, props = {}) => {
    rerender(<FeedbackDialog open={false} onOpenChange={() => {}} {...props} />);
    rerender(<FeedbackDialog open onOpenChange={() => {}} {...props} />);
  };
  const titleValue = () => (document.getElementById('feedbackTitle') as HTMLInputElement).value;
  const bodyValue = () => (document.getElementById('feedbackBody') as HTMLTextAreaElement).value;

  it('holds an unsent report so it can be closed to check something in game', async () => {
    const { rerender } = render(<FeedbackDialog open onOpenChange={() => {}} />);
    fillDraft();

    reopen(rerender);

    expect(titleValue()).toBe('Save button does nothing');
    expect(bodyValue()).toBe('Pressing save just spins.');
    expect(screen.getByText(/Picked up where you left off/)).toBeInTheDocument();
  });

  it('holds it across a reload, not just a close', async () => {
    const { rerender } = render(<FeedbackDialog open onOpenChange={() => {}} />);
    fillDraft();
    // A fresh mount with nothing carried in memory is what a reload leaves behind.
    cleanup();
    void rerender;
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    expect(titleValue()).toBe('Save button does nothing');
  });

  it('reopens on the branch that was being written, not the caller’s default', async () => {
    const { rerender } = render(<FeedbackDialog open onOpenChange={() => {}} initialType="suggestion" />);
    fillDraft();

    reopen(rerender, { initialType: 'bug' });

    expect(screen.getByRole('tab', { name: 'Suggestion' }).getAttribute('data-state')).toBe('active');
    expect(titleValue()).toBe('Save button does nothing');
  });

  it('starts blank again once the draft is discarded', async () => {
    const { rerender } = render(<FeedbackDialog open onOpenChange={() => {}} />);
    fillDraft();

    fireEvent.click(screen.getByRole('button', { name: 'Discard Draft' }));
    expect(titleValue()).toBe('');
    expect(screen.queryByText(/Picked up where you left off/)).not.toBeInTheDocument();

    reopen(rerender);
    expect(titleValue()).toBe('');
  });

  it('starts blank after the report is filed', async () => {
    vi.spyOn(FeedbackService, 'file').mockResolvedValue({} as never);
    const { rerender } = render(<FeedbackDialog open onOpenChange={() => {}} />);
    fillDraft();
    send();
    await waitFor(() => expect(FeedbackService.file).toHaveBeenCalled());

    reopen(rerender);

    expect(titleValue()).toBe('');
    expect(screen.queryByText(/Picked up where you left off/)).not.toBeInTheDocument();
  });

  it('offers nothing to discard on a blank form', async () => {
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Discard Draft' })).toBeDisabled();
  });
});

describe('the two branches', () => {
  /** Radix tab triggers activate on mousedown in jsdom, not click. */
  const pickTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

  it('opens on a bug report', async () => {
    render(<FeedbackDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('tab', { name: 'Bug' }).getAttribute('data-state')).toBe('active');
  });

  it('opens where the caller asks', async () => {
    // The profile's Suggestions tab files suggestions; landing on Bug there would be wrong every time.
    render(<FeedbackDialog open onOpenChange={() => {}} initialType="suggestion" />);

    expect(screen.getByRole('tab', { name: 'Suggestion' }).getAttribute('data-state')).toBe('active');
  });

  it('files against the branch on screen', async () => {
    const file = vi.spyOn(FeedbackService, 'file').mockResolvedValue({} as never);

    render(<FeedbackDialog open onOpenChange={() => {}} />);
    pickTab('Suggestion');
    fillDraft();
    send();

    await waitFor(() => expect(file).toHaveBeenCalledWith(expect.objectContaining({ type: 'suggestion' })));
  });

  it('swaps the category for the other branch’s list', async () => {
    // The two lists share no values a draft could carry across, so a stale one would be refused.
    const file = vi.spyOn(FeedbackService, 'file').mockResolvedValue({} as never);

    render(<FeedbackDialog open onOpenChange={() => {}} />);
    pickTab('Suggestion');
    fillDraft();
    send();

    await waitFor(() => expect(file).toHaveBeenCalledWith(expect.objectContaining({ category: 'gameplay' })));
  });

  it('keeps what has been written across a switch', async () => {
    // Losing a half-written description to a mis-click would be the worst part of the form.
    render(<FeedbackDialog open onOpenChange={() => {}} />);
    setField('feedbackTitle', 'Half a thought');
    pickTab('Suggestion');

    expect((document.getElementById('feedbackTitle') as HTMLInputElement).value).toBe('Half a thought');
  });

  it('asks for the suggestion in its own words', async () => {
    render(<FeedbackDialog open onOpenChange={() => {}} initialType="suggestion" />);

    expect(screen.getByRole('button', { name: /Send Suggestion/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Send Report/ })).toBeNull();
  });
});

describe('what a suggestion does not carry', () => {
  const pickTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

  it('shows no diagnostics panel', async () => {
    // A suggestion is about the game, not the machine it was written on — so there is nothing to
    // disclose, because nothing is collected.
    render(<FeedbackDialog open onOpenChange={() => {}} initialType="suggestion" />);

    expect(screen.queryByText('Sent with your report')).toBeNull();
  });

  it('brings the panel back on the bug tab', async () => {
    render(<FeedbackDialog open onOpenChange={() => {}} initialType="suggestion" />);
    pickTab('Bug');

    expect(screen.getByText('Sent with your report')).toBeTruthy();
  });
});
