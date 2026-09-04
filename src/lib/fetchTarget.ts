/** The URL a `fetch` argument names, in whichever of its three forms the caller used. */
export function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
