import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { EditorRow } from './EditorRow';

afterEach(cleanup);

describe('EditorRow', () => {
  it('selects when the row body is clicked', () => {
    const onSelect = vi.fn();
    render(<EditorRow selected={false} onSelect={onSelect} label="Vigor" />);
    fireEvent.click(screen.getByText('Vigor'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('runs an action without also selecting the row', () => {
    const onSelect = vi.fn();
    const duplicate = vi.fn();
    render(
      <EditorRow
        selected={false}
        onSelect={onSelect}
        label="Vigor"
        actions={[{ icon: <span>c</span>, title: 'Duplicate', onClick: duplicate }]}
      />,
    );
    fireEvent.click(screen.getByTitle('Duplicate'));
    expect(duplicate).toHaveBeenCalledTimes(1);
    // The action sits inside the row's own click target, so without stopPropagation clicking Duplicate
    // would also change which item the detail pane is showing.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('toggles the checkbox without also selecting the row', () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    render(
      <EditorRow
        selected={false}
        onSelect={onSelect}
        label="Vigor"
        checkbox={{ checked: true, onChange }}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('collapses without also selecting the row, and names the direction it will go', () => {
    const onSelect = vi.fn();
    const onToggleCollapse = vi.fn();
    const { rerender } = render(
      <EditorRow
        selected={false}
        onSelect={onSelect}
        label="Lore"
        lead="chevron"
        collapsed={false}
        onToggleCollapse={onToggleCollapse}
        collapseLabels={['Expand dictionary', 'Collapse dictionary']}
      />,
    );
    fireEvent.click(screen.getByLabelText('Collapse dictionary'));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();

    rerender(
      <EditorRow
        selected={false}
        onSelect={onSelect}
        label="Lore"
        lead="chevron"
        collapsed
        onToggleCollapse={onToggleCollapse}
        collapseLabels={['Expand dictionary', 'Collapse dictionary']}
      />,
    );
    expect(screen.getByLabelText('Expand dictionary')).toBeTruthy();
  });

  it('keeps a long label from pushing the actions off the row', () => {
    render(
      <EditorRow
        selected={false}
        onSelect={() => {}}
        label="A name long enough to overrun any list column it is put in"
        actions={[{ icon: <span>x</span>, title: 'Delete', onClick: () => {} }]}
      />,
    );
    // jsdom has no layout, so assert the contract that produces the behavior: the label may shrink below
    // its content width and truncate, and the button refuses to shrink at all.
    const label = screen.getByText(/A name long enough/);
    expect(label.className).toContain('min-w-0');
    expect(label.className).toContain('truncate');
    expect(screen.getByTitle('Delete').className).toContain('shrink-0');
  });

  it('rounds only its top corners when a body is attached below it', () => {
    const { container, rerender } = render(<EditorRow selected={false} onSelect={() => {}} label="Lore" attached />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain('rounded-t-md');
    expect(row.className).not.toContain('rounded-md');

    rerender(<EditorRow selected={false} onSelect={() => {}} label="Lore" />);
    expect((container.firstElementChild as HTMLElement).className).toContain('rounded-md');
  });
});
