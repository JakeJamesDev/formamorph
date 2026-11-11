import { describe, it, expect } from 'vitest';
import { DetailedError } from './errorDetails';
import { describeResponseBody, isHtmlBody, readJson } from './responseBody';

const CLOUDFLARE_502 = `<!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->
<head>
<title>lyonade.net | 502: Bad gateway</title>
</head>
<body>
<h1><span class="inline-block">Bad gateway</span> <span class="code-label">Error code 502</span></h1>
<span class="cf-icon-browser block md:hidden h-20 bg-center bg-no-repeat"></span>
<p>Cloudflare Ray ID: <strong class="font-semibold">8d4f0c2b9e1a7f36</strong></p>
</body>
</html>`;

describe('describeResponseBody', () => {
  it('cuts a Cloudflare error page to its title and Ray ID', () => {
    expect(describeResponseBody(CLOUDFLARE_502)).toBe('HTML page "lyonade.net | 502: Bad gateway" (Ray ID: 8d4f0c2b9e1a7f36)');
  });

  it('keeps JSON and plain text as sent', () => {
    const json = '{"error":{"message":"model not found"}}';
    expect(describeResponseBody(json)).toBe(json);
    expect(describeResponseBody('Internal Server Error')).toBe('Internal Server Error');
    expect(describeResponseBody('Error: <unknown> model')).toBe('Error: <unknown> model');
  });

  it('marks an empty body', () => {
    expect(describeResponseBody('')).toBe('(empty)');
    expect(describeResponseBody('  \n ')).toBe('(empty)');
  });

  it('decodes entities and collapses whitespace in the title', () => {
    const page = '<html><head><title>\n  Tom &amp; Jerry&#39;s &#x2014; &quot;down&quot;\n</title></head></html>';
    expect(describeResponseBody(page)).toBe('HTML page "Tom & Jerry\'s — "down""');
  });

  it('names a page with no title, and leaves out a missing Ray ID', () => {
    expect(describeResponseBody('<html><body>Bad gateway</body></html>')).toBe('HTML page (no title)');
  });

  it('knows a page by any of its usual first tags, after a BOM or whitespace', () => {
    for (const start of ['<!doctype html>', '<HTML lang="en">', '<html>', '<head>', '<!-- nginx -->', '﻿\n  <html>']) {
      expect(isHtmlBody(`${start}<title>t</title>`)).toBe(true);
    }
    for (const text of ['<htmlish>', '<!doctype xml>', 'see <html>', '<error>bad</error>']) {
      expect(isHtmlBody(text)).toBe(false);
    }
  });
});

describe('readJson', () => {
  it('parses a JSON body', async () => {
    await expect(readJson(new Response('{"ok":true}'))).resolves.toEqual({ ok: true });
  });

  it('names a web page instead of throwing a bare parse error', async () => {
    const page = new Response('<!doctype html><html><head><title>Formamorph</title></head></html>', { status: 200 });
    const error: unknown = await readJson(page).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DetailedError);
    expect((error as DetailedError).message).toBe('The server sent back a web page instead of data. Check the address.');
    expect((error as DetailedError).details).toContain('HTML page "Formamorph"');
  });

  it('still throws a SyntaxError for malformed JSON', async () => {
    await expect(readJson(new Response('{nope'))).rejects.toBeInstanceOf(SyntaxError);
  });
});
