import { describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { helpWorld } from '@/lib/formaquestion/helpWorld';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import { runToolCall } from '@/lib/tools/toolRunner';
import type { PlayerStat } from '@/types';

/** What the World Editor registers for Formaquestion: the full authored world, AI text and hidden stats included. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const secret: PlayerStat = {
  id: 'secret', name: 'Suspicion', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], hidden: true,
};
const GET_ENTITY = TOOL_CATALOG.find((t) => t.id === 'get_entity')!;

describe('the World Editor registers the full world for Formaquestion', () => {
  it('gives a Tool the AI description and the code test the hidden stat', async () => {
    renderWorldEditorBench(benchEditorWorld({ stats: [secret] }), 'advanced');
    await waitFor(() => expect(helpWorld.get()?.authored().stats.map((s) => s.id)).toEqual(['secret']));
    const found = await runToolCall(GET_ENTITY, '{"name": "Odd Wick"}', helpWorld.get()!.snapshot());
    expect(found.text).toContain('Keeps the harbor lamps lit.');
  });
});
