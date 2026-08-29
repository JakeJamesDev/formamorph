import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SceneImagePanel } from './SceneImagePanel';

const IMG = ['data:image/png;base64,AAA', 'data:image/png;base64,BBB', 'data:image/png;base64,CCC'];

const props = {
  images: [] as string[],
  tags: '',
  ready: true,
  job: null as 'tags' | 'image' | null,
  progress: null as number | null,
  preview: null as string | null,
  onGenerate: vi.fn(),
  onRegenerateTags: vi.fn(),
  onCancel: vi.fn(),
  onDelete: vi.fn(),
};

const img = () => screen.getByRole('img') as HTMLImageElement;

// The tag field is a Lexical chip editor whose caret jsdom cannot drive. These cases are about the draft
// and re-roll logic around it, so it stands in as a plain textarea; the field itself is covered by
// src/components/prompt/TagChipField.test.tsx.
vi.mock('@/components/prompt/TagChipField', () => ({
  default: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

describe('SceneImagePanel', () => {
  it('renders nothing for a turn with no image, no tags and nothing in flight', () => {
    const { container } = render(<SceneImagePanel {...props} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing at all before the page holds a committed turn', () => {
    const { container } = render(<SceneImagePanel {...props} ready={false} images={IMG} tags="1girl" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('re-rolls the tag line without drawing', () => {
    const onRegenerateTags = vi.fn();
    const onGenerate = vi.fn();
    render(<SceneImagePanel {...props} tags="1girl, dock" onRegenerateTags={onRegenerateTags} onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole('button', { name: /^Tags$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Re-roll tags/ }));
    expect(onRegenerateTags).toHaveBeenCalled();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('offers the tag row on a turn that has tags but no image yet', () => {
    render(<SceneImagePanel {...props} tags="1girl, dock" />);
    expect(screen.getByRole('button', { name: /^Tags$/ })).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('says which half of the pipeline is running', () => {
    const { rerender } = render(<SceneImagePanel {...props} job="tags" />);
    expect(screen.getByText(/Writing tags/)).toBeInTheDocument();
    // A tag re-roll reports no progress even on a provider that would report it for a render.
    rerender(<SceneImagePanel {...props} job="tags" progress={0.5} />);
    expect(screen.getByText(/Writing tags/)).toBeInTheDocument();
    rerender(<SceneImagePanel {...props} job="image" progress={0.5} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('opens on the newest image and browses back through the older ones', () => {
    render(<SceneImagePanel {...props} images={IMG} tags="1girl" />);
    expect(img().src).toContain('CCC');
    expect(screen.getByText('3/3')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Previous image'));
    expect(img().src).toContain('BBB');
    expect(screen.getByText('2/3')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next image'));
    expect(img().src).toContain('CCC');
    expect(screen.getByLabelText('Next image')).toBeDisabled();
  });

  it('hides the arrows for a single image', () => {
    render(<SceneImagePanel {...props} images={[IMG[0]]} tags="1girl" />);
    expect(screen.queryByLabelText('Previous image')).toBeNull();
  });

  it('deletes the image being viewed, not the newest', () => {
    const onDelete = vi.fn();
    render(<SceneImagePanel {...props} images={IMG} tags="1girl" onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('Previous image')); // now on index 1
    fireEvent.click(screen.getByLabelText('Delete this image'));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('re-reads the narration when the tags are untouched, and sends them verbatim once edited', () => {
    const onGenerate = vi.fn();
    render(<SceneImagePanel {...props} images={[IMG[0]]} tags="1girl, dock" onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole('button', { name: /^Tags$/ }));

    fireEvent.click(screen.getByRole('button', { name: /Draw again/ }));
    expect(onGenerate).toHaveBeenLastCalledWith(undefined);

    fireEvent.change(screen.getByLabelText('Scene tags'), { target: { value: '1girl, dock, sunset' } });
    fireEvent.click(screen.getByRole('button', { name: /Draw these tags/ }));
    expect(onGenerate).toHaveBeenLastCalledWith('1girl, dock, sunset');
  });

  it('restores the field after a re-roll that returned the same line', () => {
    // The bug this guards: keyed off the tag VALUE changing, an identical re-roll left the field blank and
    // the Draw button would then have sent nothing.
    const { rerender } = render(<SceneImagePanel {...props} tags="1girl, dock" />);
    fireEvent.click(screen.getByRole('button', { name: /^Tags$/ }));
    rerender(<SceneImagePanel {...props} tags="1girl, dock" job="tags" />);
    rerender(<SceneImagePanel {...props} tags="1girl, dock" job={null} />);
    expect((screen.getByLabelText('Scene tags') as HTMLTextAreaElement).value).toBe('1girl, dock');
    // Unchanged means unedited: the button still offers to draw, not to draw "these tags".
    expect(screen.getByRole('button', { name: /Draw again/ })).toBeInTheDocument();
  });

  it('replaces the field with a re-rolled line, since the re-roll was asked for', () => {
    const { rerender } = render(<SceneImagePanel {...props} tags="1girl, dock" />);
    fireEvent.click(screen.getByRole('button', { name: /^Tags$/ }));
    fireEvent.change(screen.getByLabelText('Scene tags'), { target: { value: 'my own edit' } });
    rerender(<SceneImagePanel {...props} tags="1girl, dock" job="tags" />);
    rerender(<SceneImagePanel {...props} tags="1girl, rain, dusk" job={null} />);
    expect((screen.getByLabelText('Scene tags') as HTMLTextAreaElement).value).toBe('1girl, rain, dusk');
  });

  it('leaves an in-progress edit alone when no re-roll ran', () => {
    const { rerender } = render(<SceneImagePanel {...props} tags="1girl, dock" />);
    fireEvent.click(screen.getByRole('button', { name: /^Tags$/ }));
    fireEvent.change(screen.getByLabelText('Scene tags'), { target: { value: 'my own edit' } });
    // A render finishing writes the tag line back; it must not clobber what the player is typing.
    rerender(<SceneImagePanel {...props} tags="1girl, dock" job="image" />);
    rerender(<SceneImagePanel {...props} tags="1girl, dock" job={null} />);
    expect((screen.getByLabelText('Scene tags') as HTMLTextAreaElement).value).toBe('my own edit');
  });

  it('reverts an edit back to the stored line', () => {
    render(<SceneImagePanel {...props} images={[IMG[0]]} tags="1girl, dock" />);
    fireEvent.click(screen.getByRole('button', { name: /^Tags$/ }));
    fireEvent.change(screen.getByLabelText('Scene tags'), { target: { value: 'nonsense' } });
    fireEvent.click(screen.getByRole('button', { name: /Revert/ }));
    expect((screen.getByLabelText('Scene tags') as HTMLTextAreaElement).value).toBe('1girl, dock');
  });

  it('shows the live frame in place of the finished image while a render runs', () => {
    const FRAME = 'data:image/jpeg;base64,LIVE';
    const { rerender } = render(<SceneImagePanel {...props} images={IMG} tags="1girl" job="image" preview={FRAME} />);
    expect(img().src).toContain('LIVE');
    // Once the run ends the finished image is back, and the live frame is gone.
    rerender(<SceneImagePanel {...props} images={IMG} tags="1girl" job={null} preview={null} />);
    expect(img().src).toContain('CCC');
  });

  it('keeps showing the last image when a render reports no frame yet', () => {
    render(<SceneImagePanel {...props} images={IMG} tags="1girl" job="image" preview={null} />);
    expect(img().src).toContain('CCC');
  });

  it('shows a stop button while drawing, with a percentage when the provider reports one', () => {
    const onCancel = vi.fn();
    const { rerender } = render(<SceneImagePanel {...props} job="image" progress={0.42} onCancel={onCancel} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onCancel).toHaveBeenCalled();

    // Providers that report nothing still have to look busy.
    rerender(<SceneImagePanel {...props} job="image" progress={null} onCancel={onCancel} />);
    expect(screen.getByText(/Drawing this scene/)).toBeInTheDocument();
  });
});
