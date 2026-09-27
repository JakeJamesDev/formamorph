import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, within } from '@testing-library/react';
import { getErrorDetailsState, type ErrorDetails } from '@/lib/errorDetails';

/** The visible text of each toast a mocked toast function was called with; a link toast reads as its message plus its link. */
export function toastTexts(fn: { mock: { calls: unknown[][] } }): string[] {
  return fn.mock.calls.map(([body]) => {
    if (!isValidElement(body)) return String(body);
    return new DOMParser().parseFromString(renderToStaticMarkup(body), 'text/html').body.textContent ?? '';
  });
}

/** Presses View Details on the latest toast a mocked toast function raised, and returns what the window shows. */
export function openLatestDetails(fn: { mock: { calls: unknown[][] } }): ErrorDetails | null {
  const view = render(fn.mock.calls.at(-1)?.[0] as ReactNode);
  fireEvent.click(within(view.container).getByRole('button', { name: 'View Details →' }));
  view.unmount();
  return getErrorDetailsState().entry;
}
