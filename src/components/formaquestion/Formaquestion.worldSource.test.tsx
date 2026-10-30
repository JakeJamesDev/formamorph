import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { createGuide } from '@/lib/formaquestion/guide';
import { helpSettingsOf } from '@/lib/formaquestion/helpSettings';
import { devHelpTraceSample } from '@/lib/devHelpTraceSample';
import type { WorldSource } from '@/lib/formaquestion/helpWorldSource';
import { helpWorld, type WorldLean } from '@/lib/formaquestion/helpWorld';
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
function exchange(lean?: WorldLean): HelpExchange {
  const base = devHelpTraceSample(index);
  const trace = base.trace!;
  const section = index.search('trait', 1)[0];
  return { ...base, lean, sources: [section, mira], trace: { ...trace, sent: [...trace.sent, mira] } };
}

const renderAnswer = (lean?: WorldLean) => {
  render(<Answer guide={guide} exchange={exchange(lean)} settings={helpSettingsOf()} onSettingsChange={() => {}} onOpen={() => {}} onGo={() => {}} />);
  return screen.getByRole('group', { name: 'Sources' });
};

afterEach(cleanup);

describe('a world source in an answer', () => {
  it('shows as a plain name beside the guide links', () => {
    const sources = renderAnswer('game');
    expect(within(sources).getByText('Mira')).toBeInTheDocument();
    expect(within(sources).queryByRole('button', { name: /Mira/ })).toBeNull();
    expect(within(sources).getByRole('button', { name: /How to Add a Trait/ })).toBeInTheDocument();
  });

  it('opens its item for an editor answer while the editor is open', async () => {
    const open = vi.fn();
    const leave = helpWorld.register({ ...openWorld(), lean: 'editor', open });
    try {
      const sources = renderAnswer('editor');
      await userEvent.click(within(sources).getByRole('button', { name: /Mira/ }));
      expect(open).toHaveBeenCalledWith(mira);
    } finally {
      leave();
    }
  });

  it('stays a plain name for a game answer after the editor opens', () => {
    const leave = helpWorld.register({ ...openWorld(), lean: 'editor', open: vi.fn() });
    try {
      const sources = renderAnswer('game');
      expect(within(sources).getByText('Mira')).toBeInTheDocument();
      expect(within(sources).queryByRole('button', { name: /Mira/ })).toBeNull();
    } finally {
      leave();
    }
  });

  it('is a plain name for an editor answer once no editor is open', () => {
    const leave = helpWorld.register({ ...openWorld(), lean: 'game' });
    try {
      const sources = renderAnswer('editor');
      expect(within(sources).getByText('Mira')).toBeInTheDocument();
      expect(within(sources).queryByRole('button', { name: /Mira/ })).toBeNull();
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
