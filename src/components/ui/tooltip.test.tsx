import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { Tip, TooltipProvider } from './tooltip';

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
