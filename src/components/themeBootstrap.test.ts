// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BASE_THEME_COLOR, DEFAULT_THEME_COLOR, THEME_COLORS } from '@/contexts/settingsDefaults';

const html = readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

/** Runs the index.html bootstrap against the given storage and OS media state. */
function boot({ mode, color, dark = false, moreContrast = false }: {
  mode?: string; color?: string; dark?: boolean; moreContrast?: boolean;
}) {
  const root = document.documentElement;
  root.className = '';
  root.removeAttribute('data-theme');
  localStorage.clear();
  if (mode !== undefined) localStorage.setItem('vite-ui-theme', mode);
  if (color !== undefined) localStorage.setItem('FORMAMORPH_themeColor', color);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: (query === '(prefers-color-scheme: dark)' && dark) || (query === '(prefers-contrast: more)' && moreContrast),
  }));
  new Function(script)();
  return { mode: root.className, theme: root.getAttribute('data-theme') };
}

afterEach(() => vi.unstubAllGlobals());

describe('index.html theme bootstrap', () => {
  it('applies every stored preset, leaving the base preset unattributed', () => {
    for (const { value } of THEME_COLORS) {
      expect(boot({ color: value }).theme).toBe(value === BASE_THEME_COLOR ? null : value);
    }
  });

  it('falls back to the default preset for an unknown stored value', () => {
    expect(boot({ color: 'retired-preset' }).theme).toBe(DEFAULT_THEME_COLOR);
  });

  it('seeds high contrast only for a first run that follows the system', () => {
    expect(boot({ moreContrast: true }).theme).toBe('highcontrast');
    expect(boot({ mode: 'system', moreContrast: true }).theme).toBe('highcontrast');
    expect(boot({ mode: 'dark', moreContrast: true }).theme).toBe(DEFAULT_THEME_COLOR);
    expect(boot({ color: 'rose', moreContrast: true }).theme).toBe('rose');
    expect(boot({ color: 'retired-preset', moreContrast: true }).theme).toBe(DEFAULT_THEME_COLOR);
  });

  it('applies the stored mode, else the OS mode', () => {
    expect(boot({ mode: 'dark' }).mode).toBe('dark');
    expect(boot({ mode: 'light', dark: true }).mode).toBe('light');
    expect(boot({ dark: true }).mode).toBe('dark');
    expect(boot({ mode: 'system' }).mode).toBe('light');
  });
});
