import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { DownloadLinkedContent } from './DownloadLinkedContent';
import { addonTabs, downloadItemCount, type AddonRow, type DependencyRow } from '@/lib/worldDependencies';
import type { WorldDownloadPlan } from '@/lib/useWorldDownloadPlan';

afterEach(cleanup);

const addon = (id: string, name: string, reviewState?: AddonRow['reviewState']): AddonRow =>
  ({ _id: id, name, kind: 'entity', author: { username: 'ann' }, ...(reviewState ? { reviewState } : {}) });

/** The real plan shape, with the real tab split behind it — only the two reads are supplied by hand. */
const planFor = (
  dependencies: DependencyRow[], addons: AddonRow[], selected: string[] = [], toggle = vi.fn(),
): WorldDownloadPlan => {
  const tabs = addonTabs(addons);
  return {
    dependencies,
    tabs,
    toggle,
    plan: { addons: selected.map((id) => ({ id, name: id })) },
    count: downloadItemCount(dependencies, addons, selected),
    hasLinkedContent: dependencies.length > 0 || tabs.approved.length > 0 || tabs.community.length > 0,
    loading: false,
  };
};

const required = (id: string, name: string): DependencyRow => ({
  id, status: 'ok', listing: { _id: id, name, kind: 'dictionary' },
});

/** Radix activates a tab on mousedown, not on click, so a plain click leaves the panel where it was. */
const selectTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

describe('DownloadLinkedContent', () => {
  it('shows the world\'s required sources as included', () => {
    render(<DownloadLinkedContent review={planFor([required('r1', 'Shared Lore')], [])} />);

    expect(screen.getByRole('tab', { name: 'Required (1)' })).toBeInTheDocument();
    expect(screen.getByText('Shared Lore')).toBeInTheDocument();
    expect(screen.getByText(/Included/)).toBeInTheDocument();
  });

  it('draws nothing for a world that follows nothing', () => {
    const { container } = render(<DownloadLinkedContent review={planFor([], [])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('separates approved add-ons from community ones and offers each as a checkbox', () => {
    render(<DownloadLinkedContent review={planFor([], [addon('a1', 'Blessed', 'approved'), addon('a2', 'Wild')])} />);

    selectTab('Approved Add-ons (1)');
    expect(screen.getByRole('checkbox', { name: 'Blessed' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Wild' })).not.toBeInTheDocument();

    selectTab('Community Add-ons (1)');
    expect(screen.getByRole('checkbox', { name: 'Wild' })).toBeInTheDocument();
  });

  it('offers a declined add-on in neither tab', () => {
    // The world author turned this one away. Their own download review must not offer it back to them.
    render(<DownloadLinkedContent review={planFor([], [addon('a1', 'Blessed', 'approved'), addon('a2', 'Turned Away', 'declined')])} />);

    expect(screen.getByRole('tab', { name: 'Approved Add-ons (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Community Add-ons (0)' })).toBeInTheDocument();
    selectTab('Community Add-ons (0)');
    expect(screen.queryByText('Turned Away')).not.toBeInTheDocument();
  });

  it('reports a required source the server can no longer resolve', () => {
    render(<DownloadLinkedContent review={planFor([{ id: 'r1', status: 'not_found' }], [])} />);
    expect(screen.getByText(/no longer on the server/)).toBeInTheDocument();
  });

  it('hands the player\'s tick back as a selection', () => {
    const toggle = vi.fn();
    render(<DownloadLinkedContent review={planFor([], [addon('a1', 'Blessed', 'approved')], [], toggle)} />);

    selectTab('Approved Add-ons (1)');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Blessed' }));
    expect(toggle).toHaveBeenCalledWith({ id: 'a1', name: 'Blessed' }, true);
  });
});
