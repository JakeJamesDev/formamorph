import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { EditorRow, EditorRowList, TREE_INDENT } from './EditorRow';

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
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
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
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('shrink-0');
  });

  it('indents a nested row on top of the padding every row shares, not instead of it', () => {
    const flat = render(<EditorRow selected={false} onSelect={() => {}} label="Root" />);
    const flatRow = flat.container.firstElementChild as HTMLElement;
    // A tree row used to set paddingLeft outright, which wiped the left padding at depth 0 and left
    // top-level tree rows starting 8px further left than the flat lists' rows.
    expect(flatRow.style.paddingLeft).toBe('');
    expect(flatRow.className).toContain('p-2');

    cleanup();
    const nested = render(<EditorRow selected={false} onSelect={() => {}} label="Child" depth={2} />);
    const nestedRow = nested.container.firstElementChild as HTMLElement;
    expect(nestedRow.style.paddingLeft).toBe(`${8 + 2 * TREE_INDENT}px`);
    expect(nestedRow.className).toContain('p-2');
  });

  it('holds a floor height so a row without actions is as tall as one with them', () => {
    const withActions = render(
      <EditorRow selected={false} onSelect={() => {}} label="A" actions={[{ icon: <span>x</span>, title: 'Delete', onClick: () => {} }]} />,
    );
    expect((withActions.container.firstElementChild as HTMLElement).className).toContain('min-h-14');
    cleanup();
    const bare = render(<EditorRow selected={false} onSelect={() => {}} label="A" />);
    expect((bare.container.firstElementChild as HTMLElement).className).toContain('min-h-14');
  });

  it('spaces its rows the same whether or not the list adds classes of its own', () => {
    // A tree used to render rows with no wrapper (flush) while a flat list wrapped them in gap-2, so the
    // same row read as a different height per tab. Both go through EditorRowList now.
    const plain = render(<EditorRowList><span>row</span></EditorRowList>);
    const plainEl = plain.container.firstElementChild as HTMLElement;
    expect(plainEl.className).toContain('gap-1');
    expect(plainEl.className).toContain('flex-col');
    cleanup();

    // The Dictionary's zones are also drop targets, so they add a border and take a ref.
    const zone = render(<EditorRowList className="border border-dashed"><span>row</span></EditorRowList>);
    const zoneEl = zone.container.firstElementChild as HTMLElement;
    expect(zoneEl.className).toContain('gap-1');
    expect(zoneEl.className).toContain('border-dashed');
  });

  it('forwards its ref, so a list can be a drop target', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<EditorRowList ref={ref}><span>row</span></EditorRowList>);
    expect(ref.current).toBeInstanceOf(HTMLElement);
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
