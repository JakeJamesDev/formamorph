const REDACTED = '[redacted]';

const SECRET_WORDS = new Set(['key', 'apikey', 'token', 'password', 'passwd', 'pass', 'pwd', 'secret', 'auth', 'sig', 'signature']);

// Whole words only, so `max_tokens` and `author` keep their values.
const isSecretName = (name: string): boolean =>
  name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).some((word) => SECRET_WORDS.has(word));

/** The url with query values and a url password that look secret replaced by a mask; nothing else changes. */
export function redactUrl(url: string): string {
  const masked = url.replace(/^([a-z][\w+.-]*:\/\/[^/?#@:]*):[^/?#@]*@/i, `$1:${REDACTED}@`);
  const hashAt = masked.indexOf('#');
  const end = hashAt === -1 ? masked.length : hashAt;
  const queryAt = masked.indexOf('?');
  if (queryAt === -1 || queryAt > end) return masked;

  const query = masked.slice(queryAt + 1, end).split('&').map((pair) => {
    const eq = pair.indexOf('=');
    return eq !== -1 && isSecretName(pair.slice(0, eq)) ? `${pair.slice(0, eq)}=${REDACTED}` : pair;
  });
  return `${masked.slice(0, queryAt + 1)}${query.join('&')}${masked.slice(end)}`;
}
