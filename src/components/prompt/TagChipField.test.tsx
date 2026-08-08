import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagChipField from './TagChipField';

// Ranked list (popularity order) — no network / real JSON.
vi.mock('@/lib/danbooruTags', () => ({
  loadDanbooruTags: vi.fn(async () => ['1girl', '1boy', 'blonde hair', 'long hair', 'blue eyes', 'red rose']),
}));

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TagChipField value={value} onChange={setValue} placeholders={[]} ariaLabel="Image Tags" />
      <div data-testid="value">{value}</div>
    </>
  );
}

const field = () => screen.getByLabelText('Image Tags');
const value = () => screen.getByTestId('value').textContent;

/**
 * Type a tag at the head of the value.
 *
 * jsdom has no layout, so a click can't hit-test a caret: it lands at the start, and an empty field gets
 * no selection at all. Every case therefore starts from a written value and types the tag under test in
 * front of it — which is the same path as a half-typed tag anywhere in the line. The trailing-separator
 * rules for completing the *last* tag are unit-tested in tagSuggest.test.ts, where the caret is an
 * argument rather than a DOM selection.
 */
async function typeTag(text: string) {
  const user = userEvent.setup();
  await user.click(field());
  await user.keyboard(text);
  return user;
}

describe('TagChipField', () => {
  it('suggests matching tags for the tag being typed', async () => {
    render(<Harness initial=", solo" />);
    await typeTag('1gi');

    expect(await screen.findByText('1girl')).toBeInTheDocument();
    expect(screen.queryByText('1boy')).not.toBeInTheDocument(); // doesn't match the token
  });

  it('completes only the active tag, leaving the others untouched', async () => {
    render(<Harness initial=", red rose" />);
    await typeTag('1gi');

    fireEvent.mouseDown(await screen.findByText('1girl'));
    await waitFor(() => expect(value()).toBe('1girl, red rose'));
  });

  it('replaces the whole tag when completing from part of it', async () => {
    render(<Harness initial=", solo" />);
    await typeTag('red r');

    fireEvent.mouseDown(await screen.findByText('red rose'));
    await waitFor(() => expect(value()).toBe('red rose, solo')); // no "ibbon"-style leftovers
  });

  it('offers nothing for the empty tag after a comma ends the last one', async () => {
    render(<Harness initial=", solo" />);
    const user = await typeTag('b');
    expect(await screen.findByText('blonde hair')).toBeInTheDocument();

    // Finishing the tag leaves the caret on an empty one, which suggests nothing until a character lands.
    // (Reached by typing rather than deleting: jsdom can't drive a Lexical backspace.)
    await user.keyboard(',');
    await waitFor(() => expect(value()).toBe('b,, solo'));
    expect(screen.queryByText('blonde hair')).not.toBeInTheDocument();
  });

  it('offers nothing for the empty tag left behind by a completion', async () => {
    render(<Harness initial=", red rose" />);
    await typeTag('1gi');

    fireEvent.mouseDown(await screen.findByText('1girl'));
    await waitFor(() => expect(value()).toBe('1girl, red rose'));
    expect(screen.queryByText('blonde hair')).not.toBeInTheDocument();
  });

  it('closes the suggestions on Escape', async () => {
    render(<Harness initial=", solo" />);
    const user = await typeTag('1gi');
    expect(await screen.findByText('1girl')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('1girl')).not.toBeInTheDocument());
  });

  it('keeps a comma-separated line as text, chipping nothing', () => {
    // The tags are commas all the way down; only a placeholder token ever becomes a chip.
    render(<Harness initial="1girl, blue eyes, long hair" />);
    expect(field().querySelectorAll('[data-lexical-decorator]')).toHaveLength(0);
    expect(field().textContent).toBe('1girl, blue eyes, long hair');
  });
});
