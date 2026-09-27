// Storage is real (in-memory): the drift guard mounts the actual settings provider.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { LOCAL_SETTINGS_DEFAULTS, useLocalSettingsSource } from './useLocalSettingsSource';

/** The settings the provider hands out on a fresh install. */
function freshSettings() {
  let seen: ReturnType<typeof useSettings> | null = null;
  const Probe = () => { seen = useSettings(); return null; };
  render(<SettingsProvider><Probe /></SettingsProvider>);
  return seen as unknown as Record<string, unknown>;
}

const noReport = () => {};

beforeEach(() => localStorage.clear());

// The theme lives in the theme provider, not the settings context.
const storedKeys = (Object.keys(LOCAL_SETTINGS_DEFAULTS) as (keyof typeof LOCAL_SETTINGS_DEFAULTS)[])
  .filter((key) => key !== 'theme');

describe('the local defaults match a fresh install', () => {
  it.each(storedKeys)('%s', (key) => {
    expect(freshSettings()[key]).toEqual(LOCAL_SETTINGS_DEFAULTS[key]);
  });

  it.each(['reasoningEffort', 'revealSpec', 'reasoningCapability', 'imageGenDisabled'] as const)('derived %s', (key) => {
    const { result } = renderHook(() => useLocalSettingsSource(noReport));
    expect(result.current[key]).toEqual(freshSettings()[key]);
  });
});

describe('the local source', () => {
  it('keeps changes in memory', () => {
    const rootTheme = document.documentElement.getAttribute('data-theme');
    const { result } = renderHook(() => useLocalSettingsSource(noReport));
    act(() => result.current.setSemanticBandCap(20));
    act(() => result.current.setThemeColor('purple'));
    expect(result.current.semanticBandCap).toBe(20);
    expect(result.current.themeColor).toBe('purple');
    expect(localStorage).toHaveLength(0);
    expect(document.documentElement.getAttribute('data-theme')).toBe(rootTheme);
  });

  it('reports the theme and the embedding model instead of acting on them', () => {
    const reports: string[] = [];
    const { result } = renderHook(() => useLocalSettingsSource((status) => reports.push(status)));
    act(() => result.current.setTheme('dark'));
    act(() => result.current.embeddingModel.start());
    act(() => result.current.embeddingModel.dispose());
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(reports).toEqual([
      expect.stringContaining('Dark theme'),
      expect.stringContaining('skipped the download'),
      expect.stringContaining('skipped the unload'),
    ]);
    expect(localStorage).toHaveLength(0);
  });

  it('edits the quote color of the reference theme', () => {
    const { result } = renderHook(() => useLocalSettingsSource(noReport));
    act(() => result.current.setTheme('dark'));
    act(() => result.current.setActiveQuoteColor('#112233'));
    expect(result.current.quoteColorMode).toBe('dark');
    expect(result.current.activeQuoteColor).toBe('#112233');
    act(() => result.current.setTheme('light'));
    expect(result.current.activeQuoteColor).toBeNull();
  });
});
