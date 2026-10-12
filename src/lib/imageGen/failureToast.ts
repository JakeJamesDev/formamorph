import { linkToast, toastError } from '@/lib/linkToast';
import type { ToastText } from '@/lib/errorDetails';
import { ImageConnectionError } from './http';
import type { ImageProviderId } from './types';

interface SetupGuideState {
  open: boolean;
  // Kept after close so the dialog's exit animation still has its title.
  provider: ImageProviderId;
}

let state: SetupGuideState = { open: false, provider: 'comfyui' };
const listeners = new Set<() => void>();
const publish = (next: SetupGuideState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** Opens the image setup guide for this provider, from anywhere toasts are mounted. */
export function openImageSetupGuide(provider: ImageProviderId): void {
  publish({ open: true, provider });
}

export function closeImageSetupGuide(): void {
  publish({ ...state, open: false });
}

export function subscribeImageSetupGuide(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getImageSetupGuideState(): SetupGuideState {
  return state;
}

/** Toasts a failed image request: the setup guide for an unreachable server, Error Details for the rest. */
export function toastImageFailure(error: unknown, toastText: ToastText): void {
  if (error instanceof ImageConnectionError) {
    const { provider } = error;
    linkToast(error.message, 'Fix connection →', () => openImageSetupGuide(provider));
  } else {
    toastError(error, toastText);
  }
}
