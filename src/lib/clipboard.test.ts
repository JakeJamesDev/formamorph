// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

const blockClipboard = () => vi.stubGlobal('navigator', {
  clipboard: { writeText: vi.fn(() => Promise.reject(new DOMException('Blocked by permissions policy', 'NotAllowedError'))) },
});

/** Stands in for the browser's copy command, recording the selection it copies. */
const stubCopyCommand = (result: boolean) => {
  const copied: string[] = [];
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: vi.fn((command: string) => {
      if (command === 'copy') copied.push((document.activeElement as HTMLTextAreaElement).value);
      return result;
    }),
  });
  return copied;
};

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'execCommand');
});

describe('copyText where the clipboard API is blocked', () => {
  it('copies through a selected text box and leaves none behind', async () => {
    blockClipboard();
    const copied = stubCopyCommand(true);
    await expect(copyText('TypeError: boom')).resolves.toBe(true);
    expect(copied).toEqual(['TypeError: boom']);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('puts focus back where it was', async () => {
    blockClipboard();
    stubCopyCommand(true);
    const button = document.body.appendChild(document.createElement('button'));
    button.focus();
    await copyText('x');
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it('reports a failure when the copy command fails too', async () => {
    blockClipboard();
    stubCopyCommand(false);
    await expect(copyText('x')).resolves.toBe(false);
  });
});
