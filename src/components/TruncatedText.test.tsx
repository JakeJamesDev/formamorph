import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TruncatedText } from './TruncatedText';

const NAME = 'The Long Road Between Two Quiet Harbors';
const tipFor = () => screen.queryByText(NAME, { selector: 'div' });

/** Stub: jsdom has no layout, so each test sets the box and content widths a browser would report. */
const setWidths = (scroll: number, client: number) => {
  Object.defineProperty(Element.prototype, 'scrollWidth', { configurable: true, get: () => scroll });
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => client });
};

afterEach(() => {
  delete (Element.prototype as { scrollWidth?: number }).scrollWidth;
  delete (Element.prototype as { clientWidth?: number }).clientWidth;
});

const show = () => render(<TooltipProvider><TruncatedText text={NAME} /></TooltipProvider>);

describe('TruncatedText', () => {
  it('shows the full text in the tooltip when the text is cut off', async () => {
    setWidths(300, 120);
    show();
    await userEvent.hover(screen.getByText(NAME));
    expect(await screen.findByText(NAME, { selector: 'div' })).toBeVisible();
  });

  it('shows no tooltip when the text fits', async () => {
    setWidths(120, 120);
    show();
    await userEvent.hover(screen.getByText(NAME));
    // Past the shared open delay, a live tip would be up.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(tipFor()).toBeNull();
  });
});
