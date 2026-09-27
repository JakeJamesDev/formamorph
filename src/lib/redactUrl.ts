export const REDACTED = '[redacted]';

const SECRET_PARAM = /key|token|pass|secret|auth|sig/i;

/** The url with query values and a url password that look secret replaced by a mask; nothing else changes. */
export function redactUrl(url: string): string {
  const masked = url.replace(/^([a-z][\w+.-]*:\/\/[^/?#@:]*):[^/?#@]*@/i, `$1:${REDACTED}@`);
  const hashAt = masked.indexOf('#');
  const end = hashAt === -1 ? masked.length : hashAt;
  const queryAt = masked.indexOf('?');
  if (queryAt === -1 || queryAt > end) return masked;

  const query = masked.slice(queryAt + 1, end).split('&').map((pair) => {
    const eq = pair.indexOf('=');
    return eq !== -1 && SECRET_PARAM.test(pair.slice(0, eq)) ? `${pair.slice(0, eq)}=${REDACTED}` : pair;
  });
  return `${masked.slice(0, queryAt + 1)}${query.join('&')}${masked.slice(end)}`;
}
