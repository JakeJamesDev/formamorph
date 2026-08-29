import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ImageUpload } from './UtilityComponents';
import { IMAGE_CAPS } from './imageOptim';

// The downscale prompt owns a canvas encode; a pasted link must never reach it, which is what the
// "no downscale" test below proves.
const promptImage = vi.fn(async (url: string) => url);
vi.mock('./useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({ promptImage: (url: string) => promptImage(url), dialog: null, promptWorld: vi.fn() }),
}));
// Lets a test choose what the cache reported back without standing up IndexedDB.
const statusForTest = { current: 'cached' as string };
vi.mock('./useRemoteImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useRemoteImage')>()),
  // Bypass the IndexedDB cache: these tests are about the authoring UI, not the cache.
  useRemoteImage: (url: string) => ({
    src: url || '',
    status: url?.startsWith('http') ? statusForTest.current : 'embedded',
  }),
  RemoteImg: ({ src, ...rest }: { src?: string }) => <img src={src} {...rest} />,
}));

beforeEach(() => { promptImage.mockClear(); statusForTest.current = 'cached'; });

const urlBox = () => screen.getByLabelText('Image URL');

describe('ImageUpload URL entry', () => {
  it('stores a pasted link verbatim', () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.change(urlBox(), { target: { value: 'https://files.example/a.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this image URL' }));

    expect(onChange).toHaveBeenCalledWith('https://files.example/a.png');
  });

  it('accepts Enter as well as the button', () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.change(urlBox(), { target: { value: 'https://files.example/a.png' } });
    fireEvent.keyDown(urlBox(), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('https://files.example/a.png');
  });

  it('never runs the downscale pass on a link — a remote image costs the payload nothing', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    fireEvent.change(urlBox(), { target: { value: 'https://files.example/a.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this image URL' }));

    expect(promptImage).not.toHaveBeenCalled();
  });

  it('rejects something that is not a link, and stores nothing', async () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    // Enter, not the button: a draft this shape leaves the button inert (asserted below), so the keyboard
    // is what still reaches the rejection.
    fireEvent.change(urlBox(), { target: { value: 'mara.png' } });
    fireEvent.keyDown(urlBox(), { key: 'Enter' });

    expect(await screen.findByText(/starting with http/i)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lights the commit button only once the draft is a link it can take', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);
    const useButton = () => screen.getByRole('button', { name: 'Use this image URL' }) as HTMLButtonElement;

    expect(useButton().disabled).toBe(true);

    fireEvent.change(urlBox(), { target: { value: 'mara.png' } });
    expect(useButton().disabled).toBe(true);

    fireEvent.change(urlBox(), { target: { value: 'https://files.example/a.png' } });
    expect(useButton().disabled).toBe(false);
  });

  it('offers the box only on an empty slot — a filled one is replaced by removing it first', () => {
    render(<ImageUpload id="t" value="https://files.example/a.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    expect(screen.queryByLabelText('Image URL')).toBeNull();
  });

  it('marks a filled slot as linked so an author can tell it apart from an uploaded one', () => {
    const { rerender } = render(
      <ImageUpload id="t" value="https://files.example/a.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />,
    );
    expect(screen.getByLabelText('Linked image')).toBeTruthy();

    rerender(<ImageUpload id="t" value="data:image/webp;base64,AAAA" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);
    expect(screen.queryByLabelText('Linked image')).toBeNull();
  });

  it('shows a dead link as broken at authoring time instead of leaving it to surface in play', async () => {
    render(<ImageUpload id="t" value="https://files.example/gone.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    fireEvent.error(screen.getByAltText('Uploaded'));

    await waitFor(() => expect(screen.getByText(/Couldn't load this image/i)).toBeTruthy());
  });

  it('gives a replacement value a fresh chance to load', async () => {
    const { rerender } = render(
      <ImageUpload id="t" value="https://files.example/gone.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />,
    );
    fireEvent.error(screen.getByAltText('Uploaded'));
    await waitFor(() => expect(screen.getByText(/Couldn't load this image/i)).toBeTruthy());

    rerender(<ImageUpload id="t" value="https://files.example/good.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    await waitFor(() => expect(screen.queryByText(/Couldn't load this image/i)).toBeNull());
  });
});

describe('ImageUpload link warnings', () => {
  it('warns about an expiring Discord link with no network involved at all', () => {
    render(
      <ImageUpload
        id="t"
        value="https://cdn.discordapp.com/attachments/1/2/pic.png?ex=65d903de"
        onChange={vi.fn()}
        cap={IMAGE_CAPS.entity}
      />,
    );

    expect(screen.getByLabelText('Expiring link')).toBeTruthy();
    expect(screen.getByText(/will stop working/i)).toBeTruthy();
  });

  it('leaves a permanent Discord link unwarned', () => {
    render(
      <ImageUpload id="t" value="https://cdn.discordapp.com/embed/avatars/0.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />,
    );

    expect(screen.queryByLabelText('Expiring link')).toBeNull();
    expect(screen.queryByText(/will stop working/i)).toBeNull();
    expect(screen.getByLabelText('Linked image')).toBeTruthy();
  });
});

describe('ImageUpload unreadable-host badge', () => {
  it('says the host will not hand the picture over, naming it', async () => {
    statusForTest.current = 'unreadable';

    render(<ImageUpload id="t" value="https://files.catbox.moe/a.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    // The badge is a marker with nothing but its tip to go on, so the tip is what has to name the host —
    // and it has to be reachable without a pointer.
    const badge = screen.getByLabelText('Linked image, display only');
    act(() => badge.focus());

    expect(badge).toHaveFocus();
    expect(await screen.findByText(/files\.catbox\.moe/)).toBeVisible();
  });

  it('an expiring link outranks an unreadable one — it breaks everything, just later', () => {
    statusForTest.current = 'unreadable';

    render(
      <ImageUpload id="t" value="https://cdn.discordapp.com/attachments/1/2/p.png" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />,
    );

    expect(screen.getByLabelText('Expiring link')).toBeTruthy();
    expect(screen.queryByLabelText('Linked image, display only')).toBeNull();
  });
});

describe('ImageUpload link field placement', () => {
  const SIZED = 'relative h-40 w-40';
  const frame = () => document.querySelector('[class*="border-dashed"]') as HTMLElement;

  it('sits inside a sized frame, so bringing an empty slot into view moves nothing below it', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} previewClassName={SIZED} />);

    expect(frame().contains(screen.getByLabelText('Image URL'))).toBe(true);
  });

  it('sits below a compact box, which has no room inside it', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    expect(frame().contains(screen.getByLabelText('Image URL'))).toBe(false);
  });

  it('does not open the file picker when the link box is clicked around its controls', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} previewClassName={SIZED} />);
    const picker = vi.fn();
    document.getElementById('image-upload-t')!.addEventListener('click', picker);
    const box = screen.getByLabelText('Image URL').closest('.space-y-1')!;

    // The input and the button are exempt on their own — a label never activates for a click on interactive
    // content. Its dead space is not: the gap between them, and the line held for an error message.
    fireEvent.click(box.querySelector('p')!);
    expect(picker).not.toHaveBeenCalled();

    // The control: the frame is a label, so its own text still opens the picker — without this the test
    // above would pass just as well against a frame that never forwarded a click to begin with.
    fireEvent.click(screen.getByText('Click to upload image'));
    expect(picker).toHaveBeenCalled();
  });

  it('holds the error line whether or not it says anything', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} previewClassName={SIZED} />);
    const line = () => screen.getByLabelText('Image URL').closest('.space-y-1')!.querySelector('p')!;

    expect(line().textContent).toBe('');
    expect(line().className).toMatch(/min-h-4/);

    fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: 'not-a-url' } });
    fireEvent.keyDown(screen.getByLabelText('Image URL'), { key: 'Enter' });

    expect(line().textContent).toMatch(/http/);
  });

  it("drops the \"Or\" once pasting a link is the only way in", () => {
    const { rerender } = render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} previewClassName={SIZED} />);
    expect(screen.getByLabelText('Image URL').getAttribute('placeholder')).toBe('Or paste an image URL');

    // Allowance spent: the file picker is withdrawn, so there is no longer an "or" to offer.
    rerender(
      <ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} previewClassName={SIZED}
        allowUpload={false} uploadBlockedNote="Upload limit reached (2)" />,
    );
    expect(screen.getByLabelText('Image URL').getAttribute('placeholder')).toBe('Paste an image URL');
  });
});
