import { toast } from 'react-toastify';

/** Copies text to the clipboard. Resolves false when the write fails. */
export function copyText(text: string): Promise<boolean> {
  let write: Promise<void>;
  // An insecure page has no clipboard API; that counts as a failed write.
  try { write = navigator.clipboard.writeText(text); } catch (error) { write = Promise.reject(error); }
  return write.then(() => true, () => false);
}

/** Copies text to the clipboard and confirms with a toast. */
export function copyWithToast(text: string): void {
  void copyText(text).then((copied) => {
    if (copied) toast.success('Copied');
    else toast.error("Couldn't copy the text");
  });
}
