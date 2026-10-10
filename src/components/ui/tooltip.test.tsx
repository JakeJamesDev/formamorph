import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Slot } from '@radix-ui/react-slot';
import {
  Tip, Tooltip, TooltipPopup, TooltipPortal, TooltipPositioner, TooltipProvider, TooltipTrigger,
} from './tooltip';

/** Live Base UI tooltip roots and portals, counted by pass-through wrappers. */
const mounted = vi.hoisted(() => ({ roots: 0, portals: 0 }));

vi.mock('@base-ui/react/tooltip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@base-ui/react/tooltip')>();
  const { useEffect, createElement } = await import('react');
  const counted = <P extends object>(Part: React.ComponentType<P>, key: keyof typeof mounted) =>
    function Counted(props: P) {
      useEffect(() => {
        mounted[key] += 1;
        return () => { mounted[key] -= 1; };
      }, []);
      return createElement(Part, props);
    };
  return {
    ...actual,
    Tooltip: {
      ...actual.Tooltip,
      Root: counted(actual.Tooltip.Root, 'roots'),
      Portal: counted(actual.Tooltip.Portal, 'portals'),
    },
  };
});

/** The app mounts the provider once at its root, so every case here runs through it. */
const renderTip = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe('a tip on a control', () => {
  it('shows its text when the control is focused', async () => {
    renderTip(
      <Tip tip="Delete world">
        <button type="button">
          <span aria-hidden="true">x</span>
        </button>
      </Tip>,
    );
    expect(screen.queryByText('Delete world')).toBeNull();

    await userEvent.tab();

    expect(screen.getByRole('button')).toHaveFocus();
    expect(screen.getByText('Delete world')).toBeVisible();
  });

  it('hides its text again when focus leaves', async () => {
    renderTip(
      <>
        <Tip tip="Delete world">
          <button type="button">x</button>
        </Tip>
        <button type="button">elsewhere</button>
      </>,
    );
    await userEvent.tab();
    expect(screen.getByText('Delete world')).toBeVisible();

    await userEvent.tab();

    expect(screen.queryByText('Delete world')).toBeNull();
  });

  it('opens nothing while disabled, and keeps the same control when it turns back on', async () => {
    const view = renderTip(
      <Tip tip="Expand" labelsChild={false} disabled>
        <button type="button">x</button>
      </Tip>,
    );
    const control = screen.getByRole('button');
    await userEvent.tab();
    expect(screen.queryByText('Expand')).toBeNull();

    view.rerender(
      <TooltipProvider>
        <Tip tip="Expand" labelsChild={false}>
          <button type="button">x</button>
        </Tip>
      </TooltipProvider>,
    );
    expect(screen.getByRole('button')).toBe(control);
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    expect(screen.getByText('Expand')).toBeVisible();
  });

  it('leaves the control its own ref, which its call site is still using', () => {
    // The sweep wraps controls that already hand their node somewhere — a sortable's `setNodeRef`, a chip's
    // `innerRef`. If the trigger took that ref for itself, drag and the find bar would go quietly dead.
    // A tip mounting with the provider re-attaches once as the shared root joins; judge the elements it got.
    const seen: (HTMLElement | null)[] = [];
    const { container } = renderTip(
      <Tip tip="Drag to reorder">
        <span ref={(el) => { seen.push(el); }} id="grip">g</span>
      </Tip>,
    );
    const grip = container.querySelector('#grip');
    expect(seen.at(-1)).toBe(grip);
    expect(seen.filter((el) => el !== null && el !== grip)).toEqual([]);
  });

  it('shares one control with a popover trigger', () => {
    // The prompt toolbar's split buttons carry both: the tip names the half, the popover opens the rest.
    renderTip(
      <Popover>
        <Tip tip="Heading level">
          <PopoverTrigger asChild>
            <button type="button"><span aria-hidden="true">v</span></button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent>the rest</PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Heading level' });
    // Radix's own attribute: the popover still holds the button it was given.
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.hasAttribute('data-base-ui-tooltip-trigger')).toBe(true);
  });

  it('renders the control itself, with no wrapper element around it', () => {
    const { container } = renderTip(
      <Tip tip="Delete world">
        <button type="button" id="target" className="mine">x</button>
      </Tip>,
    );
    expect(container.children).toHaveLength(1);
    const only = container.firstElementChild as HTMLElement;
    expect(only.tagName).toBe('BUTTON');
    expect(only.id).toBe('target');
    // The call site's own class survives the merge rather than being replaced by the trigger's.
    expect(only).toHaveClass('mine');
  });
});

describe('tips nobody has used', () => {
  it('mount no tooltip root or portal of their own', () => {
    const shell = renderTip(<button type="button">bare</button>);
    const baseline = { ...mounted };
    shell.unmount();

    renderTip(
      <>
        {['Delete world', 'Rename world', 'Duplicate world'].map((tip) => (
          <Tip key={tip} tip={tip}>
            <button type="button"><span aria-hidden="true">x</span></button>
          </Tip>
        ))}
      </>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(mounted).toEqual(baseline);
  });

  it('open on hover with their own text and side, one after another', async () => {
    renderTip(
      <>
        <Tip tip="Delete world" side="top"><button type="button">x</button></Tip>
        <Tip tip="Rename world" side="bottom"><button type="button">r</button></Tip>
      </>,
    );
    const [del, rename] = screen.getAllByRole('button');

    await userEvent.hover(del);
    const first = await screen.findByText('Delete world', { selector: 'div' });
    expect(first.closest('[data-side]')).toHaveAttribute('data-side', 'top');

    await userEvent.hover(rename);
    const second = await screen.findByText('Rename world', { selector: 'div' });
    expect(second.closest('[data-side]')).toHaveAttribute('data-side', 'bottom');
    expect(screen.queryByText('Delete world', { selector: 'div' })).toBeNull();
  });
});

describe('the accessible name', () => {
  it('is the tip text when the control brings none of its own', () => {
    renderTip(
      <Tip tip="Delete world">
        <button type="button"><span aria-hidden="true">x</span></button>
      </Tip>,
    );
    expect(screen.getByRole('button', { name: 'Delete world' })).toBeTruthy();
  });

  it('survives wrapping when the control already has one', () => {
    renderTip(
      <Tip tip="Remove this world from your library">
        <button type="button" aria-label="Delete world"><span aria-hidden="true">x</span></button>
      </Tip>,
    );
    expect(screen.getByRole('button', { name: 'Delete world' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove this world from your library' })).toBeNull();
  });

  it('is left to the control\'s visible text when the call site opts out', () => {
    renderTip(
      <Tip tip="12 characters in this world" labelsChild={false}>
        <button type="button">12</button>
      </Tip>,
    );
    expect(screen.getByRole('button', { name: '12' })).toBeTruthy();
  });

  it('is applied over visible text when the call site opts in', () => {
    renderTip(
      <Tip tip="12 characters in this world" labelsChild>
        <button type="button">12</button>
      </Tip>,
    );
    expect(screen.getByRole('button', { name: '12 characters in this world' })).toBeTruthy();
  });
});

describe('a tip when the page scrolls', () => {
  it('closes on a scroll of the document', async () => {
    renderTip(<Tip tip="Delete world"><button type="button">x</button></Tip>);
    await userEvent.tab();
    expect(screen.getByText('Delete world')).toBeVisible();

    fireEvent.scroll(document);

    expect(screen.queryByText('Delete world')).toBeNull();
  });

  it('closes on a scroll of a nested container', async () => {
    renderTip(
      <div data-testid="panel" style={{ overflow: 'auto' }}>
        <Tip tip="Delete world"><button type="button">x</button></Tip>
      </div>,
    );
    await userEvent.tab();
    expect(screen.getByText('Delete world')).toBeVisible();

    // A scroll event does not bubble, so only a capture listener hears the panel.
    fireEvent.scroll(screen.getByTestId('panel'));

    expect(screen.queryByText('Delete world')).toBeNull();
  });

  it('closes a hand-built tip on the exported root', async () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger aria-label="Undo" render={<button type="button" />} />
          <TooltipPortal>
            <TooltipPositioner>
              <TooltipPopup>Undo step list</TooltipPopup>
            </TooltipPositioner>
          </TooltipPortal>
        </Tooltip>
      </TooltipProvider>,
    );
    await userEvent.tab();
    expect(screen.getByText('Undo step list')).toBeVisible();

    fireEvent.scroll(document);

    expect(screen.queryByText('Undo step list')).toBeNull();
  });

  it('reports a close to the owner of a hand-built tip only when one was open', async () => {
    const onOpenChange = vi.fn();
    render(
      <TooltipProvider>
        <Tooltip onOpenChange={onOpenChange}>
          <TooltipTrigger aria-label="Undo" render={<button type="button" />} />
          <TooltipPortal>
            <TooltipPositioner>
              <TooltipPopup>Undo step list</TooltipPopup>
            </TooltipPositioner>
          </TooltipPortal>
        </Tooltip>
      </TooltipProvider>,
    );

    fireEvent.scroll(document);
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.tab();
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
    fireEvent.scroll(document);

    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it('opens again once focus returns to the control', async () => {
    renderTip(
      <>
        <Tip tip="Delete world"><button type="button">x</button></Tip>
        <button type="button">elsewhere</button>
      </>,
    );
    await userEvent.tab();
    fireEvent.scroll(document);
    expect(screen.queryByText('Delete world')).toBeNull();

    await userEvent.tab();
    await userEvent.tab({ shift: true });

    expect(screen.getByText('Delete world')).toBeVisible();
  });
});

describe('a tip when the pointer presses or drags', () => {
  /** Longer than the provider's 400 ms open delay, so a tip that was going to open has done so. */
  const pastOpenDelay = () => new Promise((resolve) => setTimeout(resolve, 500));

  // Hover, not focus: Base UI already closes a focus-opened tip on an outside press.
  const openOnHover = async () => {
    renderTip(<Tip tip="Delete world"><button type="button">x</button></Tip>);
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('Delete world')).toBeVisible();
  };

  it.each([
    ['a press anywhere', () => fireEvent.pointerDown(document.body)],
    ['a right-click', () => fireEvent.contextMenu(document.body)],
    ['a native drag', () => fireEvent.dragStart(document.body)],
  ])('closes on %s', async (_label, fire) => {
    await openOnHover();

    fire();

    expect(screen.queryByText('Delete world')).toBeNull();
  });

  it('closes on a press on the tip itself', async () => {
    // Base UI counts a press inside the popup as no outside press, so it leaves the tip open.
    await openOnHover();

    fireEvent.pointerDown(screen.getByText('Delete world'));

    expect(screen.queryByText('Delete world')).toBeNull();
  });

  it('opens nothing on hover while a pointer button is held, and again after release', async () => {
    renderTip(<Tip tip="Delete world"><button type="button">x</button></Tip>);
    const control = screen.getByRole('button');
    fireEvent.pointerDown(document.body);

    await userEvent.hover(control);
    await pastOpenDelay();
    expect(screen.queryByText('Delete world')).toBeNull();

    fireEvent.pointerUp(document.body);
    await userEvent.unhover(control);
    await userEvent.hover(control);

    expect(await screen.findByText('Delete world')).toBeVisible();
  });

  it('opens on hover again after the browser cancels the press', async () => {
    renderTip(<Tip tip="Delete world"><button type="button">x</button></Tip>);
    const control = screen.getByRole('button');
    fireEvent.pointerDown(document.body);
    await userEvent.hover(control);
    await pastOpenDelay();
    expect(screen.queryByText('Delete world')).toBeNull();

    fireEvent.pointerCancel(document.body);
    await userEvent.unhover(control);
    await userEvent.hover(control);

    expect(await screen.findByText('Delete world')).toBeVisible();
  });

  it('opens on hover again when the button was released outside the window', async () => {
    // The release goes to another window, so no pointerup arrives. Losing focus ends the hold.
    renderTip(<Tip tip="Delete world"><button type="button">x</button></Tip>);
    const control = screen.getByRole('button');
    fireEvent.pointerDown(document.body);
    fireEvent.blur(window);

    await userEvent.hover(control);

    expect(await screen.findByText('Delete world')).toBeVisible();
  });

  describe('on a hand-built tip', () => {
    const renderHandBuilt = () => render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger aria-label="Undo" render={<button type="button" />} />
          <TooltipPortal>
            <TooltipPositioner>
              <TooltipPopup>Undo step list</TooltipPopup>
            </TooltipPositioner>
          </TooltipPortal>
        </Tooltip>
      </TooltipProvider>,
    );

    it.each([
      ['a press', () => fireEvent.pointerDown(screen.getByText('Undo step list'))],
      ['a right-click', () => fireEvent.contextMenu(document.body)],
      ['a native drag', () => fireEvent.dragStart(document.body)],
    ])('closes on %s', async (_label, fire) => {
      renderHandBuilt();
      await userEvent.hover(screen.getByRole('button'));
      expect(await screen.findByText('Undo step list')).toBeVisible();

      fire();

      expect(screen.queryByText('Undo step list')).toBeNull();
    });

    it('opens nothing on hover while a pointer button is held, and again after release', async () => {
      renderHandBuilt();
      const control = screen.getByRole('button');
      fireEvent.pointerDown(document.body);

      await userEvent.hover(control);
      await pastOpenDelay();
      expect(screen.queryByText('Undo step list')).toBeNull();

      fireEvent.pointerUp(document.body);
      await userEvent.unhover(control);
      await userEvent.hover(control);

      expect(await screen.findByText('Undo step list')).toBeVisible();
    });
  });

  it('lets a keyboard focus open a tip while a pointer button is held', async () => {
    renderTip(<Tip tip="Delete world"><button type="button">x</button></Tip>);
    fireEvent.pointerDown(document.body);

    await userEvent.tab();

    expect(screen.getByText('Delete world')).toBeVisible();
    fireEvent.pointerUp(document.body);
  });
});

describe('a tip with no text', () => {
  const renderEmpty = (tip: string | null | undefined) =>
    renderTip(
      <Tip tip={tip}>
        <button type="button" aria-label="Delete world"><span aria-hidden="true">x</span></button>
      </Tip>,
    );

  it.each([
    ['an empty string', ''],
    ['undefined', undefined],
    ['null', null],
  ])('renders the bare child, with no trigger attached, for %s', (_label, tip) => {
    const { container } = renderEmpty(tip);
    const only = container.firstElementChild as HTMLElement;
    expect(only.tagName).toBe('BUTTON');
    expect(only.getAttribute('aria-label')).toBe('Delete world');
    // Base UI stamps every live trigger with this; its absence is the machinery's absence.
    expect(only.hasAttribute('data-base-ui-tooltip-trigger')).toBe(false);
  });

  it('opens nothing on focus', async () => {
    renderEmpty('');
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    expect(document.body.querySelectorAll('[data-side]')).toHaveLength(0);
  });
});

describe('a tip on a control another component already holds by ref', () => {
  /** The shape `TutorialPopover` uses: it anchors its explanation to whatever element it is handed. */
  const AnchorHolder = ({ onAnchor, children }: {
    onAnchor: (el: HTMLElement | null) => void;
    children: React.ReactNode;
  }) => <Slot ref={onAnchor}>{children}</Slot>;

  it('leaves that component the real element, and still opens on focus', async () => {
    // `Tip` is a plain function, so it cannot be the child here — the holder's ref would land on nothing
    // and the explanation would point at the page instead of the control. The parts compose instead.
    const anchors: (HTMLElement | null)[] = [];
    render(
      <TooltipProvider>
        <Tooltip>
          <AnchorHolder onAnchor={(el) => anchors.push(el)}>
            <TooltipTrigger aria-label="Feedback" render={<button type="button" id="feedback" />} />
          </AnchorHolder>
          <TooltipPortal>
            <TooltipPositioner>
              <TooltipPopup>Feedback</TooltipPopup>
            </TooltipPositioner>
          </TooltipPortal>
        </Tooltip>
      </TooltipProvider>,
    );

    expect(anchors.filter(Boolean).map((el) => el!.id)).toContain('feedback');

    await userEvent.tab();

    expect(screen.getByRole('button', { name: 'Feedback' })).toHaveFocus();
    expect(screen.getByText('Feedback', { selector: 'div' })).toBeVisible();
  });
});
