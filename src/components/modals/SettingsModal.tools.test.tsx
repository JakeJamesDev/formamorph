// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { useEffect, useRef } from 'react';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import type { Tool } from '@/types';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download. Neither
// runs in jsdom, and neither is what these tests are about.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const weather: Tool = {
  id: 'u-weather', name: 'get_weather', description: 'Purpose: weather.', params: [],
  handler: { kind: 'template', body: 'Sunny.' }, emptyResult: '', offeredTo: ['narration'], enabled: true,
};

/** A user preset holding one Tool, as a player who made one would have. */
function SeedUserTool() {
  const { addPreset, saveTool } = useSettings();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    addPreset('Mine');
    saveTool(weather);
  }, [addPreset, saveTool]);
  return null;
}

const open = (mode: 'advanced' | 'simple', seed = false) => render(
  <ThemeProvider>
    <SettingsProvider>
      {seed && <SeedUserTool />}
      <SettingsModal isOpen onOpenChange={() => {}} forcedMode={mode} initialTab={mode === 'advanced' ? 'tools' : undefined} />
    </SettingsProvider>
  </ThemeProvider>,
);

const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);

describe('Settings → Tools', () => {
  it('sits between Prompts and Endpoints in Advanced, and is absent in Simple', () => {
    const { unmount } = open('advanced');
    expect(tabNames()).toEqual(['Display', 'Output', 'Prompts', 'Tools', 'Endpoints', 'Data']);
    unmount();
    open('simple');
    expect(tabNames()).not.toContain('Tools');
  });

  it('tells the player an endpoint with unknown Tool support won’t receive Tools', () => {
    open('advanced');
    expect(screen.getByRole('note')).toHaveTextContent("Your text endpoint won't receive Tools");
  });

  it('keeps the selected Tool across full screen and back', async () => {
    // The morph refuses to grow out of a zero-size rect, and jsdom lays nothing out.
    const rect = { left: 10, top: 10, width: 300, height: 200, right: 310, bottom: 210, x: 10, y: 10, toJSON: () => ({}) } as DOMRect;
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    try {
      open('advanced', true);
      const list = () => within(screen.getByRole('navigation', { name: 'Tools', hidden: true }));
      fireEvent.click(await waitFor(() => list().getByRole('button', { name: 'get_weather', hidden: true })));
      const heading = () => screen.getByRole('heading', { level: 3, hidden: true }).textContent;
      expect(heading()).toBe('get_weather');

      fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
      const window = screen.getByRole('dialog', { name: 'Tools' });
      expect(within(window).getByRole('heading', { level: 3 })).toHaveTextContent('get_weather');

      fireEvent.click(within(window).getByRole('button', { name: 'Exit full screen' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tools' })).toBeNull());
      expect(heading()).toBe('get_weather');
    } finally {
      spy.mockRestore();
    }
  });
});
