import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { sseReply, stubStream, textSnapshot } from '@/test/aiTextFixtures';
import type { HelpAi } from './useHelpAi';
import { useHelpChat } from './useHelpChat';

const index = createDocsIndex({ pages: { Traits: '# Traits\n\n## How to Add a Trait\n\n1. Select **Add Trait**.\n' } });
const ai: HelpAi = { snapshot: textSnapshot(), reachable: true, revalidate: async () => true };

afterEach(() => vi.unstubAllGlobals());

describe('useHelpChat', () => {
  it('takes one question at a time: a second ask while the first runs adds nothing and sends nothing', async () => {
    const fetchSpy = stubStream(sseReply('Select **Add Trait**.'));
    const { result } = renderHook(() => useHelpChat(index, ai));
    act(() => {
      result.current.ask('How do I add a trait?');
      result.current.ask('And a stat?');
    });
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.exchanges.map((exchange) => exchange.question)).toEqual(['How do I add a trait?']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // The next question goes through once the first has its answer.
    act(() => { result.current.ask('And a stat?'); });
    await waitFor(() => expect(result.current.exchanges).toHaveLength(2));
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['finds the AI', true],
    ['finds no AI', false],
  ])('stops at once when Stop comes while the fresh check runs, and sends nothing when the check later %s', async (_name, found) => {
    const fetchSpy = stubStream(sseReply('Unused.'));
    let finishCheck: (reachable: boolean) => void = () => {};
    const blocked: HelpAi = { ...ai, reachable: false, revalidate: () => new Promise((resolve) => { finishCheck = resolve; }) };
    const { result } = renderHook(() => useHelpChat(index, blocked));
    act(() => { result.current.ask('How do I add a trait?'); });
    expect(result.current.busy).toBe(true);

    // The check of a server that does not answer can take a long time. Stop does not wait for it.
    await act(async () => { result.current.stop(); });
    expect(result.current.exchanges.map((exchange) => exchange.status)).toEqual(['stopped']);
    expect(result.current.busy).toBe(false);

    await act(async () => { finishCheck(found); });
    expect(result.current.exchanges.map((exchange) => exchange.status)).toEqual(['stopped']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does nothing before the docs load', () => {
    const fetchSpy = stubStream(sseReply('Unused.'));
    const { result } = renderHook(() => useHelpChat(null, ai));
    act(() => { result.current.ask('How do I add a trait?'); });
    expect(result.current.exchanges).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
