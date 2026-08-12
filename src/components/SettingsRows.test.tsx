import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Row, CheckRow } from './SettingsRows';

/**
 * The vertical-alignment contract of the settings row primitives. jsdom has no layout engine, so these
 * assert the structure that produces the alignment — where the hint sits in the grid, and which cell owns
 * the centering — rather than measured pixels. The measured proof is in the browser; what these stop is the
 * structure being rearranged back into a shape that can't align, which is how it broke the first time.
 */

/** The three cells a `Row` lays out: label, control, and (optionally) hint. */
const cells = (container: HTMLElement) => [...container.firstElementChild!.children] as HTMLElement[];

describe('Row alignment', () => {
  it('centers the label against the control rather than the control-plus-hint stack', () => {
    const { container } = render(<Row label="Theme Color" hint="Recolors the whole app.">
      <select aria-label="c" />
    </Row>);
    const grid = container.firstElementChild!;
    const [labelCell, controlCell, hintCell] = cells(container);

    expect(grid.className).toContain('items-center');
    // The hint is the grid's own third child, not a sibling of the control inside one cell. Nested, it
    // makes the cell taller than the control and drags the centered label below the control's midline.
    expect(cells(container)).toHaveLength(3);
    expect(controlCell.contains(hintCell)).toBe(false);
    expect(hintCell.className).toContain('sm:col-start-2');
    expect(labelCell.className).not.toContain('self-start');
  });

  it('pins the label to the first line of a control that is taller than a line', () => {
    const { container } = render(<Row top label="Workflow" hint="Replaces the default graph.">
      <textarea aria-label="c" />
    </Row>);
    expect(cells(container)[0].className).toContain('self-start');
  });

  it('holds the label column open on a row that has no label', () => {
    const { container } = render(<Row hint="A status line."><span>status</span></Row>);
    expect(cells(container)[0].className).toContain('hidden');
  });
});

describe('CheckRow alignment', () => {
  it('centers the box on the line of text beside it', () => {
    const { container } = render(
      <CheckRow label="Autosave" htmlFor="autosave" checked onChange={() => {}} hint="Saves after every turn." />,
    );
    const box = container.querySelector('button[role=checkbox]')!;
    // The box is shorter than the line; without a sleeve sized to the line it top-aligns and its center
    // lands above the label's.
    const sleeve = box.parentElement!;
    expect(sleeve.className).toContain('h-[1lh]');
    expect(sleeve.className).toContain('items-center');
  });
});
