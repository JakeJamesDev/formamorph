import { toastError } from '@/lib/linkToast';
import type { AiRequestSpec } from './aiRequestSpec';
import { AiStreamError } from './aiStream';
import { rejectedEndpointOverride, rejectedEndpointOverrideLabel, type RejectedEndpointOverride } from './rejectedOverride';

/** Disables and explains a structured endpoint rejection. */
export function surfaceRejectedEndpointOverride(
  error: unknown,
  spec: AiRequestSpec,
  presetName: string,
  disable: (endpointId: string, override: RejectedEndpointOverride) => void,
): RejectedEndpointOverride | null {
  const override = rejectedEndpointOverride(error, spec);
  if (!override) return null;

  disable(spec.target.endpointId, override);
  const serverMessage = error instanceof AiStreamError ? error.serverError?.message : undefined;
  toastError(
    error,
    { headline: serverMessage ?? 'The server rejected this request.' },
    `${rejectedEndpointOverrideLabel(override)} override disabled for ${presetName}.`,
  );
  return override;
}
