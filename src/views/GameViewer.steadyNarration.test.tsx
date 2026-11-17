import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { oneRoutine } from '@/test/routines';
import { useGameplay } from '@/contexts/GameplayContext';
import { narrationHash } from '@/lib/coref/mentionReadings';
import { sseFrame } from '@/test/aiTextFixtures';
import { parseTurnContent } from '@/lib/turnDigest';
import type { Entity } from '@/types';

/**
 * With Character Mentions on, the narration renderer keeps its DOM through a turn: streamed choices and history
 * writes leave the speaker colors equal, so nothing remounts it. A new speaker the player can name repaints once.
 */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
// The guard case takes the backstop out of the path: each hook hands back what it was given.
const backstop = vi.hoisted(() => ({ off: false }));
vi.mock('@/lib/keepEqualMap', async (original) => {
  const real = await original<typeof import('@/lib/keepEqualMap')>();
  return {
    ...real,
    // `off` flips only between renders of separate tests, so a mounted tree never switches hooks.
    useKeepEqualMap: ((next: ReadonlyMap<unknown, unknown>, equal?: (a: unknown, b: unknown) => boolean) => (backstop.off ? next : real.useKeepEqualMap(next, equal))) as typeof real.useKeepEqualMap,
    useKeepEqualList: (<L extends readonly unknown[]>(next: L) => (backstop.off ? next : real.useKeepEqualList(next))) as typeof real.useKeepEqualList,
  };
});
// Records each speaker-color identity the card provider receives, the renderer's input.
const seen = vi.hoisted(() => ({ colors: new Set<unknown>() }));
vi.mock('@/components/game/MentionCards', async (original) => {
  const real = await original<typeof import('@/components/game/MentionCards')>();
  const Provider: typeof real.MentionCardsProvider = (props) => {
    seen.colors.add(props.colors);
    return real.MentionCardsProvider(props);
  };
  return { ...real, MentionCardsProvider: Provider };
});
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const unique = (id: string, name: string, more: Partial<Entity> = {}): Entity => ({
  id, name, kind: 'unique', locations: ['harbor'], knownIn: ['harbor'],
  routines: oneRoutine([{ id: `${id}-start`, place: 'harbor', weight: 1, schedule: [] }]), ...more,
});
// Wren hides her name behind a blank Stranger Name, so the player cannot name her until they meet her.
const world = harborWorld({ entities: [unique('mira', 'Mira'), unique('wren', 'Wren', { strangerName: '' })] });

const FIRST = '"Welcome to the harbor,"';
const SECOND = '"Mind the ropes."';
const NARRATION = `Mira smiles. ${FIRST} she says. Someone behind her mutters, ${SECOND}`;

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};

/** The paragraph the narration renderer drew the turn into. */
const narrationNode = () => [...document.querySelectorAll('p')].find((p) => p.textContent?.includes('Welcome to the harbor'));
/** The speaker the renderer colored the quote holding `text` for, or empty when it has no color. */
const quoteColor = (text: string) => {
  const holder = [...(narrationNode()?.querySelectorAll<HTMLElement>('[data-speaker]') ?? [])].find((el) => el.textContent?.includes(text));
  return holder?.dataset.speaker ?? '';
};

/** Plays one turn and gives it a reading: the first quote is Mira's, the second Wren's. */
async function playReadTurn() {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubMoveEndpoint(NARRATION, {}, 'NONE');
  await playTurn(gameplay, 'Look around');
  const turn = gameplay().fullMessageHistory.flatMap((m) => (m.role === 'assistant' ? [parseTurnContent(m.content)] : [])).at(-1);
  const narration = turn?.narration ?? '';
  const turnId = turn?.turnId ?? '';
  expect(narration).toContain('Welcome to the harbor');
  const span = (quote: string) => ({ start: narration.indexOf(quote), end: narration.indexOf(quote) + quote.length });
  act(() => {
    gameplay().setMentionReadings({
      [turnId]: {
        model: 'small', version: 1, textHash: narrationHash(narration),
        reading: { mentions: [], quotes: [{ ...span(FIRST), speaker: 'mira' }, { ...span(SECOND), speaker: 'wren' }] },
      },
    });
  });
  await waitFor(() => expect(quoteColor('Welcome to the harbor')).not.toBe(''));
  return turnId;
}

describe('steady narration with Character Mentions on', () => {
  beforeEach(async () => {
    await resetMoveTurnStorage();
    localStorage.setItem('FORMAMORPH_characterMentions', 'true');
    live = null;
    backstop.off = false;
    seen.colors.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (Element.prototype as { scrollTo?: unknown }).scrollTo;
  });

  // With the backstop out of the path, only an upstream free of churn keeps the node.
  it.each([false, true])('keeps the narration node through streamed choices and a history write, and repaints once for a new speaker (backstop out: %s)', async (out) => {
    backstop.off = out;
    const turnId = await playReadTurn();
    const node = narrationNode();
    expect(node).toBeDefined();
    expect(quoteColor('Mind the ropes')).toBe('');

    // The choices stream in, one line at a time.
    for (const lines of [['Wave'], ['Wave', 'Ask about the ship'], ['Wave', 'Ask about the ship', 'Leave']]) {
      act(() => { gameplay().setChoices(lines); });
    }
    expect(narrationNode()).toBe(node);

    // A background pass writes the turn's summary: the history changes, no entity state does.
    act(() => {
      gameplay().setFullMessageHistory((history) => history.map((m) => {
        const turn = m.role === 'assistant' ? parseTurnContent(m.content) : null;
        return turn?.turnId === turnId ? { ...m, content: JSON.stringify({ ...turn, summary: 'Mira greets the player.' }) } : m;
      }));
    });
    expect(gameplay().fullMessageHistory.some((m) => parseTurnContent(m.content)?.summary === 'Mira greets the player.')).toBe(true);
    expect(narrationNode()).toBe(node);

    // Wren becomes someone the player can name: the speaker colors gain her, through one fresh mount.
    let unmounts = 0;
    const removals = new MutationObserver((records) => {
      for (const { removedNodes } of records) {
        for (const removed of removedNodes) if (removed.textContent?.includes('Welcome to the harbor')) unmounts += 1;
      }
    });
    removals.observe(document.body, { childList: true, subtree: true });
    act(() => { gameplay().setMetEntities((met) => [...met, 'wren']); });
    await waitFor(() => expect(narrationNode()).not.toBe(node));
    const repainted = narrationNode();
    expect(repainted).toBeDefined();
    act(() => { gameplay().setChoices(['Wave']); });
    expect(narrationNode()).toBe(repainted);
    expect(quoteColor('Mind the ropes')).toBe('wren');
    await waitFor(() => expect(unmounts).toBeGreaterThan(0));
    removals.disconnect();
    expect(unmounts).toBe(1);
  });

  /** Plays a second turn whose stream stays open after its narration, and runs `during` while the renderer reveals it. */
  async function whileRevealing(during: () => void | Promise<void>) {
    const answer = vi.mocked(fetch);
    const LIVE = 'Mira nods slowly. "Quiet now," she says.';
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    let held = false;
    const encoder = new TextEncoder();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const system = (init?.body ? (JSON.parse(init.body as string) as { messages: { role: string; content: string }[] }).messages.find((m) => m.role === 'system')?.content : '') ?? '';
      const side = ['location router', 'where the player character is', 'characters in an interactive story go', 'player choice writer', 'stat tracker', 'inventory keeper'];
      if (!init?.body || side.some((marker) => system.includes(marker))) return answer(url, init);
      // Only the narration request is held; any later pass gets the plain narration back.
      if (held) return answer(url, init);
      held = true;
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) { stream = controller; controller.enqueue(encoder.encode(sseFrame({ content: LIVE }))); },
      }), { headers: { 'Content-Type': 'text/event-stream' } });
    }));
    fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: 'Nod back' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(gameplay().isRevealingNarration).toBe(true));
    await waitFor(() => expect([...document.querySelectorAll('p')].some((p) => p.textContent?.includes('Mira nods'))).toBe(true));
    await during();
    await act(async () => {
      stream.enqueue(encoder.encode(sseFrame({}, 'stop') + 'data: [DONE]\n\n'));
      stream.close();
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop generating' })).toBeNull(), { timeout: 10_000 });
  }
  const liveNode = () => [...document.querySelectorAll('p')].find((p) => p.textContent?.includes('Mira nods'));
  /** The paragraph and the three elements above it, up through the renderer's own output. */
  const liveChain = () => {
    const chain: (Element | null | undefined)[] = [liveNode()];
    for (let i = 0; i < 3; i += 1) chain.push(chain[i]?.parentElement);
    return chain;
  };
  /** The choices stream in and a background pass writes the earlier turn's summary. */
  const churn = (turnId: string) => {
    for (const lines of [['Wave'], ['Wave', 'Ask about the ship'], ['Wave', 'Ask about the ship', 'Leave']]) {
      act(() => { gameplay().setChoices(lines); });
    }
    act(() => {
      gameplay().setFullMessageHistory((history) => history.map((m) => {
        const turn = m.role === 'assistant' ? parseTurnContent(m.content) : null;
        return turn?.turnId === turnId ? { ...m, content: JSON.stringify({ ...turn, summary: 'Mira greets the player.' }) } : m;
      }));
    });
  };

  it.each(['pages', 'chat'] as const)('keeps the live narration node while choices and history writes land mid-reveal (%s layout)', async (layout) => {
    localStorage.setItem('FORMAMORPH_narrationLayout', layout);
    // jsdom has no layout: the chat list measures a zero-height scroller and draws no turn.
    if (layout === 'chat') {
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(800);
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
      Element.prototype.scrollTo = () => {};
    }
    const turnId = await playReadTurn();
    const earlier = narrationNode();
    await whileRevealing(() => {
      const node = liveNode();
      const chain = liveChain();
      expect(node).toBeDefined();
      seen.colors.clear();
      churn(turnId);
      expect(liveNode()).toBe(node);
      chain.forEach((el, i) => expect(liveChain()[i]).toBe(el));
      expect(seen.colors.size).toBeLessThanOrEqual(1);
      // The chat layout keeps every earlier turn too.
      if (layout === 'chat') expect(narrationNode()).toBe(earlier);
    });
  });

  it('keeps one speaker-color identity with the backstop out of the path', async () => {
    backstop.off = true;
    localStorage.setItem('FORMAMORPH_narrationLayout', 'pages');
    const turnId = await playReadTurn();
    await whileRevealing(() => {
      const node = liveNode();
      const chain = liveChain();
      seen.colors.clear();
      churn(turnId);
      expect(liveNode()).toBe(node);
      chain.forEach((el, i) => expect(liveChain()[i]).toBe(el));
      // A re-render re-adds the same identity, so one is the steady count; a rebuild adds a second.
      expect(seen.colors.size).toBeLessThanOrEqual(1);
    });
  });
});
