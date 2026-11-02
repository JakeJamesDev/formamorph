// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { PublishModal } from './PublishModal';
import PolicyService from '@/services/PolicyService';
import WorldStorageService from '@/services/WorldStorageService';
import AuthService from '@/services/AuthService';
import type { PublishPayload } from '@/lib/publishPayload';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/lib/jsonFileWorkerUtils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await (await import('@/test/inlineJsonWorker')).inlineJsonWorker()),
}));

const payload: PublishPayload = {
  kind: 'world',
  name: 'A World',
  description: 'Blurb.',
  contentData: { worldOverview: { name: 'A World', tags: [] } },
};

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(PolicyService, 'fetchPolicies').mockResolvedValue({ uploadGate: null, tagNotice: null, privacyPolicy: null });
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([]);
  vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a refused publish', () => {
  it("shows the server's reason from an errors array", async () => {
    const body = JSON.stringify({ errors: [{ msg: 'Thumbnail is required' }] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: false, status: 400, text: async () => body, json: async () => JSON.parse(body) },
    ));

    render(<PublishModal open onOpenChange={() => {}} isAuthenticated payload={payload} />);
    await waitFor(() => expect(PolicyService.fetchPolicies).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Thumbnail is required')).toBeTruthy();
  });
});
