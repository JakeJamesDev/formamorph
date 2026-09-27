import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** The visible text of each toast a mocked toast function was called with; a link toast reads as its message plus its link. */
export function toastTexts(fn: { mock: { calls: unknown[][] } }): string[] {
  return fn.mock.calls.map(([body]) => {
    if (!isValidElement(body)) return String(body);
    return new DOMParser().parseFromString(renderToStaticMarkup(body), 'text/html').body.textContent ?? '';
  });
}
