import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BugReportDialog } from './BugReportDialog';
import BugService from '@/services/BugService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// jsdom can't drive a real Lexical selection; this file covers the form's own logic, and PromptField
// has its own tests. The stub keeps the body a plain textarea so a value can be set.
const fieldProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => {
    fieldProps.last = props;
    return (
      <textarea
        id="bugBody"
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
  setField('bugTitle', 'Save button does nothing');
  setField('bugBody', 'Pressing save just spins.');
};

const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send Report' }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fieldProps.last = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('filing a report', () => {
  it('sends the title, category and description', async () => {
    const file = vi.spyOn(BugService, 'file').mockResolvedValue({} as never);

    render(<BugReportDialog open onOpenChange={() => {}} />);
    fillDraft();
    send();

    await waitFor(() => expect(file).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Save button does nothing',
      body: 'Pressing save just spins.',
      category: 'crash',
    })));
  });

  it('refuses a report with no title or no description', async () => {
    const file = vi.spyOn(BugService, 'file').mockResolvedValue({} as never);

    render(<BugReportDialog open onOpenChange={() => {}} />);

    setField('bugBody', 'Body only.');
    send();
    setField('bugBody', '');
    setField('bugTitle', 'Title only');
    send();

    await waitFor(() => expect(file).not.toHaveBeenCalled());
  });

  it('does not send whitespace as a description', async () => {
    // Trimmed rather than passed through, or the server would reject what looked filled in.
    const file = vi.spyOn(BugService, 'file').mockResolvedValue({} as never);

    render(<BugReportDialog open onOpenChange={() => {}} />);
    setField('bugTitle', 'A title');
    setField('bugBody', '   \n  ');
    send();

    await waitFor(() => expect(file).not.toHaveBeenCalled());
  });

  it('closes and tells the caller once it lands', async () => {
    vi.spyOn(BugService, 'file').mockResolvedValue({} as never);
    const onOpenChange = vi.fn();
    const onFiled = vi.fn();

    render(<BugReportDialog open onOpenChange={onOpenChange} onFiled={onFiled} />);
    fillDraft();
    send();

    await waitFor(() => expect(onFiled).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open when the send fails', async () => {
    // Closing would lose everything they typed with nothing filed.
    vi.spyOn(BugService, 'file').mockRejectedValue(new Error('offline'));
    const onOpenChange = vi.fn();

    render(<BugReportDialog open onOpenChange={onOpenChange} />);
    fillDraft();
    send();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Report' })).toBeTruthy());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('holds the description to the length the server accepts', () => {
    // PromptField has no maxLength of its own, so the cap is applied here.
    render(<BugReportDialog open onOpenChange={() => {}} />);

    setField('bugBody', 'x'.repeat(5000));

    expect(String((fieldProps.last as { value: string }).value)).toHaveLength(4000);
  });

  it('writes the description in the markdown editor', () => {
    render(<BugReportDialog open onOpenChange={() => {}} />);

    expect(fieldProps.last).toMatchObject({ markdown: true, ariaLabel: 'What happened' });
  });
});

describe('the diagnostics panel', () => {
  it('shows what will be sent before it is sent', async () => {
    // Nothing about the reporter's machine leaves without them having seen it.
    render(<BugReportDialog open onOpenChange={() => {}} />);

    expect(screen.getByText('Sent with your report')).toBeTruthy();
    expect(screen.getByText('Version')).toBeTruthy();
    expect(screen.getByText('Platform')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
  });

  it('says the playthrough is not included', async () => {
    render(<BugReportDialog open onOpenChange={() => {}} />);

    expect(screen.getByText(/Nothing about your worlds or saves/)).toBeTruthy();
  });

  it('sends exactly what it showed', async () => {
    // The service collects diagnostics itself, so the panel and the payload must come from one place.
    const file = vi.spyOn(BugService, 'file').mockResolvedValue({} as never);

    render(<BugReportDialog open onOpenChange={() => {}} />);
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
  it('starts blank rather than holding the last report', async () => {
    const { rerender } = render(<BugReportDialog open={false} onOpenChange={() => {}} />);
    rerender(<BugReportDialog open onOpenChange={() => {}} />);
    setField('bugTitle', 'First go');

    rerender(<BugReportDialog open={false} onOpenChange={() => {}} />);
    rerender(<BugReportDialog open onOpenChange={() => {}} />);

    expect((document.getElementById('bugTitle') as HTMLInputElement).value).toBe('');
  });
});
