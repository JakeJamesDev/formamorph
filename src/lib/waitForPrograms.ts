/** The part of three's per-material record this wait reads. */
interface MaterialRecord { currentProgram?: { isReady(): boolean } }

/** `renderer.properties`, narrowed to the one call this wait makes. */
interface MaterialRecords { get: (object: unknown) => unknown }

/**
 * Resolves once every material's shader program reports ready, or as soon as `stop` returns true.
 * A material with no program counts as done: three drops the record when the material or renderer is disposed.
 */
export function waitForPrograms(
  materials: Iterable<unknown>,
  records: MaterialRecords,
  stop: () => boolean,
  intervalMs = 10,
): Promise<void> {
  const pending = new Set(materials);
  return new Promise((resolve) => {
    const check = () => {
      if (stop()) { resolve(); return; }
      for (const material of pending) {
        const program = (records.get(material) as MaterialRecord | undefined)?.currentProgram;
        if (!program || program.isReady()) pending.delete(material);
      }
      if (pending.size === 0) resolve();
      else setTimeout(check, intervalMs);
    };
    check();
  });
}
