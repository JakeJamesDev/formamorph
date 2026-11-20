import { describe, it, expect } from 'vitest';
import { parseReleaseSummary } from './releaseSummary';
import { tileCells, type TileCell } from './tileLayout';

const summary = (sections: string) => parseReleaseSummary(`# Formamorph v1.0.0\n\nLead.\n\n${sections}`).summary;

/** Each cell as `kind:title:span`, Fixes as `fixes:span`. */
const shape = (cells: TileCell[]) =>
  cells.map((c) => (c.kind === 'fixes' ? `fixes:${c.span}` : `${c.kind}:${c.item.title}:${c.span}`));

describe('tileCells', () => {
  it('pairs a Major with its nested item, and a bare Major with the next New item', () => {
    const cells = tileCells(summary([
      '## Major', '',
      '- ⏳ **A** — a.',
      '- 🗓️ **B** — b.',
      '  - **B pair** — nested.', '',
      '## New', '',
      '- **N1** — n.',
      '- **N2** — n.', '',
      '## Fixes', '',
      'Fixed things.',
    ].join('\n')));
    expect(shape(cells)).toEqual(['major:A:2', 'new:N1:1', 'major:B:2', 'new:B pair:1', 'new:N2:1', 'fixes:2']);
  });

  it('spans a Major across the row when no New item is left for it', () => {
    const cells = tileCells(summary(['## Major', '', '- ⏳ **A** — a.', '- 🎨 **B** — b.', '', '## New', '', '- **N1** — n.'].join('\n')));
    expect(shape(cells)).toEqual(['major:A:2', 'new:N1:1', 'major:B:3']);
  });

  it('gives Fixes a full row when the New rows are full', () => {
    const news = ['- **N1** — n.', '- **N2** — n.', '- **N3** — n.'];
    const cells = tileCells(summary(['## New', '', ...news, '', '## Fixes', '', 'Fixed.'].join('\n')));
    expect(shape(cells)).toEqual(['new:N1:1', 'new:N2:1', 'new:N3:1', 'fixes:3']);
  });

  it('gives Fixes the one empty cell after two leftover New items', () => {
    const cells = tileCells(summary(['## New', '', '- **N1** — n.', '- **N2** — n.', '', '## Fixes', '', 'Fixed.'].join('\n')));
    expect(shape(cells)).toEqual(['new:N1:1', 'new:N2:1', 'fixes:1']);
  });

  it('shows no Fixes tile when the summary has no fixes', () => {
    expect(shape(tileCells(summary(['## New', '', '- **N1** — n.'].join('\n'))))).toEqual(['new:N1:1']);
  });
});
