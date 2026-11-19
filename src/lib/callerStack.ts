const text = (value: unknown, key: string): string => {
  const field = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  return typeof field === 'string' ? field : '';
};

/**
 * `error`, raised in a browser callback, restated on `origin`: an `Error` made when the work started.
 *
 * A callback's own stack never reaches the code that started the work, and Safari's `DOMException`s carry
 * none, so `origin` keeps the stack and takes the error's name and message.
 *
 * @param fallback - The message when `error` has none
 */
export function atCaller(origin: Error, error: unknown, fallback: string): Error {
  origin.name = text(error, 'name') || 'Error';
  origin.message = text(error, 'message') || fallback;
  return origin;
}
