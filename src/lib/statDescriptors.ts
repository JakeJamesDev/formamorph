import type { Stat, StatDescriptor } from '@/types';

/** The low, medium and high bands every added stat starts with, worded for `name`. */
export const defaultDescriptorBands = (name: string): Omit<StatDescriptor, 'id'>[] => [
  { threshold: 30, description: `${name} is low` },
  { threshold: 60, description: `${name} is medium` },
  { threshold: 100, description: `${name} is high` },
];

/**
 * The descriptors a stat update stores: each one whose text is still exactly a default built from the
 * name before the update is rebuilt from the name after it, and every other one is left as written. The
 * match is exact, so an edited default stays the author's. Returns `after`'s own array when nothing changes.
 */
export const followRename = (before: Stat, after: Stat): Stat['descriptors'] => {
  const descriptors = after.descriptors;
  if (!descriptors || before.name === after.name) return descriptors;
  const stale = defaultDescriptorBands(before.name).map((band) => band.description);
  const fresh = defaultDescriptorBands(after.name).map((band) => band.description);
  let changed = false;
  const next = descriptors.map((descriptor) => {
    const index = stale.indexOf(descriptor.description);
    if (index === -1) return descriptor;
    changed = true;
    return { ...descriptor, description: fresh[index] };
  });
  return changed ? next : descriptors;
};
