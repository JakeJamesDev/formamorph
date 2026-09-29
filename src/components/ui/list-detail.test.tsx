import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ListDetail, ListDetailBack, ListDetailFirstRow } from './list-detail';
import { PanelTabContent, PanelTabs } from './panel-tabs';
import { FileText, Tag } from 'lucide-react';

// Minimal MediaQueryList stub so `useIsMobile` resolves to a fixed value (mirrors useIsMobile.test.tsx).
function mockMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    media: '',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })));
}

afterEach(() => vi.unstubAllGlobals());

const base = {
  list: <div>LIST-CONTENT</div>,
  detail: <div>DETAIL-CONTENT</div>,
  onBack: () => {},
  backLabel: 'List',
};

describe('ListDetail', () => {
  // The arrow moved from a row of ListDetail's own into the detail's header; the detail places it.
  const placed = { ...base, detail: <div><ListDetailBack /><span>DETAIL-CONTENT</span></div> };

  it('desktop: shows list and detail together, with no arrow even where the detail places one', () => {
    mockMatchMedia(false);
    render(<ListDetail {...placed} showDetail backLabel="Placeholders" />);
    expect(screen.getByText('LIST-CONTENT')).toBeTruthy();
    expect(screen.getByText('DETAIL-CONTENT')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('mobile: draws no back row of its own; the detail places an icon arrow named "Back to <list>"', () => {
    mockMatchMedia(true);
    const { unmount } = render(<ListDetail {...base} showDetail backLabel="Placeholders" />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    render(<ListDetail {...placed} showDetail backLabel="Placeholders" />);
    const back = screen.getByRole('button', { name: 'Back to Placeholders' });
    expect(back).toHaveTextContent('');
  });

  it('mobile: clicking the arrow calls onBack', () => {
    mockMatchMedia(true);
    const onBack = vi.fn();
    render(<ListDetail {...placed} showDetail backLabel="Placeholders" onBack={onBack} />);
    screen.getByRole('button', { name: 'Back to Placeholders' }).click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('stacked: pushes the detail over the list with the arrow at desktop width', () => {
    mockMatchMedia(false);
    const onBack = vi.fn();
    render(<ListDetail {...placed} stacked showDetail backLabel="Traits" onBack={onBack} />);
    const back = screen.getByRole('button', { name: 'Back to Traits' });
    // The list stays mounted underneath, as on the mobile push.
    expect(screen.getByText('LIST-CONTENT')).toBeTruthy();
    back.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('never hands the arrow to the list or the footer', () => {
    mockMatchMedia(true);
    render(<ListDetail {...base} list={<ListDetailBack />} detailFooter={<ListDetailBack />} showDetail backLabel="Traits" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  const TABS = [
    { value: 'a', label: 'Alpha', icon: Tag },
    { value: 'b', label: 'Beta', icon: FileText },
  ] as const;
  const tabbed = (inner?: ReactNode) => (
    <PanelTabs tabs={TABS} value="a" onValueChange={() => {}} stripLabel="Outer Fields">
      <PanelTabContent value="a">{inner}</PanelTabContent>
    </PanelTabs>
  );

  it("a tabbed detail leads its strip with the arrow, in the strip's own row, and places it once", () => {
    mockMatchMedia(true);
    const nested = <PanelTabs tabs={TABS} value="a" onValueChange={() => {}} stripLabel="Inner Fields">{null}</PanelTabs>;
    render(<ListDetail {...base} detail={tabbed(<><ListDetailBack />{nested}</>)} showDetail backLabel="Entities" />);
    const strip = screen.getByRole('tablist', { name: 'Outer Fields' });
    const row = strip.parentElement!;
    const arrow = within(row).getByRole('button', { name: 'Back to Entities' });
    expect(row.firstElementChild).toBe(arrow);
    // It takes the strip's fill, so the row reads as one bar.
    expect(strip).toHaveClass('bg-muted');
    expect(arrow).toHaveClass('bg-muted');
    expect(screen.getAllByRole('button', { name: /^Back to / })).toHaveLength(1);
    // A nested strip keeps its plain form.
    expect(screen.getByRole('tablist', { name: 'Inner Fields' }).parentElement!.firstElementChild)
      .toBe(screen.getByRole('tablist', { name: 'Inner Fields' }));
  });

  it('a stacked push inside a push gets its own arrow, and each leads its own strip', () => {
    mockMatchMedia(true);
    const inner = (
      <ListDetail {...base} detail={<PanelTabs tabs={TABS} value="a" onValueChange={() => {}} stripLabel="Inner Fields">{null}</PanelTabs>} stacked showDetail backLabel="Traits" />
    );
    render(<ListDetail {...base} detail={tabbed(inner)} showDetail backLabel="Entities" />);
    const lead = (strip: string) => screen.getByRole('tablist', { name: strip }).parentElement!.firstElementChild;
    expect(lead('Outer Fields')).toHaveAccessibleName('Back to Entities');
    expect(lead('Inner Fields')).toHaveAccessibleName('Back to Traits');
  });

  it('a strip-less detail leads its first row with the arrow, and renders the row bare side by side', () => {
    mockMatchMedia(true);
    const detail = <ListDetailFirstRow><label>Group Name<input /></label></ListDetailFirstRow>;
    const { unmount } = render(<ListDetail {...base} detail={detail} showDetail backLabel="Entities" />);
    const row = screen.getByLabelText('Group Name').closest('label')!.parentElement!.parentElement!;
    expect(row.firstElementChild).toHaveAccessibleName('Back to Entities');
    expect(row.firstElementChild).not.toHaveClass('bg-muted');
    unmount();
    mockMatchMedia(false);
    render(<ListDetail {...base} detail={detail} showDetail backLabel="Entities" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('paints the push with the page color at the top level, and with the panel color when stacked inside one', () => {
    mockMatchMedia(true);
    const { unmount } = render(<ListDetail {...base} showDetail backLabel="Entities" />);
    const panel = () => screen.getByText('DETAIL-CONTENT').closest('.absolute') as HTMLElement;
    expect(panel()).toHaveClass('bg-background');
    unmount();
    mockMatchMedia(false);
    render(<ListDetail {...base} stacked showDetail backLabel="Traits" />);
    expect(panel()).toHaveClass('bg-card');
    expect(panel()).not.toHaveClass('bg-background');
  });

  it('freezes the detail footer below the detail scroll, side by side and in the push', () => {
    const footer = <div>DETAIL-FOOTER</div>;
    const frozen = () => {
      const foot = screen.getByText('DETAIL-FOOTER');
      const scroller = screen.getByText('DETAIL-CONTENT').closest('[data-radix-scroll-area-viewport]');
      expect(scroller).not.toBeNull();
      expect(scroller!.contains(foot)).toBe(false);
      // The next sibling of the detail's scroll root, inside the same column.
      expect(scroller!.parentElement!.nextElementSibling).toBe(foot);
    };
    mockMatchMedia(false);
    const { unmount } = render(<ListDetail {...base} detailFooter={footer} showDetail />);
    frozen();
    unmount();
    mockMatchMedia(true);
    render(<ListDetail {...base} detailFooter={footer} showDetail />);
    frozen();
  });

  it('stacked: hides the detail panel from assistive tech while the list shows', () => {
    mockMatchMedia(false);
    render(<ListDetail {...base} stacked showDetail={false} backLabel="Traits" />);
    expect(screen.getByText('DETAIL-CONTENT').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
