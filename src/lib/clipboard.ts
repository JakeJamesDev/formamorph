import { toast } from 'react-toastify';

/** Copies text to the clipboard and confirms with a toast. */
export function copyWithToast(text: string): void {
  let write: Promise<void>;
  // An insecure page has no clipboard API; that failure gets the same toast.
  try { write = navigator.clipboard.writeText(text); } catch (error) { write = Promise.reject(error); }
  void write.then(
    () => toast.success('Copied'),
    () => toast.error("Couldn't copy the text"),
  );
}
