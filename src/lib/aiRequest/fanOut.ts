/** One handler that calls every handler in `handlers` with the event, in order. */
export function fanOut<E>(handlers: readonly ((event: E) => void)[]): (event: E) => void {
  return (event) => { for (const handler of handlers) handler(event); };
}
