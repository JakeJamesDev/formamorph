import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { createGuide } from '@/lib/formaquestion/guide';
import { helpSettingsOf } from '@/lib/formaquestion/helpSettings';
import { devHelpTraceSample } from '@/lib/devHelpTraceSample';
import type { WorldSource } from '@/lib/formaquestion/helpWorldSource';
import { helpWorld } from '@/lib/formaquestion/helpWorld';
import { openWorld } from '@/test/helpFixtures';
import userEvent from '@testing-library/user-event';
import { Answer } from './AskParts';
import { FormaquestionAiContext } from './FormaquestionAiContext';
import type { HelpExchange } from './useHelpChat';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));

const index = createDocsIndex({
  pages: { Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n' },
  sidebar: '- [Traits](Traits)\n',
});
const guide = createGuide(index);
const mira: WorldSource = { kind: 'world', worldKind: 'entity', id: 'e-1', name: 'Mira' };

/** An answered exchange whose sources hold a guide section and a world item. */
function exchange(): HelpExchange {
  const base = devHelpTraceSample(index);
  const trace = base.trace!;
  const section = index.search('trait', 1)[0];
  return { ...base, sources: [section, mira], trace: { ...trace, sent: [...trace.sent, mira] } };
}

afterEach(cleanup);

describe('a world source in an answer', () => {
  it('shows as a plain name beside the guide links', () => {
    render(<Answer guide={guide} exchange={exchange()} settings={helpSettingsOf()} onSettingsChange={() => {}} onOpen={() => {}} onGo={() => {}} />);
    const sources = screen.getByRole('group', { name: 'Sources' });
    expect(within(sources).getByText('Mira')).toBeInTheDocument();
    expect(within(sources).queryByRole('button', { name: /Mira/ })).toBeNull();
    expect(within(sources).getByRole('button', { name: /How to Add a Trait/ })).toBeInTheDocument();
  });

  it('opens its item while the open world opens items', async () => {
    const open = vi.fn();
    const leave = helpWorld.register({ ...openWorld(), lean: 'editor', open });
    try {
      render(<Answer guide={guide} exchange={exchange()} settings={helpSettingsOf()} onSettingsChange={() => {}} onOpen={() => {}} onGo={() => {}} />);
      const sources = screen.getByRole('group', { name: 'Sources' });
      await userEvent.click(within(sources).getByRole('button', { name: /Mira/ }));
      expect(open).toHaveBeenCalledWith(mira);
    } finally {
      leave();
    }
  });

  it('is listed in AI Context with its kind and name', () => {
    render(<FormaquestionAiContext open onOpenChange={() => {}} exchanges={[exchange()]} />);
    const dialog = screen.getByRole('dialog', { name: 'AI Context' });
    expect(within(dialog).getByText(/entity · Mira/)).toBeInTheDocument();
  });
});
