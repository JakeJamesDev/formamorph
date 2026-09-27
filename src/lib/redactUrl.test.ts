import { describe, expect, it } from 'vitest';
import { redactUrl } from './redactUrl';

describe('redactUrl', () => {
  it('masks keys, tokens and passwords in the query string, whatever their case', () => {
    expect(redactUrl('https://host.test/v1?key=abc&Access_Token=def&password=ghi&apiKey=jkl&model=m'))
      .toBe('https://host.test/v1?key=[redacted]&Access_Token=[redacted]&password=[redacted]&apiKey=[redacted]&model=m');
  });

  it('keeps a value whose name only contains a secret word', () => {
    expect(redactUrl('https://host.test/v1?max_tokens=512&author=ana&design=b'))
      .toBe('https://host.test/v1?max_tokens=512&author=ana&design=b');
  });

  it('masks a password in the url itself and keeps the user name', () => {
    expect(redactUrl('https://ana:hunter2@host.test/v1')).toBe('https://ana:[redacted]@host.test/v1');
    expect(redactUrl('https://ana@host.test/v1')).toBe('https://ana@host.test/v1');
  });

  it('leaves the fragment and a url with nothing secret unchanged', () => {
    expect(redactUrl('https://host.test/v1?token=abc#page')).toBe('https://host.test/v1?token=[redacted]#page');
    expect(redactUrl('https://host.test/v1#section?token=abc')).toBe('https://host.test/v1#section?token=abc');
    expect(redactUrl('http://localhost:1234/v1/chat/completions')).toBe('http://localhost:1234/v1/chat/completions');
    expect(redactUrl('https://host.test/v1?stream&model=a%20b')).toBe('https://host.test/v1?stream&model=a%20b');
  });
});
