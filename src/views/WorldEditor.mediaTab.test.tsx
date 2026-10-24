import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { clickFlask, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import { PUBLISH_LIMITS } from '@/lib/publishLimits';
import { fakeDataUrl, mediaFixtureWorld } from '@/test/mediaFixture';
import { buildMediaIndex, formatMediaBytes, totalBytes } from '@/lib/mediaIndex';
import { downloadBlob } from '@/lib/downloadBlob';

/** The Media tab: a gallery of every media item in the world, and the panel for the picked card. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));
vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));
// The real viewers need a WebGL context jsdom has none of.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/views/ModelViewer', () => ({ default: () => <div data-testid="model-viewer" /> }));
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));

beforeEach(() => { localStorage.clear(); vi.mocked(downloadBlob).mockClear(); });

const section = (name: string) => screen.getByRole('region', { name });
/** A section's cards, each read as its kind (or "stack"), its count badge if any, and its text. */
const cards = (name: string) => Array.from(section(name).querySelectorAll<HTMLElement>('[data-media-card]'))
  .map((card) => `${card.dataset.mediaCard}: ${card.textContent}`);
const card = (name: string, kind: string, index = 0) =>
  section(name).querySelectorAll<HTMLElement>(`[data-media-card="${kind}"]`)[index];
const panel = () => document.querySelector<HTMLElement>('[data-media-panel]');
/** The open panel's Name field: a chip field on entities and locations, a plain input on a dictionary. */
const shownName = () => {
  const field = screen.getByLabelText('Name');
  return field instanceof HTMLInputElement ? field.value : field.textContent;
};

const openMedia = (mode: 'simple' | 'advanced') => {
  const bench = renderWorldEditorBench(mediaFixtureWorld(), mode);
  openEditorTab(/^Media$/);
  return bench;
};

const items = buildMediaIndex(mediaFixtureWorld());
const size = (parent: string, slot: string) => formatMediaBytes(items.find((i) => i.parent.name === parent && i.slot === slot)!.bytes);

describe('Media tab gallery', () => {
  it("stacks an entity's three images into one card with their total, and keeps its sound and 3D Model apart", () => {
    openMedia('advanced');
    const wickImages = items.filter((i) => i.parent.name === 'Odd Wick' && i.kind === 'image');

    expect(cards('Entities')).toEqual([
      // Image 2's rule shows on the stack.
      `stack: 1 rule3Odd Wick${formatMediaBytes(totalBytes(wickImages))}`,
      `sound: Odd Wick${size('Odd Wick', 'Sound')}`,
      `model: Odd Wick${size('Odd Wick', '3D Model')}`,
    ]);
  });

  it('shows a stack total in the warning color only when one of its images is over budget', () => {
    const world = mediaFixtureWorld();
    world.entities[0].images!.push({ data: fakeDataUrl('image/png', 700_000, 'q') });
    renderWorldEditorBench(world, 'advanced');
    openEditorTab(/^Media$/);
    const total = (name: string) => card(name, 'stack').lastElementChild!.lastElementChild!;

    expect(total('Entities')).toHaveClass('text-warning');
    expect(card('Entities', 'sound').lastElementChild!.lastElementChild!.querySelector('.text-warning')).toBeNull();
  });

  it('keeps a stack of images within budget in the plain color', () => {
    openMedia('advanced');

    expect(card('Entities', 'stack').lastElementChild!.lastElementChild!).not.toHaveClass('text-warning');
  });

  it('shows a one-image entity as a plain card, in its group\'s section', () => {
    openMedia('advanced');

    expect(cards('Entities › Crew › Deckhands')).toEqual([`image: Bram${size('Bram', 'Image 1')}`]);
    expect(screen.queryByRole('region', { name: 'Entities › Crew' })).toBeNull();
  });

  it('shows Avatars, 3D Models and Ambient Sound in Simple mode', () => {
    openMedia('simple');

    expect(cards('World › Avatars')).toEqual([
      `avatar: Fen Walker${size('World', 'Fen Walker')}`,
      `avatar: Spare${size('World', 'Spare')}`,
    ]);
    expect(card('Entities', 'model')).toBeDefined();
    expect(cards('Locations › Harbor Steps')).toContain(`sound: Lamp Room${size('Lamp Room', 'Ambient Sound')}`);
  });

  it('heads each section with its path and total', () => {
    openMedia('advanced');
    const world = items.filter((i) => i.parent.kind === 'world' && i.kind !== 'avatar');

    expect(within(section('World')).getByRole('button', { name: `World ${formatMediaBytes(totalBytes(world))}` })).toBeInTheDocument();
  });

  it('narrows the cards to a search on parent and slot names', () => {
    openMedia('advanced');
    fireEvent.change(screen.getByPlaceholderText('Search media'), { target: { value: 'ambient' } });

    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Locations › Harbor Steps']);
    expect(cards('Locations › Harbor Steps')).toEqual([`sound: Lamp Room${size('Lamp Room', 'Ambient Sound')}`]);
  });
});

describe('Media tab panels', () => {
  it("opens a stack's primary image, with its size and budget", () => {
    openMedia('advanced');
    fireEvent.click(card('Entities', 'stack'));

    expect(panel()).toHaveAttribute('data-media-panel', 'entity:wick:image:0');
    expect(within(panel()!).getByRole('heading')).toHaveTextContent('Odd Wick');
    expect(panel()!.querySelector('[data-media-framed]')).toHaveTextContent(`Image 1·${size('Odd Wick', 'Image 1')}· Budget ${formatMediaBytes(600_000)}`);
  });

  it("titles an entity's sound with the entity, plays it, and downloads it under the entity and slot", async () => {
    openMedia('advanced');
    fireEvent.click(card('Entities', 'sound'));

    expect(within(panel()!).getByRole('heading')).toHaveTextContent('Odd WickSound');
    expect(panel()!.querySelector('audio')).toHaveAttribute('src', mediaFixtureWorld().entities[0].sound!.data);
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'Odd Wick Sound.ogg'));
  });

  it('lists the entities that pick an Avatar, and shows it in the Avatar viewer', () => {
    openMedia('advanced');
    fireEvent.click(card('World › Avatars', 'avatar'));

    const usedBy = within(panel()!).getAllByRole('button').map((b) => b.textContent);
    expect(usedBy).toEqual(expect.arrayContaining(['Odd Wick', 'Bram']));
    expect(usedBy).not.toContain('Go to Overview');
    fireEvent.click(card('World › Avatars', 'avatar', 1));
    expect(panel()).toHaveTextContent('No entity uses this Avatar');
  });

  it('opens the 3D Model viewer for a 3D Model', () => {
    openMedia('advanced');
    fireEvent.click(card('Entities', 'model'));

    expect(within(panel()!).getByTestId('model-viewer')).toBeInTheDocument();
  });

  it('summarizes a section by kind and lists its largest items', () => {
    openMedia('advanced');
    fireEvent.click(within(section('Entities')).getAllByRole('button')[0]);

    expect(screen.getByRole('heading', { name: 'Entities' })).toBeInTheDocument();
    const largest = screen.getByRole('list');
    expect(within(largest).getAllByRole('button').map((b) => b.querySelector('.truncate')?.textContent)).toEqual([
      'Odd Wick › 3D Model', 'Odd Wick › Sound', 'Odd Wick › Image 1', 'Odd Wick › Image 2', 'Odd Wick › Image 3',
    ]);
  });
});

describe('Media tab Go to', () => {
  it.each([
    ['an entity', 'Entities', 'model', 'Go to Odd Wick', 'Entities', 'Odd Wick'],
    ['a location', 'Locations › Harbor Steps', 'sound', 'Go to Lamp Room', 'Locations', 'Lamp Room'],
    ['a dictionary', 'Dictionaries', 'image', 'Go to Fen Lore', 'Dictionary', 'Fen Lore'],
  ])('lands on %s that holds the item', (_what, sectionName, kind, label, tab, name) => {
    openMedia('advanced');
    fireEvent.click(card(sectionName, kind));
    fireEvent.click(within(panel()!).getByRole('button', { name: label }));

    expect(shownEditorTab()).toBe(tab);
    expect(shownName()).toBe(name);
  });

  it('lands on the Overview for world media', () => {
    openMedia('advanced');
    fireEvent.click(card('World', 'sound'));
    fireEvent.click(within(panel()!).getByRole('button', { name: 'Go to Overview' }));

    expect(shownEditorTab()).toBe('Overview');
  });
});

describe('Media tab header', () => {
  const header = () => document.querySelector<HTMLElement>('[data-media-header]')!;
  const headerMeter = () => within(header()).getByRole('meter', { name: 'Publish Size' });
  const sectionNames = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
  const pickFilter = (name: string) => {
    fireEvent.click(within(header()).getByRole('button', { name: /^Filter/ }));
    fireEvent.click(screen.getByRole('button', { name }));
  };

  it('holds the meter and the icon controls in one row above the search', () => {
    openMedia('advanced');

    expect(within(header()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['More info', 'Group by Type', 'Largest First', 'Filter', 'Optimize Images']);
    expect(header().compareDocumentPosition(screen.getByPlaceholderText('Search media')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reads the same figure and band as the World Doctor's bar for the same world", async () => {
    const limit = PUBLISH_LIMITS.world;
    // A lowered limit puts the fixture world in the red band.
    PUBLISH_LIMITS.world = 20_000;
    try {
      openMedia('advanced');
      await waitFor(() => expect(Number(headerMeter().getAttribute('aria-valuenow'))).toBeGreaterThan(0));
      await clickFlask();
      const doctor = (await screen.findAllByRole('meter', { name: 'Publish Size' })).find((m) => !header().contains(m))!;

      expect(headerMeter().getAttribute('aria-valuetext')).toBe(doctor.getAttribute('aria-valuetext')!.replace(' of ', ' / '));
      expect(headerMeter()).toHaveAttribute('data-band', 'red');
      expect(doctor).toHaveAttribute('data-band', 'red');
    } finally {
      PUBLISH_LIMITS.world = limit;
    }
  });

  it('groups by type with parent names on the cards, and back by parent', () => {
    openMedia('advanced');
    fireEvent.click(screen.getByRole('button', { name: 'Group by Type' }));

    expect(sectionNames()).toEqual(['Images', 'Sounds', '3D Models', 'Avatars']);
    expect(cards('Sounds')).toEqual([
      `sound: Background Music${size('World', 'Background Music')}`,
      `sound: Odd Wick${size('Odd Wick', 'Sound')}`,
      `sound: Lamp Room${size('Lamp Room', 'Ambient Sound')}`,
    ]);
    expect(cards('Images').filter((c) => c.startsWith('stack'))).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Group by Type' }));
    expect(sectionNames()[0]).toBe('World');
  });

  it("sorts each section's cards largest first, and restores author order when off", () => {
    openMedia('advanced');
    const order = () => cards('Entities').map((c) => c.split(':')[0]);
    expect(order()).toEqual(['stack', 'sound', 'model']);

    fireEvent.click(screen.getByRole('button', { name: 'Largest First' }));
    expect(order()).toEqual(['model', 'stack', 'sound']);

    fireEvent.click(screen.getByRole('button', { name: 'Largest First' }));
    expect(order()).toEqual(['stack', 'sound', 'model']);
  });

  it.each([
    ['Linked', ['Entities']],
    ['Embedded', ['World', 'World › Avatars', 'Entities', 'Entities › Crew › Deckhands', 'Locations', 'Locations › Harbor Steps', 'Dictionaries']],
    ['Has Visibility Rules', ['Entities']],
    ['Over Size Budget', ['Entities › Crew › Deckhands']],
  ])('narrows the gallery under %s, and names the filter on its button', (name, sections) => {
    openMedia('advanced');
    pickFilter(name);

    expect(sectionNames()).toEqual(sections);
    expect(within(header()).getByRole('button', { name: `Filter: ${name}` })).toHaveTextContent(name);
  });

  it('forms a stack from the images that pass the filter', () => {
    openMedia('advanced');
    pickFilter('Linked');

    expect(cards('Entities')).toEqual(['image: Odd WickLinked']);
  });

  it('keeps grouping and Largest First when the editor reopens, resets the filter, and leaves the world alone', () => {
    const bench = openMedia('advanced');
    const before = JSON.stringify(bench.ctx().getWorldData());
    fireEvent.click(screen.getByRole('button', { name: 'Group by Type' }));
    fireEvent.click(screen.getByRole('button', { name: 'Largest First' }));
    pickFilter('Linked');

    bench.reopen();
    openEditorTab(/^Media$/);

    expect(screen.getByRole('button', { name: 'Group by Type' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Largest First' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(JSON.stringify(bench.ctx().getWorldData())).toBe(before);
  });

  it('opens the Media tab from the over-limit finding', async () => {
    const limit = PUBLISH_LIMITS.world;
    PUBLISH_LIMITS.world = 2_000;
    try {
      renderWorldEditorBench(mediaFixtureWorld(), 'advanced');
      await clickFlask();
      expect(shownEditorTab()).not.toBe('Media');
      fireEvent.click(await screen.findByRole('button', { name: 'Sedge Landing' }));

      expect(shownEditorTab()).toBe('Media');
    } finally {
      PUBLISH_LIMITS.world = limit;
    }
  });
});
