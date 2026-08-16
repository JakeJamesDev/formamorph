import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReadmeModal from './ReadmeModal';
import { useReadmeVisibility } from '@/lib/useReadmeVisibility';

/**
 * The readme modal in both of its jobs — the Introduction over the enter-world flow and the Gameplay
 * readme in play. The flag cases run against the real `useReadmeVisibility`, since the thing worth
 * guarding is that the two modals share one per-world answer rather than each carrying its own.
 */

const WORLD = 'world-1';

/**
 * One readme modal on the per-world flag, wired the way both of the app's screens wire it. The two never
 * share a screen — the Introduction is on the main menu, the Gameplay one in play — so the shared-flag
 * cases mount them one after the other rather than side by side.
 */
function OneReadme({ title, text }: { title?: string; text: string }) {
  const { showReadme, setShowReadme } = useReadmeVisibility();
  return (
    <ReadmeModal
      title={title}
      readme={text}
      open
      onOpenChange={() => {}}
      show={showReadme(WORLD)}
      onShowChange={(s) => setShowReadme(WORLD, s)}
    />
  );
}

const dontShowBox = () => screen.getByRole('checkbox', { name: "Don't Show This Again" });

describe('ReadmeModal', () => {
  beforeEach(() => localStorage.clear());

  it('titles itself for the phase it belongs to', () => {
    render(
      <ReadmeModal title="Introduction" readme="hello" open onOpenChange={() => {}} show onShowChange={() => {}} />,
    );
    expect(screen.getByRole('heading', { name: 'Introduction' })).toBeInTheDocument();
  });

  it('still titles itself Readme for the gameplay phase, which passes no title', () => {
    render(<ReadmeModal readme="hello" open onOpenChange={() => {}} show onShowChange={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Readme' })).toBeInTheDocument();
  });

  it('renders its text as markdown', () => {
    render(
      <ReadmeModal
        title="Introduction"
        readme={'# Sedge Landing\n\nA **damp** welcome.'}
        open
        onOpenChange={() => {}}
        show
        onShowChange={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Sedge Landing' })).toBeInTheDocument();
    // Streamdown renders emphasis as a tagged span rather than a `<strong>`.
    expect(screen.getByText('damp')).toHaveAttribute('data-streamdown', 'strong');
  });

  it('shows nothing while closed', () => {
    render(
      <ReadmeModal title="Introduction" readme="# Sedge Landing" open={false} onOpenChange={() => {}} show onShowChange={() => {}} />,
    );
    expect(screen.queryByRole('heading', { name: 'Sedge Landing' })).toBeNull();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ReadmeModal title="Introduction" readme="hello" open onOpenChange={onOpenChange} show onShowChange={() => {}} />,
    );
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ticking Don't Show This Again on the Introduction answers for the Gameplay readme too", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<OneReadme title="Introduction" text="# Intro" />);
    expect(dontShowBox()).not.toBeChecked();

    await user.click(dontShowBox());
    expect(JSON.parse(localStorage.getItem('FORMAMORPH_readmeHiddenWorlds') || '[]')).toEqual([WORLD]);
    unmount();

    // The Gameplay readme, one screen later: it reads the very same per-world answer.
    render(<OneReadme text="# Gameplay" />);
    expect(dontShowBox()).toBeChecked();
  });

  it('opens with the box already ticked for a world the player has hidden', () => {
    localStorage.setItem('FORMAMORPH_readmeHiddenWorlds', JSON.stringify([WORLD]));
    render(<OneReadme title="Introduction" text="# Intro" />);
    expect(dontShowBox()).toBeChecked();
  });
});
