import { parseBodies } from '@/lib/bodies';
import type { Body } from '@/types';

/** A Body from its slots alone, with the layout a world file without one loads with. */
export const bodyFixture = (body: { id: string; name: string; entries: { slotId: string; capacity?: number }[] }): Body =>
  parseBodies([body])[0];
