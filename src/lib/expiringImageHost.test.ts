import { describe, it, expect } from 'vitest';
import { isExpiringImageHost } from './imageBytes';

describe('isExpiringImageHost', () => {
  it('flags Discord attachment links on both hosts', () => {
    expect(isExpiringImageHost('https://cdn.discordapp.com/attachments/1/2/pic.png')).toBe(true);
    expect(isExpiringImageHost('https://media.discordapp.net/attachments/1/2/pic.png')).toBe(true);
  });

  it('flags them with their signature params attached, which is how they are actually pasted', () => {
    expect(isExpiringImageHost(
      'https://cdn.discordapp.com/attachments/1/2/pic.png?ex=65d903de&is=65c68ede&hm=2481f3',
    )).toBe(true);
  });

  it('is case- and whitespace-insensitive, since this comes off a clipboard', () => {
    expect(isExpiringImageHost('  HTTPS://CDN.DISCORDAPP.COM/attachments/1/2/pic.png  ')).toBe(true);
  });

  // The false positive that would matter: Discord's non-attachment CDN paths are unsigned and permanent,
  // so warning about them would nag an author whose link is genuinely fine.
  it('leaves permanent Discord CDN paths alone', () => {
    expect(isExpiringImageHost('https://cdn.discordapp.com/embed/avatars/0.png')).toBe(false);
    expect(isExpiringImageHost('https://cdn.discordapp.com/avatars/123/abc.png')).toBe(false);
    expect(isExpiringImageHost('https://cdn.discordapp.com/emojis/123.png')).toBe(false);
    expect(isExpiringImageHost('https://cdn.discordapp.com/icons/123/abc.png')).toBe(false);
    expect(isExpiringImageHost('https://cdn.discordapp.com/app-icons/123/abc.png')).toBe(false);
  });

  it('leaves other hosts alone, including ones with an attachments path of their own', () => {
    expect(isExpiringImageHost('https://files.catbox.moe/abc.png')).toBe(false);
    expect(isExpiringImageHost('https://i.imgur.com/abc.png')).toBe(false);
    expect(isExpiringImageHost('https://example.com/attachments/1/2/pic.png')).toBe(false);
    expect(isExpiringImageHost('data:image/webp;base64,AAAA')).toBe(false);
    expect(isExpiringImageHost('')).toBe(false);
    expect(isExpiringImageHost(undefined)).toBe(false);
  });
});
