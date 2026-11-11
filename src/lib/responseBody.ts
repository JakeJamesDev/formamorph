import { DetailedError } from './errorDetails';
import { redactUrl } from './redactUrl';

const HTML_START =/^<(?:!doctype\s+html|html[\s>]|head[\s>]|!--)/i;
const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
// Cloudflare wraps the id in markup, such as `Ray ID: <strong>…</strong>`.
const RAY_ID = /Ray ID:\s*(?:<[^>]*>\s*)*([0-9a-f]{16})/i;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole;
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

/** True when the body is an HTML page, such as a proxy's error page. */
export function isHtmlBody(raw: string): boolean {
  return HTML_START.test(raw.trim());
}

/** A response body as Error Details text: an HTML page becomes its title and Ray ID; other text stays as sent. */
export function describeResponseBody(raw: string): string {
  if (!raw.trim()) return '(empty)';
  if (!isHtmlBody(raw)) return raw;
  const title = decodeEntities(TITLE.exec(raw)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const ray = RAY_ID.exec(raw)?.[1];
  return [title ? `HTML page "${title}"` : 'HTML page (no title)', ray && `(Ray ID: ${ray})`].filter(Boolean).join(' ');
}

/** A response's JSON body. An HTML page throws a DetailedError that names the page, not a bare SyntaxError. */
export async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (isHtmlBody(raw)) {
    const details = [
      ...(response.url ? [`URL: ${redactUrl(response.url)}`] : []),
      `Status: ${[response.status, response.statusText].filter(Boolean).join(' ')}`,
      '',
      'Response:',
      describeResponseBody(raw),
    ].join('\n');
    throw new DetailedError('The server sent back a web page instead of data. Check the address.', details, response.status);
  }
  return JSON.parse(raw);
}
