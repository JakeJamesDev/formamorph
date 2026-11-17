import 'fake-indexeddb/auto';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { panelWorld, renderPanelBench } from '@/test/panelBench';
import { resolveSound } from '@/lib/mediaSounds';
import type { World } from '@/types';
import WorldOverviewManager from './WorldOverviewManager';

/** The Media List sound slot, on the world's Background Music. */

const GROWL = 'data:audio/ogg;base64,R1JPV0w=';
const PORTRAIT = 'data:image/png;base64,UE9SVA==';
const WIND = 'https://host.example/sounds/wind.ogg';

const world = (): World => panelWorld({
  entities: [{
    id: 'wick', name: 'Odd Wick', playerDescription: '', aiDescription: '', locations: ['harbor'],
    images: [{ data: PORTRAIT, name: 'Wick portrait' }],
    sound: { data: GROWL, type: 'audio/ogg', name: 'growl.ogg' },
  }],
} as Partial<World>);

type Bench = ReturnType<typeof renderPanelBench>;
const mount = () => renderPanelBench(world(), 'simple', <WorldOverviewManager />);
const slot = () => document.querySelector<HTMLElement>('[data-sound-slot="world-bgm"]')!;
const list = (bench: Bench) => bench.ctx().worldOverview.mediaList ?? {};
const music = (bench: Bench) => bench.ctx().worldOverview.bgm;
const musicEntry = (bench: Bench) => {
  const bgm = music(bench);
  return bgm && typeof bgm === 'object' ? list(bench)[bgm.mediaId] : undefined;
};

describe('Media List sound slot', () => {
  it('imports a file as a named entry and links it', async () => {
    const bench = mount();
    const input = slot().querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['theme'], 'harbor theme.mp3', { type: 'audio/mpeg' })] } });
    });

    await waitFor(() => expect(musicEntry(bench)).toMatchObject({ name: 'harbor theme', kind: 'sound', type: 'audio/mpeg' }));
    expect(within(slot()).getByRole('textbox', { name: 'Sound Name' })).toHaveValue('harbor theme');
  });

  it('chooses from the sounds only, and links the picked entry without adding one', async () => {
    const bench = mount();
    const before = Object.keys(list(bench)).length;
    fireEvent.click(within(slot()).getByRole('button', { name: 'Choose' }));

    const picker = document.querySelector<HTMLElement>('[data-media-choose]')!;
    const names = [...picker.querySelectorAll('[data-media-entry]')].map((b) => b.textContent);
    expect(names).toEqual(['growl']);
    await act(async () => { fireEvent.click(within(picker).getByRole('button', { name: 'growl' })); });

    expect(musicEntry(bench)?.name).toBe('growl');
    expect(Object.keys(list(bench))).toHaveLength(before);
  });

  it('adds a pasted https sound URL as a linked entry that plays from the link', async () => {
    const bench = mount();
    fireEvent.change(within(slot()).getByRole('textbox', { name: 'Sound URL' }), { target: { value: WIND } });
    await act(async () => { fireEvent.keyDown(within(slot()).getByRole('textbox', { name: 'Sound URL' }), { key: 'Enter' }); });

    expect(musicEntry(bench)).toMatchObject({ name: 'wind', kind: 'sound', data: WIND });
    expect(resolveSound(music(bench), list(bench))?.data).toBe(WIND);
    expect(slot().querySelector('audio')).toHaveAttribute('src', WIND);
    expect(within(slot()).getByText('Linked')).toBeInTheDocument();
  });

  it('refuses a pasted link that is not http or https', async () => {
    const bench = mount();
    fireEvent.change(within(slot()).getByRole('textbox', { name: 'Sound URL' }), { target: { value: 'ftp://host/a.ogg' } });
    await act(async () => { fireEvent.keyDown(within(slot()).getByRole('textbox', { name: 'Sound URL' }), { key: 'Enter' }); });
    expect(music(bench)).toBeNull();
    expect(screen.getByText("That isn't a web link. Enter one that starts with http:// or https://")).toBeInTheDocument();
  });

  it('shows the broken state when a linked sound fails to load', async () => {
    mount();
    fireEvent.change(within(slot()).getByRole('textbox', { name: 'Sound URL' }), { target: { value: WIND } });
    await act(async () => { fireEvent.keyDown(within(slot()).getByRole('textbox', { name: 'Sound URL' }), { key: 'Enter' }); });
    expect(slot().querySelector('[data-sound-broken]')).toBeNull();

    await act(async () => { fireEvent.error(slot().querySelector('audio')!); });

    expect(slot().querySelector('[data-sound-broken]')).toHaveTextContent("This sound couldn't be loaded. Check the link.");
  });

  it('frees the slot on Remove From Slot and keeps the entry', async () => {
    const bench = mount();
    fireEvent.click(within(slot()).getByRole('button', { name: 'Choose' }));
    await act(async () => { fireEvent.click(within(document.querySelector<HTMLElement>('[data-media-choose]')!).getByRole('button', { name: 'growl' })); });
    const id = musicEntry(bench)!.id;

    await act(async () => { fireEvent.click(within(slot()).getByRole('button', { name: 'Remove From Slot' })); });

    expect(music(bench)).toBeNull();
    expect(list(bench)[id]).toBeDefined();
    expect(within(slot()).getByRole('button', { name: 'Choose' })).toBeInTheDocument();
  });
});
