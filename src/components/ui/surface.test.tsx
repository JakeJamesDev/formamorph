import { act, cleanup, render as renderBare, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { useSurface } from '@/lib/surface/useSurface';
import { renderReporting as render } from '@/test/surfaceReporter';
import { SurfaceLayer, SurfaceReporterContext, SurfaceTab, useSurfaceTab } from './surface';

afterEach(cleanup);

function TabHost({ ledger, tab }: { ledger: Parameters<typeof useSurfaceTab>[0]; tab: string | null }) {
  useSurfaceTab(ledger, tab);
  return null;
}

describe('SurfaceLayer', () => {
  it('reports its id while it is mounted, and clears it at unmount', () => {
    const view = render(<SurfaceLayer id="mainMenu" />);
    expect(surfaceRegistry.get().screen).toBe('mainMenu');
    view.unmount();
    expect(surfaceRegistry.get()).toEqual({ screen: null, dialog: null, tabs: [] });
  });

  it('puts a dialog that opens inside a dialog on top, and returns to the first at close', () => {
    function Nested({ inner }: { inner: boolean }) {
      return (
        <SurfaceLayer id="mainMenu">
          <SurfaceLayer id="community">
            {inner && <SurfaceLayer id="profile" />}
          </SurfaceLayer>
        </SurfaceLayer>
      );
    }
    const view = render(<Nested inner />);
    expect(surfaceRegistry.get()).toMatchObject({ screen: 'mainMenu', dialog: 'profile' });
    view.rerender(<Nested inner={false} />);
    expect(surfaceRegistry.get()).toMatchObject({ screen: 'mainMenu', dialog: 'community' });
  });

  it('puts the dialog that opens later on top, wherever it is in the tree', () => {
    function Siblings({ first, second }: { first: boolean; second: boolean }) {
      return (
        <SurfaceLayer id="gameViewer">
          {second && <SurfaceLayer id="errorDetails" />}
          {first && <SurfaceLayer id="settings" />}
        </SurfaceLayer>
      );
    }
    const view = render(<Siblings first second={false} />);
    view.rerender(<Siblings first second />);
    expect(surfaceRegistry.get().dialog).toBe('errorDetails');
    view.rerender(<Siblings first second={false} />);
    expect(surfaceRegistry.get().dialog).toBe('settings');
  });

  it('follows a change of id', () => {
    const view = render(<SurfaceLayer id="mainMenu" />);
    view.rerender(<SurfaceLayer id="gameViewer" />);
    expect(surfaceRegistry.get().screen).toBe('gameViewer');
  });
});

describe('useSurfaceTab', () => {
  it('reports the tab of the layer it is in, outer tab first', () => {
    render(
      <SurfaceLayer id="settings">
        <TabHost ledger="settings" tab="prompts" />
        <TabHost ledger="settingsPrompts" tab="choices" />
      </SurfaceLayer>,
    );
    expect(surfaceRegistry.get()).toEqual({
      screen: null,
      dialog: 'settings',
      tabs: ['settings.prompts', 'settingsPrompts.choices'],
    });
  });

  it('keeps a nested tab after its outer tab when both mount together', () => {
    function Inner() {
      useSurfaceTab('settingsPrompts', 'narration');
      return null;
    }
    function Outer() {
      useSurfaceTab('settings', 'prompts');
      return <Inner />;
    }
    render(<SurfaceLayer id="settings"><Outer /></SurfaceLayer>);
    expect(surfaceRegistry.get().tabs).toEqual(['settings.prompts', 'settingsPrompts.narration']);
  });

  it('follows a tab change, and clears at unmount', () => {
    function Editor({ tab, panel }: { tab: string; panel: boolean }) {
      return (
        <SurfaceLayer id="worldEditor">
          <TabHost ledger="worldEditor" tab={tab} />
          {panel && <TabHost ledger="worldEditorStat" tab="code" />}
        </SurfaceLayer>
      );
    }
    const view = render(<Editor tab="stats" panel />);
    expect(surfaceRegistry.get().tabs).toEqual(['worldEditor.stats', 'worldEditorStat.code']);
    view.rerender(<Editor tab="traits" panel={false} />);
    expect(surfaceRegistry.get().tabs).toEqual(['worldEditor.traits']);
    view.unmount();
    expect(surfaceRegistry.get().tabs).toEqual([]);
  });

  it('reports nothing for no tab, or for a tab with no surface id', () => {
    const view = render(
      <SurfaceLayer id="gameViewer"><TabHost ledger="gameViewer" tab="model" /></SurfaceLayer>,
    );
    expect(surfaceRegistry.get().tabs).toEqual([]);
    view.rerender(<SurfaceLayer id="gameViewer"><TabHost ledger="gameViewer" tab={null} /></SurfaceLayer>);
    expect(surfaceRegistry.get().tabs).toEqual([]);
  });

  it('reports nothing outside a screen or dialog', () => {
    render(<TabHost ledger="mainMenu" tab="worlds" />);
    expect(surfaceRegistry.get()).toEqual({ screen: null, dialog: null, tabs: [] });
  });

  it('hides the tabs of the screen under a dialog', () => {
    render(
      <SurfaceLayer id="mainMenu">
        <TabHost ledger="mainMenu" tab="worlds" />
        <SurfaceLayer id="backup" />
      </SurfaceLayer>,
    );
    expect(surfaceRegistry.get()).toEqual({ screen: 'mainMenu', dialog: 'backup', tabs: [] });
  });
});

describe('with no reporter', () => {
  it('reports nothing and renders its children, as on the account site', () => {
    renderBare(
      <SurfaceLayer id="settings">
        <SurfaceTab ledger="settings" tab="display" />
        <p>Body</p>
      </SurfaceLayer>,
    );
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(surfaceRegistry.get()).toEqual({ screen: null, dialog: null, tabs: [] });
  });
});

describe('a reporter that arrives late', () => {
  it('gets the entries that were already mounted, each at its own place', () => {
    const tree = (
      <SurfaceLayer id="mainMenu">
        <TabHost ledger="mainMenu" tab="models" />
        <SurfaceLayer id="backup" />
      </SurfaceLayer>
    );
    const view = renderBare(<SurfaceReporterContext.Provider value={null}>{tree}</SurfaceReporterContext.Provider>);
    expect(surfaceRegistry.get()).toEqual({ screen: null, dialog: null, tabs: [] });
    view.rerender(<SurfaceReporterContext.Provider value={surfaceRegistry}>{tree}</SurfaceReporterContext.Provider>);
    expect(surfaceRegistry.get()).toEqual({ screen: 'mainMenu', dialog: 'backup', tabs: [] });
  });
});

describe('the names a report accepts', () => {
  it('are the app surface ids and tab ledgers, checked by the compiler', () => {
    // @ts-expect-error Not a surface id.
    render(<SurfaceLayer id="notASurface" />);
    render(
      <SurfaceLayer id="settings">
        {/* @ts-expect-error Not a tab ledger. */}
        <SurfaceTab ledger="notALedger" tab="display" />
      </SurfaceLayer>,
    );
    expect(surfaceRegistry.get()).toEqual({ screen: null, dialog: 'settings', tabs: [] });
  });
});

describe('SurfaceTab', () => {
  it('reports a tab from inside its dialog', () => {
    render(<SurfaceLayer id="publish"><SurfaceTab ledger="publish" tab="prompt" /></SurfaceLayer>);
    expect(surfaceRegistry.get()).toEqual({ screen: null, dialog: 'publish', tabs: ['publish.prompt'] });
  });
});

describe('useSurface', () => {
  it('re-renders its reader when the Surface changes', () => {
    function Reader() {
      const surface = useSurface();
      return <output>{surface.dialog ?? surface.screen ?? 'none'}</output>;
    }
    function App() {
      const [open, setOpen] = useState(false);
      return (
        <SurfaceLayer id="mainMenu">
          <Reader />
          <button onClick={() => setOpen((was) => !was)}>Toggle</button>
          {open && <SurfaceLayer id="feedbackHub" />}
        </SurfaceLayer>
      );
    }
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('mainMenu');
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('status')).toHaveTextContent('feedbackHub');
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('status')).toHaveTextContent('mainMenu');
  });
});
