import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useImageDropTarget } from './useImageDropTarget';

/** A slot inside a pane — the shape the gallery renders, where both are drop targets. */
const Nested = ({ innerEnabled, onInner, onOuter }: {
  innerEnabled: boolean;
  onInner: (url: string) => void;
  onOuter: (url: string) => void;
}) => {
  const outer = useImageDropTarget({ enabled: true, allowFiles: true, onUrl: onOuter, onFiles: vi.fn() });
  const inner = useImageDropTarget({ enabled: innerEnabled, allowFiles: true, onUrl: onInner, onFiles: vi.fn() });
  return (
    <div data-testid="pane" {...outer.dropProps} data-drag={String(outer.dragOver)}>
      <div data-testid="slot" {...inner.dropProps} data-drag={String(inner.dragOver)}>slot</div>
    </div>
  );
};

const link = {
  files: [] as unknown as FileList,
  types: ['text/uri-list'],
  getData: (t: string) => (t === 'text/uri-list' ? 'https://files.example/a.png' : ''),
};

describe('useImageDropTarget nesting', () => {
  it('lets the slot take its own drop, without the pane taking it as well', () => {
    const onInner = vi.fn();
    const onOuter = vi.fn();
    render(<Nested innerEnabled onInner={onInner} onOuter={onOuter} />);

    fireEvent.drop(screen.getByTestId('slot'), { dataTransfer: link });

    expect(onInner).toHaveBeenCalledWith('https://files.example/a.png');
    expect(onOuter).not.toHaveBeenCalled();
  });

  it('passes the drop to the pane when the slot turns it down', () => {
    const onInner = vi.fn();
    const onOuter = vi.fn();
    render(<Nested innerEnabled={false} onInner={onInner} onOuter={onOuter} />);

    fireEvent.drop(screen.getByTestId('slot'), { dataTransfer: link });

    expect(onInner).not.toHaveBeenCalled();
    expect(onOuter).toHaveBeenCalledWith('https://files.example/a.png');
  });

  it('marks only the slot while a drag sits over one that accepts it', () => {
    render(<Nested innerEnabled onInner={vi.fn()} onOuter={vi.fn()} />);

    fireEvent.dragOver(screen.getByTestId('slot'), { dataTransfer: link });

    expect(screen.getByTestId('slot').getAttribute('data-drag')).toBe('true');
    // Both lit at once would read as two places the picture could land.
    expect(screen.getByTestId('pane').getAttribute('data-drag')).toBe('false');
  });

  it('marks the pane when the slot under the drag will not take it', () => {
    render(<Nested innerEnabled={false} onInner={vi.fn()} onOuter={vi.fn()} />);

    fireEvent.dragOver(screen.getByTestId('slot'), { dataTransfer: link });

    expect(screen.getByTestId('pane').getAttribute('data-drag')).toBe('true');
  });
});
