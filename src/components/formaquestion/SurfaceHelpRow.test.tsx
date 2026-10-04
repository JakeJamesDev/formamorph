import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { createGuide } from '@/lib/formaquestion/guide';
import { DEFAULT_HELP_SETTINGS } from '@/lib/formaquestion/helpSettings';
import { SurfaceLayer, useSurfaceTab } from '@/components/ui/surface';
import { renderReporting as render } from '@/test/surfaceReporter';
import { useGuideView, type FormaquestionTab } from './formaquestionTabs';
import { GuideBody } from './GuideBody';
import type { HelpChat } from './useHelpChat';

// The headings the surface map names for the Main Menu, Settings and its Display tab.
const PAGES = {
  Home: '# 🏠 Home\n\nWelcome.\n',
  Library: '# 📚 Library\n\nYour worlds are here.\n',
  Settings: '# ⚙️ Settings\n\nSettings change the app.\n\n## Display\n\nDisplay sets the look.\n',
};
const SIDEBAR = '- [Home](Home)\n- [Library](Library)\n- [Settings](Settings)\n';
const guide = createGuide(createDocsIndex({ pages: PAGES, sidebar: SIDEBAR }));

/** An empty conversation: these tests are about the guide's first row. */
const NO_CHAT: HelpChat = {
  exchanges: [], busy: false, held: false, readsImages: false, pending: [], setPending: () => {}, ask: () => {}, stop: () => {}, clear: () => {},
};

afterEach(cleanup);

function Window({ wide = false, tab = 'search' }: { wide?: boolean; tab?: FormaquestionTab }) {
  const [view, changeView] = useGuideView();
  return (
    <GuideBody guide={guide} failed={false} onRetry={() => {}} view={{ ...view, tab: view.sectionId ? view.tab : tab }} onViewChange={changeView} wide={wide} chat={NO_CHAT} settings={DEFAULT_HELP_SETTINGS} onSettingsChange={() => {}} onGo={() => {}} />
  );
}

function SettingsTab({ tab }: { tab: string }) {
  useSurfaceTab('settings', tab);
  return null;
}

/** The app with the Main Menu open, the window beside it, and whatever is open over the menu. */
function renderApp(over: ReactNode = null, window: ReactNode = <Window />) {
  return render(
    <>
      {window}
      <SurfaceLayer id="mainMenu">{over}</SurfaceLayer>
    </>,
  );
}

const helpRow = () => screen.queryByRole('group', { name: 'Help for This Screen' });
const reader = () => screen.queryByRole('article');

describe('Help for This Screen', () => {
  it('is the first item when the window opens, and one press shows the section', () => {
    renderApp();
    const row = helpRow()!;
    expect(row.compareDocumentPosition(screen.getByText('Type two or more letters')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: '📚 Library' }));
    expect(reader()).toHaveAccessibleName('📚 Library: 📚 Library');
    expect(reader()).toHaveTextContent('Your worlds are here.');
  });

  it('names the section for the open dialog and tab, and follows the Surface while the window is open', () => {
    const view = renderApp(<SurfaceLayer id="settings"><SettingsTab tab="display" /></SurfaceLayer>);
    expect(within(helpRow()!).getByRole('button')).toHaveTextContent('Display');

    view.rerender(
      <>
        <Window />
        <SurfaceLayer id="mainMenu"><SurfaceLayer id="settings" /></SurfaceLayer>
      </>,
    );
    expect(within(helpRow()!).getByRole('button')).toHaveTextContent('⚙️ Settings');

    view.rerender(
      <>
        <Window />
        <SurfaceLayer id="mainMenu" />
      </>,
    );
    expect(within(helpRow()!).getByRole('button')).toHaveTextContent('📚 Library');
  });

  it('shows nothing for a surface players never see', () => {
    renderApp(<SurfaceLayer id="adminPanel" />);
    expect(helpRow()).toBeNull();
  });

  it('shows nothing when no screen reports', () => {
    render(<Window />);
    expect(helpRow()).toBeNull();
  });

  it('shows nothing when the guide has no section for the Surface', () => {
    // The fixture guide has no How to Play page.
    render(
      <>
        <Window />
        <SurfaceLayer id="gameViewer" />
      </>,
    );
    expect(helpRow()).toBeNull();
  });

  it('gives way to search results in the Search tab', () => {
    renderApp();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'worlds' } });
    expect(screen.getByRole('list', { name: 'Search Results' })).toBeInTheDocument();
    expect(helpRow()).toBeNull();
  });

  it('is the first item of the Guide contents list', () => {
    renderApp(null, <Window tab="guide" />);
    const contents = screen.getByRole('navigation', { name: 'Guide Contents' });
    expect(helpRow()!.compareDocumentPosition(contents) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is the first item of the wide rail, and gives way to search results there', () => {
    renderApp(null, <Window wide />);
    const contents = screen.getByRole('navigation', { name: 'Guide Contents' });
    expect(helpRow()!.compareDocumentPosition(contents) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(helpRow()!).getByRole('button'));
    expect(reader()).toHaveTextContent('Your worlds are here.');
    // The row marks the section the reader shows.
    expect(within(helpRow()!).getByRole('button')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'worlds' } });
    expect(helpRow()).toBeNull();
  });
});
