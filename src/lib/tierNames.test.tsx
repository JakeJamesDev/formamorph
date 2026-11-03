import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTierNames, resetTierNamesForTest, tierName, useTierName, useTierPrice, useTierTitle } from './tierNames';

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

  describe('prices', () => {
    const PRICES_KEY = 'formamorph.tierPrices';

    function PriceProbe() {
      const priceOf = useTierPrice();
      const titleOf = useTierTitle();
      return <p>{`${titleOf('supporter') ?? 'unnamed'}: ${priceOf('supporter') ?? 'no price'}`}</p>;
    }

    it('reads whole cents from the reply beside the titles', async () => {
      vi.stubGlobal('fetch', answer({ supporter: 'Patron', prices: { supporter: 500, supporter_plus: null, supporter_top: 12.5 } }));

      render(<PriceProbe />);
      expect(await screen.findByText('Patron: 500')).toBeTruthy();
      expect(JSON.parse(localStorage.getItem(PRICES_KEY)!)).toEqual({ supporter: 500 });
    });

    it('never reads the prices field as a tier name', async () => {
      vi.stubGlobal('fetch', answer({ supporter: 'Patron', prices: { supporter: 500 } }));

      await loadTierNames();

      expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual({ supporter: 'Patron' });
    });

    it('hides a cached price when a server reply has no prices field', async () => {
      localStorage.setItem(PRICES_KEY, JSON.stringify({ supporter: 500 }));
      vi.stubGlobal('fetch', answer({ supporter: 'Patron' }));

      render(<PriceProbe />);
      expect(screen.getByText('unnamed: 500')).toBeTruthy();
      expect(await screen.findByText('Patron: no price')).toBeTruthy();
    });

    it('keeps the cached price when the server cannot be reached', async () => {
      localStorage.setItem(PRICES_KEY, JSON.stringify({ supporter: 500 }));
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      render(<PriceProbe />);
      await act(async () => { await loadTierNames(); });

      expect(screen.getByText('unnamed: 500')).toBeTruthy();
    });

    it('leaves a tier with no name undefined for the caller, where the shared fallback stays Member', async () => {
      vi.stubGlobal('fetch', answer({}));

      render(<PriceProbe />);
      await act(async () => { await loadTierNames(); });

      expect(screen.getByText('unnamed: no price')).toBeTruthy();
      expect(tierName('supporter')).toBe('Member');
    });
  });
});
