import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readVramClass, vramClassForTotal } from './vramClass';

const shell = vi.hoisted(() => ({ desktop: true, answer: (): Promise<unknown> => Promise.resolve('low') }));

vi.mock('@/lib/imageGen/desktop', () => ({
  isLocalLlmAvailable: () => shell.desktop,
  desktopVramClass: () => shell.answer(),
}));

beforeEach(() => {
  shell.desktop = true;
  shell.answer = () => Promise.resolve('low');
});

describe('readVramClass', () => {
  it('passes the shell’s answer through', async () => {
    shell.answer = () => Promise.resolve('ok');
    expect(await readVramClass()).toBe('ok');
  });

  it('answers unknown outside the desktop build', async () => {
    shell.desktop = false;
    expect(await readVramClass()).toBe('unknown');
  });

  it('answers unknown when the shell fails or answers something else', async () => {
    shell.answer = () => Promise.reject(new Error('no handler'));
    expect(await readVramClass()).toBe('unknown');
    shell.answer = () => Promise.resolve('huge');
    expect(await readVramClass()).toBe('unknown');
  });
});

describe('vramClassForTotal', () => {
  it('reads the shell’s limit for the dev route', () => {
    expect(vramClassForTotal(8500)).toBe('low');
    expect(vramClassForTotal(8501)).toBe('ok');
  });
});
