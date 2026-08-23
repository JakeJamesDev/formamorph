import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { EventFormDialog } from './EventFormDialog';
import EventService from '@/services/EventService';
import { daysFrom, serverEvent } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 't', getCurrentUser: () => ({ id: 'a1', username: 'root-admin', accountType: 'admin' }) },
}));

// jsdom can't drive a real Lexical selection, and these cover the form's own logic rather than the
// editor's. The stub keeps each prose field a plain textarea so a value can be set; PromptField has its
// own tests. Recorded per field so the form's choice of editor is still asserted.
const promptFields = vi.hoisted(() => ({ byLabel: {} as Record<string, Record<string, unknown>> }));

vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => {
    promptFields.byLabel[props.ariaLabel ?? ''] = props;
    return (
      <textarea
        aria-label={props.ariaLabel}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  },
}));

const at = (offsetDays: number) => daysFrom(offsetDays);

const event = (over: Partial<ServerEvent> = {}): ServerEvent =>
  serverEvent({ title: 'Summer Isles Contest', startsAt: at(-4), endsAt: at(8), ...over });

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

/**
 * The themed picker holds a day and an hour apart, so a window is set as the pair an admin sets: open
 * the calendar, page forward to the month, press the day, then type the hour.
 */
const setMoment = (label: string, day: string, time: string) => {
  fireEvent.click(screen.getByRole('button', { name: `${label} date` }));

  const dayCell = () => screen.queryByRole('button', { name: new RegExp(day) });
  // The calendar opens on whatever month it was already showing, so page toward the target either way.
  const target = new Date(day.replace(/(\d+)(st|nd|rd|th)/, '$1')).getTime();
  const shown = () => new Date(`${screen.getByRole('grid').getAttribute('aria-label')} 1`).getTime();

  for (let paged = 0; paged < 36 && !dayCell(); paged++) {
    fireEvent.click(screen.getByRole('button', { name: target > shown() ? /Next Month/i : /Previous Month/i }));
  }

  fireEvent.click(dayCell()!);
  fireEvent.change(field(`${label} time`), { target: { value: time } });
};

/** Fill everything a new event needs, so a test can then change the one thing it is about. */
const fillValid = () => {
  type('Title', 'Autumn Hauntings Contest');
  type('Banner Text', 'Something stirs in the leaves.');
  type('Details', 'Enter by publishing a world with the switch on.');
  setMoment('Starts', 'October 1st, 2026', '12:00');
  setMoment('Ends', 'October 21st, 2026', '12:00');
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the type picker', () => {
  it('offers both types as one strip, neither of them a default hidden among the fields', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('tab', { name: /Contest/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Announcement/ })).toBeTruthy();
  });

  it('shows the rules field for a contest and drops it for an announcement', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);
    expect(screen.getByLabelText('Rules')).toBeTruthy();

    // Radix tab triggers act on mousedown, not click.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Announcement/ }));

    expect(screen.queryByLabelText('Rules')).toBeNull();
  });

  it('says which type an edit is instead of offering the choice, since the type can never change', () => {
    render(<EventFormDialog open onOpenChange={() => {}} editing={event()} />);

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText('Contest')).toBeTruthy();
  });
});

describe('scheduling one', () => {
  it('sends the authored fields with the window as instants', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    type('Rules', 'One entry per creator.');
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      type: 'contest',
      title: 'Autumn Hauntings Contest',
      rulesText: 'One entry per creator.',
    });
    expect(new Date(create.mock.calls[0][0].startsAt).toISOString())
      .toBe(new Date('2026-10-01T12:00').toISOString());
  });

  it('sends no rules on an announcement, which has none to have', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Announcement/ }));
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ type: 'announcement', rulesText: null });
  });

  it('refuses a window that runs backwards rather than letting the server say so', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    setMoment('Ends', 'September 1st, 2026', '12:00');
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    expect(create).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('The end has to come after the start');
  });

  it('refuses an event with nothing to say', () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    expect(create).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('A title is required');
  });

  it('leaves the dialog open when the server refuses, so the draft is not lost', async () => {
    vi.spyOn(EventService, 'create').mockRejectedValue(new Error('That window overlaps the contest "Spring Tides"'));
    const onOpenChange = vi.fn();
    render(<EventFormDialog open onOpenChange={onOpenChange} />);

    fillValid();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That window overlaps the contest "Spring Tides"'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('editing one', () => {
  it('opens on what the event says now', () => {
    render(<EventFormDialog open onOpenChange={() => {}} editing={event()} />);

    expect(field('Title').value).toBe('Summer Isles Contest');
    // `field` is typed for the inputs every other assertion here reads; Rules is the one textarea.
    expect((field('Rules') as unknown as HTMLTextAreaElement).value).toBe('One entry per creator.');
  });

  it('leaves a started event start alone, which the server would refuse to move', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} editing={event()} />);

    expect(screen.getByRole('button', { name: 'Starts date' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).not.toHaveProperty('startsAt');
    expect(update.mock.calls[0][1]).toHaveProperty('endsAt');
  });

  it('still moves the start of an event nobody has been told about', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    const scheduled = event({ startsAt: at(5), endsAt: at(20) });
    render(<EventFormDialog open onOpenChange={() => {}} editing={scheduled} />);

    expect(screen.getByRole('button', { name: 'Starts date' })).not.toBeDisabled();
    setMoment('Starts', 'November 1st, 2026', '12:00');
    setMoment('Ends', 'November 21st, 2026', '12:00');
    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(new Date((update.mock.calls[0][1] as { startsAt: string }).startsAt).toISOString())
      .toBe(new Date('2026-11-01T12:00').toISOString());
  });

  it('closes and tells the list to re-read once the save lands', async () => {
    vi.spyOn(EventService, 'update').mockResolvedValue(event());
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    render(<EventFormDialog open onOpenChange={onOpenChange} editing={event()} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('the prose fields', () => {
  it('gives Details the markdown editor world prose is written in', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    expect(promptFields.byLabel.Details).toMatchObject({ markdown: true });
  });

  it('gives Rules the same editor, so contest rules can carry lists and headings', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    expect(promptFields.byLabel.Rules).toMatchObject({ markdown: true });
  });

  it('holds each to the length the server accepts', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    type('Details', 'x'.repeat(5000));

    expect(String((promptFields.byLabel.Details as { value: string }).value)).toHaveLength(4000);
  });
});

describe('styling the poster', () => {
  it('previews the band from what is in the form right now', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    type('Title', 'Autumn Hauntings Contest');
    fireEvent.change(field('Poster color'), { target: { value: '#7c3aed' } });

    const preview = screen.getByTestId('poster-preview');
    expect(preview.textContent).toContain('Autumn Hauntings Contest');
    expect(preview.querySelector<HTMLElement>('[style*="background-color"]')!.style.backgroundColor)
      .toBe('rgb(124, 58, 237)');
  });

  it('sends the chosen color with the event', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    fireEvent.change(field('Poster color'), { target: { value: '#7C3AED' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ posterColor: '#7c3aed' });
  });

  it('sends nothing styled when the organizer styled nothing', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ posterColor: null, posterImage: null });
  });

  it('puts the color back to the default on request', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    fireEvent.change(field('Poster color'), { target: { value: '#7c3aed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Default Color' }));
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ posterColor: null });
  });

  it('opens an edit on the styling the event already carries', () => {
    render(<EventFormDialog open onOpenChange={() => {}} editing={event({ posterColor: '#1e3a8a' })} />);

    expect(field('Poster color').value).toBe('#1e3a8a');
  });

  it('leaves stored artwork alone on an edit that never touched it', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} editing={event({ posterImageUrl: '/api/event-posters/a.webp' })} />);

    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    // Sending null here would delete the file the organizer never asked to remove.
    expect(update.mock.calls[0][1]).not.toHaveProperty('posterImage');
  });

  it('clears stored artwork when it is removed', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} editing={event({ posterImageUrl: '/api/event-posters/a.webp' })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Image' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toHaveProperty('posterImage', null);
  });

  it('refuses artwork the server would reject for its size, before uploading it', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    const tooBig = new File([new Uint8Array(3 * 1024 * 1024)], 'band.png', { type: 'image/png' });
    fireEvent.change(field('Poster image'), { target: { files: [tooBig] } });

    expect(toast.error).toHaveBeenCalledWith('That image is larger than 2MB');
  });

  it('carries a picked image into the preview and the save', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    const art = new File(['art-bytes'], 'band.png', { type: 'image/png' });
    fireEvent.change(field('Poster image'), { target: { files: [art] } });

    // The pick also opens the positioning dialog, whose band is a second copy of the artwork.
    await waitFor(() => expect(screen.getAllByTestId('poster-band-image').length).toBeGreaterThan(0));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(String(create.mock.calls[0][0].posterImage)).toMatch(/^data:image\/png;base64,/);
  });
});

describe('the band preview before a window is set', () => {
  it('names no dates, rather than showing a pill holding only its dash', async () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    const preview = screen.getByTestId('poster-preview');
    expect(preview.textContent).not.toContain('–');

    setMoment('Starts', 'October 1st, 2026', '12:00');
    setMoment('Ends', 'October 21st, 2026', '12:00');

    expect(screen.getByTestId('poster-preview').textContent).toContain('–');
  });
});

/**
 * Repositioning the artwork — the positioning dialog.
 *
 * The framing is edited in its own dialog, avatar-style: picking a picture opens it, Reposition
 * reopens it, and the form's own preview stays inert. jsdom neither lays out nor decodes, and the crop
 * math needs both, so each is supplied the way a browser would: a band with a measured box, and a
 * picture with natural proportions. A 1000x500 source covering an 800x200 band draws 800x400 — nothing
 * spare across, 100 either way down.
 */

/** A decode that answers with fixed proportions, the way a loaded picture does. */
const stubImageDecode = (width = 1000, height = 500) => {
  class StubImage {
    onload: (() => void) | null = null;
    naturalWidth = width;
    naturalHeight = height;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  vi.stubGlobal('Image', StubImage);
};

/** A band laid out at a given size. */
const stubBandSize = (width = 800, height = 200) => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
};

const surface = () => screen.getByTestId('poster-position-surface');
const positioningOpen = () => screen.queryByTestId('poster-position-surface') !== null;
const repositionButton = () => screen.getByRole('button', { name: /Reposition/ });

/** Wait until the dialog has measured and decoded enough to accept a drag. */
const positioningReady = async () =>
  waitFor(() => expect(screen.getByLabelText('Zoom in')).not.toBeDisabled());

/** Pick artwork; the positioning dialog opens on it by itself. */
const uploadArt = async () => {
  const art = new File(['art-bytes'], 'band.png', { type: 'image/png' });
  fireEvent.change(field('Poster image'), { target: { files: [art] } });
  await waitFor(() => expect(positioningOpen()).toBe(true));
  await positioningReady();
};

const savePosition = () => fireEvent.click(screen.getByRole('button', { name: 'Save Position' }));

const cancelPositioning = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(positioningOpen()).toBe(false));
};

/** Reopen the dialog from the form. */
const reposition = async () => {
  fireEvent.click(repositionButton());
  await waitFor(() => expect(positioningOpen()).toBe(true));
  await positioningReady();
};

/** Drag the artwork by a distance inside the dialog's band. */
const dragBy = (dx: number, dy: number) => {
  fireEvent.pointerDown(surface(), { clientX: 400, clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(surface(), { clientX: 400 + dx, clientY: 100 + dy, pointerId: 1 });
  fireEvent.pointerUp(surface(), { clientX: 400 + dx, clientY: 100 + dy, pointerId: 1 });
};

describe('framing the poster artwork', () => {
  it('opens the positioning dialog on a fresh pick, and offers Reposition only alongside artwork', async () => {
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    expect(screen.queryByRole('button', { name: /Reposition/ })).toBeNull();

    await uploadArt();
    expect(positioningOpen()).toBe(true);

    savePosition();
    await waitFor(() => expect(positioningOpen()).toBe(false));
    expect(repositionButton()).toBeTruthy();
  });

  it('keeps the form preview inert, so scrolling the form can never move the picture', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    await uploadArt();
    await cancelPositioning();

    const preview = screen.getByTestId('poster-preview');
    fireEvent.pointerDown(preview, { clientX: 400, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(preview, { clientX: 400, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(preview, { clientX: 400, clientY: 40, pointerId: 1 });
    fireEvent.wheel(preview, { deltaY: -100 });
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].posterPlacement).toBeNull();
  });

  it('carries what was dragged into the saved event', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    await uploadArt();
    // Up 50 pixels against a picture drawn 400 tall: an eighth of it, so the focal point moves down.
    dragBy(0, -50);
    savePosition();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].posterPlacement).toEqual({ zoom: 1, x: 0.5, y: 0.625 });
  });

  it('discards a drag on Cancel, exactly as the avatar crop does', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    await uploadArt();
    dragBy(0, -50);
    await cancelPositioning();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    // The picture stays; only the framing that was being tried is abandoned.
    expect(create.mock.calls[0][0].posterPlacement).toBeNull();
    expect(String(create.mock.calls[0][0].posterImage)).toMatch(/^data:/);
  });

  it('holds a drag inside the picture, so blank space can never reach the band', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    await uploadArt();
    dragBy(0, -9999);
    savePosition();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    // A quarter of the picture is the furthest the band's own height lets it travel.
    expect(create.mock.calls[0][0].posterPlacement).toEqual({ zoom: 1, x: 0.5, y: 0.75 });
  });

  it('zooms on the wheel, out on the way down', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    await uploadArt();
    fireEvent.wheel(surface(), { deltaY: -100 });
    savePosition();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].posterPlacement?.zoom).toBeCloseTo(1.2);
  });

  it('zooms a step at a time on the buttons, and stops at the floor', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    await uploadArt();
    fireEvent.click(screen.getByLabelText('Zoom in'));
    fireEvent.click(screen.getByLabelText('Zoom in'));
    // Three steps back from 1.5 would leave the picture smaller than the band it has to cover.
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    savePosition();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].posterPlacement?.zoom).toBe(1);
  });

  it('shows the chosen zoom on the slider, which offers the same range', async () => {
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    await uploadArt();
    fireEvent.click(screen.getByLabelText('Zoom in'));

    const slider = screen.getByRole('slider', { name: 'Poster zoom' });
    expect(slider).toHaveAttribute('aria-valuenow', '1.25');
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '4');
  });

  it('recenters on Reset without making the organizer pick the file again', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    await uploadArt();
    dragBy(0, -50);
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    savePosition();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].posterPlacement).toBeNull();
    expect(screen.getByTestId('poster-band-image')).toBeTruthy();
  });

  it('recenters when a different picture is chosen, which the old framing would crop wrongly', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    await uploadArt();
    dragBy(0, -50);
    savePosition();

    // The replacement opens the dialog again, already centered — Reset dark is the form saying so.
    const replacement = new File(['other-art'], 'other.png', { type: 'image/png' });
    fireEvent.change(field('Poster image'), { target: { files: [replacement] } });
    await waitFor(() => expect(positioningOpen()).toBe(true));
    await positioningReady();
    expect(screen.getByRole('button', { name: /Reset/ })).toBeDisabled();

    savePosition();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0].posterPlacement).toBeNull();
  });

  it('clears the framing along with the picture it framed', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    const framed = event({
      posterImageUrl: '/api/event-posters/a.webp',
      posterPlacement: { zoom: 2, x: 0.4, y: 0.6 },
    });
    render(<EventFormDialog open onOpenChange={() => {}} editing={framed} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Image' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toMatchObject({ posterImage: null, posterPlacement: null });
    // Nothing left to open the dialog on either.
    expect(screen.queryByRole('button', { name: /Reposition/ })).toBeNull();
  });

  it('opens an edit on the framing the event already carries', async () => {
    stubImageDecode();
    stubBandSize();
    const framed = event({
      posterImageUrl: '/api/event-posters/a.webp',
      posterPlacement: { zoom: 2, x: 0.4, y: 0.6 },
    });
    render(<EventFormDialog open onOpenChange={() => {}} editing={framed} />);

    await reposition();

    expect(screen.getByRole('slider', { name: 'Poster zoom' })).toHaveAttribute('aria-valuenow', '2');
  });

  it('sends a nudged framing without re-uploading the picture it belongs to', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    const framed = event({ posterImageUrl: '/api/event-posters/a.webp' });
    render(<EventFormDialog open onOpenChange={() => {}} editing={framed} />);

    await reposition();
    dragBy(0, -50);
    savePosition();
    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toMatchObject({ posterPlacement: { zoom: 1, x: 0.5, y: 0.625 } });
    // Re-sending the file would rewrite it on the server for a change that never touched a pixel.
    expect(update.mock.calls[0][1]).not.toHaveProperty('posterImage');
  });
});

describe('the framing guards', () => {
  it('opens an edit on no framing at all when the stored one is not one', async () => {
    // Held as it came, it would be sent straight back and the save refused over a field nobody touched.
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    stubImageDecode();
    stubBandSize();
    const broken = event({
      posterImageUrl: '/api/event-posters/a.webp',
      posterPlacement: { zoom: 40, x: 2, y: -1 },
    });
    render(<EventFormDialog open onOpenChange={() => {}} editing={broken} />);

    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toHaveProperty('posterPlacement', null);
  });

  it('drags against the band the artwork is drawn in, not the bordered box around it', async () => {
    // Two boxes a couple of pixels apart clamp to different places, and the band silently pulls the
    // placement back on release. The outer box is made obviously larger here, so which one the drag
    // measured is readable in the answer.
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    stubImageDecode();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const outer = this.querySelector('[data-testid="poster-position-surface"]') !== null;
      const [width, height] = outer ? [900, 400] : [800, 200];
      return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
    });
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    await uploadArt();
    dragBy(0, -50);
    savePosition();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    // 50 pixels against the 400-tall picture the 800x200 band draws. The 900x400 box would draw it 450
    // tall and answer 0.611.
    expect(create.mock.calls[0][0].posterPlacement?.y).toBeCloseTo(0.625);
  });
});
