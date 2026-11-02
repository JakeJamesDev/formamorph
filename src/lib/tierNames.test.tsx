import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTierNames, resetTierNamesForTest, tierName, useTierName } from './tierNames';

const CACHE_KEY = 'formamorph.tierNames';

const answer = (data: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve({ success: ok, data }) });

function Probe() {
  const nameOf = useTierName();
  return <p>{nameOf('supporter_plus')}</p>;
}

describe('tier names', () => {
  beforeEach(() => {
    localStorage.clear();
    resetTierNamesForTest();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the server name and caches it', async () => {
    vi.stubGlobal('fetch', answer({ supporter: 'Patron', supporter_plus: 'Patron Plus', supporter_top: null }));

    await loadTierNames();

    expect(tierName('supporter_plus')).toBe('Patron Plus');
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual({ supporter: 'Patron', supporter_plus: 'Patron Plus' });
  });

  it('shows the cached name when the server cannot be reached', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ supporter_plus: 'Cached Plus' }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await loadTierNames();

    expect(tierName('supporter_plus')).toBe('Cached Plus');
  });

  it('shows Member for a tier with no server name and no cache', async () => {
    vi.stubGlobal('fetch', answer({ supporter: 'Patron', supporter_plus: null, supporter_top: '  ' }));

    await loadTierNames();

    expect(tierName('supporter')).toBe('Patron');
    expect(tierName('supporter_plus')).toBe('Member');
    expect(tierName('supporter_top')).toBe('Member');
  });

  it('shows Member before any answer when nothing is cached', () => {
    expect(tierName('supporter')).toBe('Member');
  });

  it('keeps the cache when the server refuses', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ supporter: 'Cached' }));
    vi.stubGlobal('fetch', answer(null, false));

    await loadTierNames();

    expect(tierName('supporter')).toBe('Cached');
  });

  it('keeps a cached name for a tier the server cannot name yet', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ supporter: 'Cached', supporter_plus: 'Cached Plus' }));
    vi.stubGlobal('fetch', answer({ supporter: null, supporter_plus: 'Fresh Plus', supporter_top: null }));

    await loadTierNames();

    expect(tierName('supporter')).toBe('Cached');
    expect(tierName('supporter_plus')).toBe('Fresh Plus');
  });

  it('keeps the cache when the answer is not a name map', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ supporter: 'Cached' }));
    vi.stubGlobal('fetch', answer('not a map'));

    await loadTierNames();

    expect(tierName('supporter')).toBe('Cached');
  });

  it('serves the names for the session when storage is blocked', async () => {
    vi.stubGlobal('fetch', answer({ supporter: 'Patron' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

    await loadTierNames();

    expect(tierName('supporter')).toBe('Patron');
    vi.restoreAllMocks();
  });

  it('asks the server once per session', async () => {
    const fetchMock = answer({ supporter: 'Patron' });
    vi.stubGlobal('fetch', fetchMock);

    await loadTierNames();
    await loadTierNames();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('updates a mounted component when the answer arrives', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ supporter_plus: 'Cached Plus' }));
    vi.stubGlobal('fetch', answer({ supporter_plus: 'Fresh Plus' }));

    render(<Probe />);
    expect(screen.getByText('Cached Plus')).toBeTruthy();

    await act(async () => { await loadTierNames(); });

    expect(await screen.findByText('Fresh Plus')).toBeTruthy();
  });
});
