import { describe, it, expect } from 'vitest';
import { DEV_MODAL_TABS } from './devRoutes';
import { SETTINGS_TABS } from '@/components/modals/settingsTabs';

// The parser is module-private; re-derive it here against the documented hash grammar so the encode
// (window.__fmDev.goto) and decode stay pinned to the same shape.
function parseHash(hash: string): { view?: string; modal?: string; tab?: string } | null {
  if (!hash.startsWith('#dev')) return null;
  const params = new URLSearchParams(hash.slice('#dev'.length).replace(/^\?/, ''));
  const route: { view?: string; modal?: string; tab?: string } = {};
  const view = params.get('view');
  const modal = params.get('modal');
  const tab = params.get('tab');
  if (view) route.view = view;
  if (modal) route.modal = modal;
  if (tab) route.tab = tab;
  return route;
}

describe('dev-router hash parsing', () => {
  it('ignores hashes that are not #dev', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#/some/route')).toBeNull();
  });

  it('decodes view/modal/tab from a #dev hash', () => {
    expect(parseHash('#dev?view=gameViewer&modal=settings&tab=prompts')).toEqual({
      view: 'gameViewer',
      modal: 'settings',
      tab: 'prompts',
    });
  });

  it('omits absent fields (a bare #dev is an empty route, not null)', () => {
    expect(parseHash('#dev')).toEqual({});
    expect(parseHash('#dev?modal=settings')).toEqual({ modal: 'settings' });
  });
});

describe('dev-router coverage guard', () => {
  // Drift guard: the Settings surface renders its triggers from SETTINGS_TABS, so if a tab is added or
  // renamed there without updating the DEV_MODAL_TABS ledger, this fails — forcing conscious coverage.
  it('ledger lists exactly the Settings modal tabs the surface renders', () => {
    expect([...DEV_MODAL_TABS.settings]).toEqual(SETTINGS_TABS.map((t) => t.value));
  });
});
