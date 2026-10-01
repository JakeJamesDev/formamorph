import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookOpen, Search } from 'lucide-react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { renderReporting as render } from '@/test/surfaceReporter';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { PanelTabContent, PanelTabs } from './panel-tabs';
import { SurfaceLayer } from './surface';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

afterEach(cleanup);

const surface = () => surfaceRegistry.get();

function SettingsDialog({ open, uncontrolled = false }: { open: boolean; uncontrolled?: boolean }) {
  const [tab, setTab] = useState('display');
  return (
    <Dialog open={open}>
      <DialogContent surface="settings" aria-describedby={undefined}>
        <DialogTitle>Settings</DialogTitle>
        <Tabs
          surfaceTabs="settings"
          {...(uncontrolled ? { defaultValue: 'display' } : { value: tab, onValueChange: setTab })}
        >
          <TabsList>
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>
          <TabsContent value="display">Display body</TabsContent>
          <TabsContent value="data">Data body</TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

describe('the shared dialog', () => {
  it('reports its surface and its active tab while open, and clears both at close', async () => {
    const view = render(<SurfaceLayer id="mainMenu"><SettingsDialog open /></SurfaceLayer>);
    expect(surface()).toEqual({ screen: 'mainMenu', dialog: 'settings', tabs: ['settings.display'] });

    await userEvent.click(screen.getByRole('tab', { name: 'Data' }));
    expect(surface().tabs).toEqual(['settings.data']);

    view.rerender(<SurfaceLayer id="mainMenu"><SettingsDialog open={false} /></SurfaceLayer>);
    await waitFor(() => expect(surface()).toEqual({ screen: 'mainMenu', dialog: null, tabs: [] }));
  });

  it('reports nothing before it opens', () => {
    render(<SurfaceLayer id="mainMenu"><SettingsDialog open={false} /></SurfaceLayer>);
    expect(surface()).toEqual({ screen: 'mainMenu', dialog: null, tabs: [] });
  });

  it('returns to the first dialog when a dialog over it closes', async () => {
    function Stack({ second }: { second: boolean }) {
      return (
        <SurfaceLayer id="mainMenu">
          <SettingsDialog open />
          <Dialog open={second}>
            <DialogContent surface="errorDetails" aria-describedby={undefined}>
              <DialogTitle>Error Details</DialogTitle>
            </DialogContent>
          </Dialog>
        </SurfaceLayer>
      );
    }
    const view = render(<Stack second={false} />);
    view.rerender(<Stack second />);
    expect(surface()).toEqual({ screen: 'mainMenu', dialog: 'errorDetails', tabs: [] });
    view.rerender(<Stack second={false} />);
    await waitFor(() => expect(surface()).toEqual({ screen: 'mainMenu', dialog: 'settings', tabs: ['settings.display'] }));
  });
});

describe('a dialog with no surface', () => {
  it('reports nothing, and keeps the tabs inside it out of the screen under it', () => {
    render(
      <SurfaceLayer id="mainMenu">
        <Dialog open>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Confirm</DialogTitle>
            <Tabs surfaceTabs="settings" value="display"><TabsList><TabsTrigger value="display">Display</TabsTrigger></TabsList></Tabs>
          </DialogContent>
        </Dialog>
      </SurfaceLayer>,
    );
    expect(surface()).toEqual({ screen: 'mainMenu', dialog: null, tabs: [] });
  });

  it('keeps what the player typed when its surface starts or stops', async () => {
    function Picker({ reports }: { reports: boolean }) {
      return (
        <Dialog open>
          <DialogContent surface={reports ? 'menu' : undefined} aria-describedby={undefined}>
            <DialogTitle>Saves</DialogTitle>
            <input aria-label="Filter" />
          </DialogContent>
        </Dialog>
      );
    }
    const view = render(<Picker reports />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter' }), 'autumn');
    view.rerender(<Picker reports={false} />);
    expect(screen.getByRole('textbox', { name: 'Filter' })).toHaveValue('autumn');
    expect(surface().dialog).toBeNull();
    view.rerender(<Picker reports />);
    expect(screen.getByRole('textbox', { name: 'Filter' })).toHaveValue('autumn');
    expect(surface().dialog).toBe('menu');
  });
});

describe('the shared tab strips', () => {
  it('reports the tab of a strip that keeps its own value', async () => {
    render(<SettingsDialog open uncontrolled />);
    expect(surface().tabs).toEqual(['settings.display']);
    await userEvent.click(screen.getByRole('tab', { name: 'Data' }));
    expect(surface().tabs).toEqual(['settings.data']);
  });

  it('reports nothing from a strip with no ledger', () => {
    render(
      <SurfaceLayer id="mainMenu">
        <Tabs value="a"><TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList></Tabs>
      </SurfaceLayer>,
    );
    expect(surface().tabs).toEqual([]);
  });

  it('reports the tab a panel shows, which is the first tab when the chosen one is hidden', () => {
    const TABS = [
      { value: 'details', label: 'Details', icon: BookOpen },
      { value: 'code', label: 'Code', icon: Search },
    ] as const;
    function Panel({ tabs, value }: { tabs: readonly (typeof TABS)[number][]; value: 'details' | 'code' }) {
      return (
        <SurfaceLayer id="worldEditor">
          <PanelTabs tabs={tabs} value={value} onValueChange={() => {}} stripLabel="Stat Fields" surfaceTabs="worldEditorStat">
            <PanelTabContent value="details">Details body</PanelTabContent>
            <PanelTabContent value="code">Code body</PanelTabContent>
          </PanelTabs>
        </SurfaceLayer>
      );
    }
    const view = render(<Panel tabs={TABS} value="code" />);
    expect(surface().tabs).toEqual(['worldEditorStat.code']);
    // Simple mode hides the Code tab.
    view.rerender(<Panel tabs={TABS.slice(0, 1)} value="code" />);
    expect(surface().tabs).toEqual(['worldEditorStat.details']);
  });
});
