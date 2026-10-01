import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FORMAQUESTION_TABS } from '@/components/formaquestion/formaquestionTabs';
import { NARROW_WIDTH, WIDE_WIDTH } from '@/lib/formaquestion/windowBox';
import { FormaquestionReference } from './FormaquestionReference';

describe('Formaquestion reference', () => {
  it('shows the production Help tab on each of the four edges', () => {
    render(<FormaquestionReference />);
    const tabs = within(screen.getByRole('region', { name: 'Help Tab' })).getAllByRole('button', { name: 'Help' });
    expect(tabs.map((tab) => tab.getAttribute('data-fq-edge'))).toEqual(['right', 'left', 'top', 'bottom']);
  });

  it('shows the production window with every tab the app has', () => {
    render(<FormaquestionReference />);
    const frame = within(screen.getByRole('region', { name: 'Window' })).getByRole('dialog', { name: 'Formaquestion' });
    expect(within(frame).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(FORMAQUESTION_TABS.map((tab) => tab.label));
    expect(frame.style.width).toBe(`${NARROW_WIDTH}px`);
  });

  it('searches its sample guide and changes to the wide layout', async () => {
    render(<FormaquestionReference />);
    const frame = within(screen.getByRole('region', { name: 'Window' })).getByRole('dialog', { name: 'Formaquestion' });
    await userEvent.click(within(frame).getByRole('tab', { name: 'Search' }));
    fireEvent.change(within(frame).getByRole('searchbox', { name: 'Search the Guide' }), { target: { value: 'light a lantern' } });
    expect(within(frame).getAllByRole('button', { name: /How to Light a Lantern/ })).toHaveLength(1);

    await userEvent.click(within(frame).getByRole('button', { name: 'Wide View' }));
    expect(frame.style.width).toBe(`${WIDE_WIDTH}px`);
    expect(within(frame).queryByRole('tab')).toBeNull();
    // The wide pane holds the conversation until a section opens.
    expect(within(frame).getByRole('log', { name: 'Conversation' })).toBeInTheDocument();
  });

  it('shows a sample question with its answer and its sources, and answers a new one with the guide search', async () => {
    render(<FormaquestionReference />);
    const frame = within(screen.getByRole('region', { name: 'Window' })).getByRole('dialog', { name: 'Formaquestion' });
    const log = within(frame).getByRole('log', { name: 'Conversation' });
    expect(log).toHaveTextContent('How do I light a lantern?');
    expect(within(within(log).getByRole('group', { name: 'Sources' })).getByRole('button', { name: /How to Light a Lantern/ })).toBeInTheDocument();

    await userEvent.type(within(frame).getByRole('textbox', { name: 'Ask a Question' }), 'fill a lantern');
    await userEvent.click(within(frame).getByRole('button', { name: 'Send' }));
    expect(within(within(log).getByRole('list', { name: 'Search Results' })).getAllByRole('button')[0]).toHaveTextContent('How to Fill a Lantern');
  });

  it('shows the mobile sheet in the narrow layout, with no Wide View', () => {
    render(<FormaquestionReference />);
    const sheet = within(screen.getByRole('region', { name: 'Mobile Sheet' })).getByRole('dialog', { name: 'Formaquestion' });
    expect(within(sheet).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(FORMAQUESTION_TABS.map((tab) => tab.label));
    expect(within(sheet).queryByRole('button', { name: 'Wide View' })).toBeNull();
  });
});
