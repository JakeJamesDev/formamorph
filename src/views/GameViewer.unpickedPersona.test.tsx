import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { Entity, EntityStart, World } from '@/types';

/** A Persona-Only entity the player did not pick is never in the story: not present, not known. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const NARRATOR_PROMPT = 'Narrate the scene.';

const stay = (id: string, place: string): EntityStart[] => [{ id: `s-${id}`, place, weight: 1, schedule: [{ id: `w-${id}`, time: 'allDay', action: { kind: 'stay', place } }] }];
const hero: Entity = { id: 'hero', name: 'Heroine', persona: true, personaOnly: true, kind: 'unique', locations: ['harbor'], starts: stay('hero', 'harbor') };
// Placed at the player's start, with a Known In pick there.
const ghost: Entity = {
  id: 'ghost', name: 'Ghostwind', persona: true, personaOnly: true, kind: 'unique', locations: ['inn'], knownIn: ['harbor'], starts: stay('ghost', 'inn'),
};
const bram: Entity = { id: 'bram', name: 'Bramwell', kind: 'unique', locations: ['harbor'], starts: stay('bram', 'harbor') };

const cassia: Entity = { id: 'cassia', name: 'Cassia', kind: 'unique', locations: ['inn'], knownIn: ['harbor'], starts: stay('cassia', 'inn') };

const world = (): World => {
  const base = harborWorld({ entities: [hero, ghost, bram, cassia] });
  return {
    ...base,
    locations: [...base.locations, { id: 'inn', name: 'Inn' }],
    worldOverview: { ...base.worldOverview, promptOverrides: { systemPrompt: `${NARRATOR_PROMPT}\nHERE: <ENTITIES|name>\nKNOWN: <ENTITIES|known.name>` } },
  };
};

let narrations: string[];
let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };

function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Leave'));
    if (system.startsWith(NARRATOR_PROMPT)) {
      narrations.push(system);
      return sseResponse(sseReply('The bell rings.'));
    }
    return sseResponse(sseReply('No changes.'));
  }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  narrations = [];
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

describe('an unpicked Persona-Only entity at the player\'s location with a Known In pick there', () => {
  it('is absent from the narrator request, while the cast stays in', async () => {
    renderGameViewer(world(), { inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'hero' } } });
    const box = await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint();
    fireEvent.change(box, { target: { value: 'I look around.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(narrations).toHaveLength(1));
    expect(Object.keys(live!.entityPositions).sort()).toEqual(['bram', 'cassia']);
    expect(narrations[0]).toContain('Bramwell');
    expect(narrations[0]).toContain('Cassia');
    expect(narrations[0]).not.toContain('Ghostwind');
  });
});
