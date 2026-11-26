import { toast } from 'react-toastify';

/** Copies through a selected, hidden text box: the path left when a frame's permissions policy blocks the clipboard API. */
function copyBySelection(text: string): boolean {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const box = document.createElement('textarea');
  box.value = text;
  box.readOnly = true;
  box.style.position = 'fixed';
  box.style.opacity = '0';
  document.body.appendChild(box);
  box.focus();
  box.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    box.remove();
    focused?.focus();
  }
}

/** Copies text to the clipboard. Resolves false when the write fails. */
export function copyText(text: string): Promise<boolean> {
  let write: Promise<void>;
  // An insecure page has no clipboard API; that counts as a failed write.
  try { write = navigator.clipboard.writeText(text); } catch (error) { write = Promise.reject(error); }
  return write.then(() => true, () => copyBySelection(text));
}

/** Copies text to the clipboard and confirms with a toast. */
export function copyWithToast(text: string): void {
  void copyText(text).then((copied) => {
    if (copied) toast.success('Copied');
    else toast.error("Couldn't copy the text");
  });
}
