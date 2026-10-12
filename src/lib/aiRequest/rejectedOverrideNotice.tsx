import { toastError } from '@/lib/linkToast';
import { AiStreamError } from './aiStream';
import { rejectedEndpointOverrideLabel, type RejectedEndpointOverride } from './rejectedOverride';
import type { RejectedOverrideFailure } from './requestTransport';

/** Disables and explains the endpoint override a structured rejection named. */
export function surfaceRejectedEndpointOverride(
  { error, override, endpointId, presetName }: RejectedOverrideFailure,
  disable: (endpointId: string, override: RejectedEndpointOverride) => void,
): void {
  disable(endpointId, override);
  const serverMessage = error instanceof AiStreamError ? error.serverError?.message : undefined;
  toastError(
    error,
    { headline: serverMessage ?? 'The server rejected this request.' },
    `${rejectedEndpointOverrideLabel(override)} override disabled for ${presetName}.`,
  );
}
