import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBenchTab } from './useBenchTab';

const mount = (props: { open: boolean }) =>
  renderHook(({ open }) => useBenchTab('w1', { open }), { initialProps: props });

beforeEach(() => sessionStorage.clear());

describe('useBenchTab', () => {
  it('opens on the default Instrument when the session remembers nothing', () => {
    const { result } = mount({ open: true });
    expect(result.current.tab).toBe('issues');
  });

  it('reopens on the Instrument the author was last using — the mobile sheet closing is not a reset', () => {
    const first = mount({ open: true });
    act(() => { first.result.current.setTab('opening'); });
    first.unmount();

    const second = mount({ open: true });
    expect(second.result.current.tab).toBe('opening');
  });

  it('falls back to the default when the stored tab names an Instrument that isn’t built', () => {
    sessionStorage.setItem('FORMAMORPH_benchTab', JSON.stringify({ w1: 'holodeck' }));
    const { result } = mount({ open: true });
    expect(result.current.tab).toBe('issues');
  });

  it('seeds only when the Bench opens, so each world lands on its own remembered tab', () => {
    sessionStorage.setItem('FORMAMORPH_benchTab', JSON.stringify({ w1: 'triggers' }));
    const { result, rerender } = mount({ open: false });
    expect(result.current.tab).toBe('issues');
    rerender({ open: true });
    expect(result.current.tab).toBe('triggers');
  });

  it('records nothing until the author switches, so a seed is not a choice', () => {
    mount({ open: true });
    expect(sessionStorage.getItem('FORMAMORPH_benchTab')).toBeNull();
  });

  it('shows a routed tab across the open without recording it', () => {
    // The dev-router routes the tab and then opens; the seed must land on the route, not fight it —
    // and the route is a view override, so the session record stays untouched.
    const { result, rerender } = mount({ open: false });
    act(() => { result.current.routeTab('aiContext'); });
    rerender({ open: true });
    expect(result.current.tab).toBe('aiContext');
    expect(sessionStorage.getItem('FORMAMORPH_benchTab')).toBeNull();
  });

  it('spends the route on one seed, so a reopen lands on the author’s own tab again', () => {
    sessionStorage.setItem('FORMAMORPH_benchTab', JSON.stringify({ w1: 'triggers' }));
    const { result, rerender } = mount({ open: false });
    act(() => { result.current.routeTab('aiContext'); });
    rerender({ open: true });
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current.tab).toBe('triggers');
  });
});
