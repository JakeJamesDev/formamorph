// The "Sends to …" line under a button's tip, kept apart from the settings hook so it reads without them.

/** The line naming an endpoint preset and, when it differs from the name, its model. */
export function endpointTipLine(name: string, model: string): string {
  const shown = model.trim();
  return `Sends to ${name}${shown && shown !== name ? ` · ${shown}` : ''}`;
}

/** `tip` with the endpoint line under it; the tip alone when there is no line. */
export function withEndpointLine(tip: string, line: string): string {
  return line ? `${tip}\n${line}` : tip;
}
