/** A Blob as the AppData reader sends it across (electron/profileMergeSource.cjs). */
interface WireBlob {
  __blob: true;
  type: string;
  base64: string;
}

const isWireBlob = (value: unknown): value is WireBlob =>
  !!value && typeof value === 'object' && (value as { __blob?: unknown }).__blob === true
  && typeof (value as WireBlob).base64 === 'string';

function toBlob({ base64, type }: WireBlob): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** The record with every wire blob turned back into a Blob. */
export function reviveBlobs<T>(value: T): T {
  if (isWireBlob(value)) return toBlob(value) as T;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, reviveBlobs(inner)])) as T;
}
