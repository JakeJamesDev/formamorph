import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Slot } from '@radix-ui/react-slot';
import {
  Tip, Tooltip, TooltipPopup, TooltipPortal, TooltipPositioner, TooltipProvider, TooltipTrigger,
} from './tooltip';

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

  it('leaves the control its own ref, which its call site is still using', () => {
    // The sweep wraps controls that already hand their node somewhere — a sortable's `setNodeRef`, a chip's
    // `innerRef`. If the trigger took that ref for itself, drag and the find bar would go quietly dead.
    const seen: HTMLElement[] = [];
    renderTip(
      <Tip tip="Drag to reorder">
        <span ref={(el) => { if (el) seen.push(el); }} id="grip">g</span>
      </Tip>,
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].id).toBe('grip');
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
