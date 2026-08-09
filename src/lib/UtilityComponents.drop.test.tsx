import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageUpload } from './UtilityComponents';
import { IMAGE_CAPS } from './imageOptim';

// The downscale prompt owns a canvas encode jsdom can't run; these tests are about which payload reaches
// the slot, not about re-encoding, so it passes the URL straight through.
const promptImage = vi.fn(async (url: string, _cap: unknown, onEncoding?: () => void) => { onEncoding?.(); return url; });
vi.mock('./useDownscalePrompt', () => ({
  useDownscalePrompt: () => ({
    promptImage: (url: string, cap: unknown, onEncoding?: () => void) => promptImage(url, cap, onEncoding),
    dialog: null,
    promptWorld: vi.fn(),
  }),
}));
vi.mock('./useRemoteImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useRemoteImage')>()),
  useRemoteImage: (url: string) => ({ src: url || '', status: url?.startsWith('http') ? 'cached' : 'embedded' }),
  RemoteImg: ({ src, ...rest }: { src?: string }) => <img src={src} {...rest} />,
}));

beforeEach(() => { promptImage.mockClear(); });

const file = (name: string, type = 'image/png') => new File(['bytes'], name, { type });

/** jsdom has no DataTransfer constructor; a drop only ever reads these three members. */
const transfer = (opts: { files?: File[]; data?: Record<string, string> }) => ({
  files: opts.files ?? [],
  types: [...(opts.files?.length ? ['Files'] : []), ...Object.keys(opts.data ?? {})],
  getData: (t: string) => opts.data?.[t] ?? '',
});

/** The dashed frame. Not found by its label, which changes while a drag is overhead — and firing on it is
 *  enough, since the handlers sit on the wrapper it bubbles to. */
const zone = () => document.querySelector('[class*="border-dashed"]') as HTMLElement;

describe('ImageUpload drag and drop', () => {
  it('stores a dropped file', async () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.drop(zone(), { dataTransfer: transfer({ files: [file('a.png')] }) });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/);
  });

  it('stores a picture dragged out of a browser tab as a link, with no re-encode', async () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.drop(zone(), { dataTransfer: transfer({ data: { 'text/uri-list': 'https://files.example/a.png' } }) });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://files.example/a.png'));
    expect(promptImage).not.toHaveBeenCalled();
  });

  it('ignores a drag carrying nothing usable', () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.drop(zone(), { dataTransfer: transfer({ data: { 'text/plain': 'just some words' } }) });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a filled slot alone — replacing means removing first', () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" value="https://files.example/held.png" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.drop(zone(), {
      dataTransfer: transfer({ data: { 'text/uri-list': 'https://files.example/new.png' } }),
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('hands a multi-file drop to the caller that has room for them', () => {
    const onChange = vi.fn();
    const onFiles = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} onFiles={onFiles} cap={IMAGE_CAPS.entity} />);

    fireEvent.drop(zone(), { dataTransfer: transfer({ files: [file('a.png'), file('b.png')] }) });

    expect(onFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'a.png' }),
      expect.objectContaining({ name: 'b.png' }),
    ]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes only the first file when the caller holds one slot', async () => {
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.drop(zone(), { dataTransfer: transfer({ files: [file('a.png'), file('b.png')] }) });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('refuses dropped bytes once the embedded allowance is spent, but still takes a link', async () => {
    const onChange = vi.fn();
    render(
      <ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} allowUpload={false} uploadBlockedNote="no room" />,
    );
    const frame = zone;

    fireEvent.drop(frame(), { dataTransfer: transfer({ files: [file('a.png')] }) });
    // The link is dropped second and awaited, so the file's own async read has had every chance to land
    // by the time the count is checked — asserting on it straight after the drop could never fail.
    fireEvent.drop(frame(), { dataTransfer: transfer({ data: { 'text/uri-list': 'https://files.example/a.png' } }) });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://files.example/a.png'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('marks the frame while a droppable drag is over it, and unmarks on leave', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);
    const frame = zone;

    expect(frame().className).not.toMatch(/ring-primary/);
    expect(screen.queryByText('Drop to add')).toBeNull();

    fireEvent.dragOver(zone(), { dataTransfer: transfer({ files: [file('a.png')] }) });
    // The slot's own prompt says what the drop will do, rather than the border carrying it alone.
    expect(frame().className).toMatch(/ring-primary/);
    expect(screen.getByText('Drop to add')).toBeTruthy();

    fireEvent.dragLeave(zone());
    expect(frame().className).not.toMatch(/ring-primary/);
    expect(screen.queryByText('Drop to add')).toBeNull();
  });

  it('changes a sized slot\'s prompt too, not only the compact one', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} previewClassName="relative h-40 w-40" />);
    expect(screen.getByText('Click to upload image')).toBeTruthy();

    fireEvent.dragOver(zone(), { dataTransfer: transfer({ files: [file('a.png')] }) });

    expect(screen.getByText('Drop to add')).toBeTruthy();
  });

  it('covers the slot while the picture is re-encoding, and uncovers when it is stored', async () => {
    let release!: (url: string) => void;
    promptImage.mockImplementationOnce((url: string, _cap: unknown, onEncoding?: () => void) => {
      onEncoding?.();
      return new Promise<string>((resolve) => { release = () => resolve(url); });
    });
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    fireEvent.drop(zone(), { dataTransfer: transfer({ files: [file('a.png')] }) });

    expect(await screen.findByRole('status', { name: 'Converting image' })).toBeTruthy();
    release('data:image/webp;base64,AAAA');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('shows the file itself, never the data URL being encoded', async () => {
    promptImage.mockImplementationOnce((url: string, _cap: unknown, onEncoding?: () => void) => {
      onEncoding?.();
      return new Promise<string>(() => {});
    });
    const { container } = render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    fireEvent.drop(zone(), { dataTransfer: transfer({ files: [file('a.png')] }) });

    await screen.findByRole('status');
    // Handing an <img> the multi-megabyte base64 string blocks the main thread for long enough that the
    // overlay lands only once the encode is nearly over — the frozen frame this whole overlay exists to fix.
    const src = container.querySelector('[role="status"] img')!.getAttribute('src')!;
    expect(src.startsWith('data:')).toBe(false);
    expect(src.startsWith('blob:')).toBe(true);
  });

  it('covers the slot with the same crop the slot itself uses', async () => {
    promptImage.mockImplementationOnce((url: string, _cap: unknown, onEncoding?: () => void) => {
      onEncoding?.();
      return new Promise<string>(() => {}); // held open: the overlay is the subject, not the result
    });
    // objectFit only reaches the picture in a sized preview frame, which is also the only place a crop can
    // differ from the whole image — so this is the shape the overlay has to match.
    const { container } = render(
      <ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} objectFit="cover" previewClassName="relative h-40 w-40" />,
    );

    fireEvent.drop(zone(), { dataTransfer: transfer({ files: [file('a.png')] }) });

    await screen.findByRole('status');
    const thumb = container.querySelector('[role="status"] img')!;
    expect(thumb.className).toMatch(/object-cover/);
  });

  it('stays uncovered while the consent dialog is still up', async () => {
    let release!: (url: string) => void;
    // The prompt has not called back yet — the user is still reading the dialog, and nothing is encoding.
    promptImage.mockImplementationOnce(() => new Promise<string>((resolve) => { release = () => resolve('kept'); }));
    const onChange = vi.fn();
    render(<ImageUpload id="t" onChange={onChange} cap={IMAGE_CAPS.entity} />);

    fireEvent.drop(zone(), { dataTransfer: transfer({ files: [file('a.png')] }) });

    await waitFor(() => expect(promptImage).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
    release('kept');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('kept'));
  });

  it('does not mark the frame for a drag it could not take', () => {
    render(<ImageUpload id="t" onChange={vi.fn()} cap={IMAGE_CAPS.entity} />);

    fireEvent.dragOver(zone(), { dataTransfer: { files: [], types: ['application/x-chip'], getData: () => '' } });

    expect(zone().className).not.toMatch(/ring-primary/);
    expect(screen.queryByText('Drop to add')).toBeNull();
  });
});
