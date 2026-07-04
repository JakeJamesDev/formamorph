import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagAutocomplete } from './TagAutocomplete';

// Ranked list (popularity order) — no network / real JSON.
vi.mock('@/lib/danbooruTags', () => ({
  loadDanbooruTags: vi.fn(async () => ['1girl', '1boy', 'blonde hair', 'long hair', 'blue eyes', 'red rose']),
}));

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <TagAutocomplete value={value} onChange={setValue} />;
}

const field = () => screen.getByRole('textbox') as HTMLTextAreaElement;
// Set value + caret together, mirroring a real edit, and open the dropdown.
const typeAt = (v: string, caret: number) => {
  fireEvent.focus(field());
  fireEvent.change(field(), { target: { value: v, selectionStart: caret, selectionEnd: caret } });
};

describe('TagAutocomplete', () => {
  it('suggests matching tags for the current token', async () => {
    render(<Harness />);
    typeAt('1gi', 3);
    expect(await screen.findByText('1girl')).toBeInTheDocument();
    expect(screen.queryByText('1boy')).not.toBeInTheDocument(); // doesn't match the token
  });

  it('completes the current token with "<tag>, " on select', async () => {
    render(<Harness />);
    typeAt('1gi', 3);
    fireEvent.mouseDown(await screen.findByText('1girl'));
    expect(field().value).toBe('1girl, ');
  });

  it('only completes the active token, leaving earlier tags untouched', async () => {
    render(<Harness />);
    typeAt('red, 1gi', 8);
    fireEvent.mouseDown(await screen.findByText('1girl'));
    expect(field().value).toBe('red, 1girl, ');
  });

  it('shows nothing for an empty token and filters from the first character', async () => {
    render(<Harness />);
    typeAt('b', 1);
    expect(await screen.findByText('blonde hair')).toBeInTheDocument(); // one char filters (list loaded)
    fireEvent.change(field(), { target: { value: '', selectionStart: 0, selectionEnd: 0 } });
    expect(screen.queryByText('blonde hair')).not.toBeInTheDocument(); // empty ⇒ nothing
  });

  it('replaces the whole tag when selecting with the caret mid-tag', async () => {
    render(<Harness />);
    typeAt('red ribbon', 5); // caret at "red r|ibbon"; matches on the left part "red r"
    fireEvent.mouseDown(await screen.findByText('red rose'));
    expect(field().value).toBe('red rose, '); // the trailing "ibbon" is gone, not "red rose, ibbon"
  });

  it('shows no suggestions for the empty token left after a selection', async () => {
    render(<Harness />);
    typeAt('1gi', 3);
    fireEvent.mouseDown(await screen.findByText('1girl'));
    expect(field().value).toBe('1girl, ');
    // The new token is empty, so nothing is offered until the next character.
    expect(screen.queryByText('blonde hair')).not.toBeInTheDocument();
  });

  it('closes the dropdown on Escape', async () => {
    render(<Harness />);
    typeAt('1gi', 3);
    expect(await screen.findByText('1girl')).toBeInTheDocument();
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByText('1girl')).not.toBeInTheDocument();
  });
});
