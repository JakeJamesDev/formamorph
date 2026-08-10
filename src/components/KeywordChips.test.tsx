import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeywordChips } from './KeywordChips';

const field = () => screen.getByRole('textbox');

describe('KeywordChips', () => {
  it('gives the chip editor the free width, so the whole box takes a click', () => {
    // jsdom lays nothing out, so this guards the structure the width comes from rather than the width:
    // the growth belongs to the flex item, and `className` reaches the editable *inside* it. Put the
    // growth on the editable and its wrapper shrink-wraps to 8rem, leaving most of the box dead to clicks.
    render(<KeywordChips keywords={[]} onChange={vi.fn()} placeholders={[{ id: 'p1', name: 'Town', kind: 'variable', values: [] } as never]} />);
    const editable = screen.getByRole('textbox');
    const item = editable.parentElement!.parentElement!;
    expect(item.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex-grow', 'min-w-[8rem]']));
    expect(editable.className.split(/\s+/)).toContain('w-full');
  });

  it('commits a chip on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordChips keywords={[]} onChange={onChange} />);
    await user.type(field(), 'dragon{Enter}');
    expect(onChange).toHaveBeenCalledWith(['dragon']);
  });

  it('keeps a typed comma literal — a regex keyword survives intact', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordChips keywords={[]} onChange={onChange} />);
    await user.click(field());
    await user.paste('\\d{2,3}'); // pasted, not typed: userEvent reads `{` as a key descriptor
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['\\d{2,3}']);
  });

  it('pops the last chip on Backspace in an empty field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordChips keywords={['a', 'b']} onChange={onChange} />);
    await user.click(field());
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('adds one chip per line from a multi-line paste', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordChips keywords={[]} onChange={onChange} />);
    await user.click(field());
    await user.paste('dragon\nwyrm\n\ndrake');
    expect(onChange).toHaveBeenCalledWith(['dragon', 'wyrm', 'drake']);
  });

  it('leaves a single-line paste in the buffer for editing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordChips keywords={[]} onChange={onChange} />);
    await user.click(field());
    await user.paste('red, blue');
    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue('red, blue');
  });

  describe('comma-split offer', () => {
    const splitButton = () => screen.queryByRole('button', { name: /Split .* into 2 keywords/ });

    it('offers to split a committed chip that reads like a list, and splits on click', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(<KeywordChips keywords={[]} onChange={onChange} />);
      await user.click(field());
      await user.paste('red, blue');
      await user.keyboard('{Enter}');
      expect(onChange).toHaveBeenCalledWith(['red, blue']);

      rerender(<KeywordChips keywords={['red, blue']} onChange={onChange} />);
      expect(splitButton()).toBeInTheDocument();
      await user.click(splitButton()!);
      expect(onChange).toHaveBeenLastCalledWith(['red', 'blue']);
    });

    it('splits in place, keeping the chip position', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(<KeywordChips keywords={['first']} onChange={onChange} />);
      await user.type(field(), 'red, blue{Enter}');
      rerender(<KeywordChips keywords={['first', 'red, blue', 'last']} onChange={onChange} />);
      await user.click(splitButton()!);
      expect(onChange).toHaveBeenLastCalledWith(['first', 'red', 'blue', 'last']);
    });

    it('does not offer when offerCommaSplit is off (regex entries)', async () => {
      const user = userEvent.setup();
      render(<KeywordChips keywords={[]} onChange={vi.fn()} offerCommaSplit={false} />);
      await user.type(field(), 'red, blue{Enter}');
      expect(splitButton()).not.toBeInTheDocument();
    });

    it('does not offer for a bare comma with no space', async () => {
      const user = userEvent.setup();
      render(<KeywordChips keywords={[]} onChange={vi.fn()} />);
      await user.type(field(), 'a,b{Enter}');
      expect(splitButton()).not.toBeInTheDocument();
    });

    it('dismisses the offer once typing resumes', async () => {
      const user = userEvent.setup();
      render(<KeywordChips keywords={[]} onChange={vi.fn()} />);
      await user.type(field(), 'red, blue{Enter}');
      expect(splitButton()).toBeInTheDocument();
      await user.type(field(), 'x');
      expect(splitButton()).not.toBeInTheDocument();
    });
  });
});
