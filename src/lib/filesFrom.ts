import type { ChangeEvent } from 'react';

/**
 * The files a file-input change carries, read *before* the input is reset — `Array.from` copies the handles
 * out of the live `FileList`, so clearing `value` (which lets the same file be picked again) can't strip
 * them out from under a later `await file.text()`. A leaf, so the account site can reuse it.
 */
export function filesFrom(event: ChangeEvent<HTMLInputElement>): File[] {
  const files = Array.from(event.target.files ?? []);
  event.target.value = '';
  return files;
}
