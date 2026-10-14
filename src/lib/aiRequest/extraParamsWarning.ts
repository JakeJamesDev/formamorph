import { toast } from 'react-toastify';
import { readExtraParams } from '@/lib/extraParams';

let warned = false;

/** Warns once per session when a request goes out without its endpoint's unusable Extra Parameters. */
export function noteUnusableExtraParams(text: string | undefined): void {
  if (warned || !('error' in readExtraParams(text))) return;
  warned = true;
  toast.warning("This endpoint's Extra Parameters have an error. Requests go out without them.");
}

/** Clears the once-per-session flag. Tests only. */
export function resetExtraParamsWarning(): void {
  warned = false;
}
