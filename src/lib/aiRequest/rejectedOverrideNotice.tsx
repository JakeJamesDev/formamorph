import { toast } from 'react-toastify';
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
  toast.error(
    <div className="flex flex-col items-start gap-1">
      <span>{serverMessage ?? 'The server rejected this request.'}</span>
      <span>{rejectedEndpointOverrideLabel(override)} override disabled for {presetName}.</span>
    </div>,
    { position: 'top-right', autoClose: 8000, closeOnClick: false, pauseOnHover: true, draggable: true },
  );
  return override;
}
