import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderMiddlePanel, statFixture, type TurnFixture } from '@/test/gamePanels';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'Rain on the forest road.', turnId: 't1', sceneTags: '1boy, forest' },
  { action: 'I walk to the dock.', narration: 'The dock creaks.', turnId: 't2' },
];
const STATS = [statFixture('Vigor', 50)];
const IMAGES = ['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB', 'data:image/png;base64,CCCC'];

const plate = () => screen.queryByRole('button', { name: 'Zoom image' });
const shown = () => plate()?.querySelector('img')?.getAttribute('src');

describe('MiddlePanel — the Scene Plate in Pages', () => {
  it('shows no plate on a turn with no image', () => {
    renderMiddlePanel({}, { turns: TURNS, stats: STATS });
    expect(plate()).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows the newest image at the top of the card, above the action line and the narration', () => {
    renderMiddlePanel({ sceneImages: IMAGES }, { turns: TURNS, stats: STATS });
    expect(shown()).toBe(IMAGES[2]);
    const follows = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(plate()!, screen.getByTestId('action-line'))).toBe(true);
    expect(follows(plate()!, screen.getByTestId('narration'))).toBe(true);
    // The scene panel under the narration shows no second copy.
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('deletes the image in view, by turn id and index', () => {
    const view = renderMiddlePanel({ sceneImages: IMAGES }, { turns: TURNS, stats: STATS });
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete this image' }));
    expect(view.props.onDeleteSceneImage).toHaveBeenCalledWith('t2', 1);
  });

  it('opens another turn on its newest image', () => {
    const view = renderMiddlePanel({ sceneImages: IMAGES }, { turns: TURNS, stats: STATS });
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(shown()).toBe(IMAGES[0]);

    act(() => { view.gameplay().setUserPage(1); });
    view.setProps({ sceneTurnId: 't1', sceneTags: '1boy, forest', sceneImages: IMAGES });
    expect(shown()).toBe(IMAGES[2]);
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });

  it('keeps the tag row under the narration on a turn with an image and no tag line', () => {
    renderMiddlePanel({ sceneImages: IMAGES }, { turns: TURNS, stats: STATS });
    expect(screen.getByRole('button', { name: /^Tags$/ })).toBeInTheDocument();
  });

  it('shows the live frame under the narration while a render runs', () => {
    renderMiddlePanel(
      { sceneImages: IMAGES, sceneImageJob: 'image', sceneImagePreview: 'data:image/jpeg;base64,LIVE', sceneImageProgress: 0.4 },
      { turns: TURNS, stats: STATS },
    );
    expect(screen.getByRole('img', { name: 'Drawing…' })).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(shown()).toBe(IMAGES[2]);
  });
});
