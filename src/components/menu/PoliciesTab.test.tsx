import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PoliciesTab } from './PoliciesTab';
import PolicyService from '@/services/PolicyService';
import type { AdminPolicy } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const policy = (over: Partial<AdminPolicy> = {}): AdminPolicy => ({
  enabled: true,
  title: 'Contributor Terms',
  body: 'Be excellent.',
  tags: [],
  acceptanceVersion: 1,
  updatedAt: '2026-07-01T00:00:00.000Z',
  ...over,
});

const stubPolicies = (over: { uploadGate?: AdminPolicy; tagNotice?: AdminPolicy } = {}) =>
  vi.spyOn(PolicyService, 'fetchForAdmin').mockResolvedValue({
    uploadGate: over.uploadGate ?? policy(),
    tagNotice: over.tagNotice ?? policy({ title: 'Tagged Content', tags: ['isekai'] }),
  });

/** Radix tab triggers activate on mousedown, not on a bare click. */
const selectTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the body field', () => {
  it('is the markdown editor, not a bare textarea', async () => {
    // Readers see this rendered, so it is authored the way the world editor's prose is.
    stubPolicies();

    render(<PoliciesTab active />);
    await screen.findByRole('heading', { name: 'Upload Gate' });

    expect(screen.getByRole('tab', { name: 'Preview' })).toBeTruthy();
    expect(screen.getByLabelText('Bold')).toBeTruthy();
    expect(screen.getByLabelText('Upload Gate body')).toBeTruthy();
  });

  it('gives the tag notice its own editor too', async () => {
    stubPolicies();

    render(<PoliciesTab active />);
    await screen.findByRole('heading', { name: 'Upload Gate' });
    selectTab('Tag Notice');

    expect(await screen.findByLabelText('Tag Notice body')).toBeTruthy();
  });
});

describe('the policy sub-tabs', () => {
  it('opens on the upload gate and shows only its editor', async () => {
    stubPolicies();

    render(<PoliciesTab active />);
    await screen.findByRole('heading', { name: 'Upload Gate' });

    // The tag notice's own controls belong to the other panel.
    expect(screen.queryByLabelText('Tags')).toBeNull();
  });

  it('swaps to the tag notice, which is the only place tags are edited', async () => {
    stubPolicies();

    render(<PoliciesTab active />);
    await screen.findByRole('heading', { name: 'Upload Gate' });

    selectTab('Tag Notice');

    expect(await screen.findByLabelText('Tags')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Upload Gate' })).toBeNull();
  });

  it('keeps Reset Everyone with the gate it resets', async () => {
    // It only ever clears gate acceptances, so it has no meaning beside the tag notice.
    stubPolicies();

    render(<PoliciesTab active />);
    expect(await screen.findByRole('button', { name: /Reset Everyone/ })).toBeTruthy();

    selectTab('Tag Notice');

    await waitFor(() => expect(screen.queryByRole('button', { name: /Reset Everyone/ })).toBeNull());
  });

  it('opens on the sub-tab the dev-router asked for', async () => {
    stubPolicies();

    render(<PoliciesTab active initialTab="tagNotice" />);

    expect(await screen.findByLabelText('Tags')).toBeTruthy();
  });

  it('keeps the strip on screen while the drafts load', async () => {
    // Returning a bare skeleton took the tabs off screen and put them back on every open.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(PolicyService, 'fetchForAdmin').mockImplementation(async () => {
      await gate;
      return { uploadGate: policy(), tagNotice: policy() };
    });

    render(<PoliciesTab active />);

    expect(await screen.findByRole('tab', { name: 'Upload Gate' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Tag Notice' })).toBeTruthy();

    release();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Upload Gate' })).toBeTruthy());
  });
});
