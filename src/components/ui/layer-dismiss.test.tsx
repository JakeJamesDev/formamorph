import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ensureShieldedLayer } from './shielded-layer';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './context-menu';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from './alert-dialog';
import { Drawer, DrawerContent, DrawerTitle } from './drawer';

// jsdom has no PointerEvent; a MouseEvent carries the button Radix reads. The popover dismisses on the
// click that ends the press, so the press runs to its click.
function press(target: Element) {
  act(() => {
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
    }
    vi.advanceTimersByTime(1);
  });
}

function escape(target: HTMLElement) {
  act(() => target.focus());
  fireEvent.keyDown(target, { key: 'Escape' });
}

/** Radix registers its outside-press listener in a zero-delay timeout, which fake timers hold back. */
const settle = () => act(() => vi.advanceTimersByTime(1));

/** The help window: content portaled into the shielded layer, as the real one is. */
function HelpWindow({ children }: { children?: ReactNode }) {
  const [layer] = useState(() => ensureShieldedLayer());
  return createPortal(
    <div>
      <button>Help button</button>
      <input aria-label="Help field" />
      {children}
    </div>,
    layer,
  );
}

function PagePopover() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger>Page trigger</PopoverTrigger>
      <PopoverContent aria-label="Page popover">Page popover body</PopoverContent>
    </Popover>
  );
}

function PageSelect() {
  return (
    <Select defaultOpen defaultValue="One">
      <SelectTrigger aria-label="Page select"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="One">One</SelectItem>
        <SelectItem value="Two">Two</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PageMenu() {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild><div>Page tile</div></ContextMenuTrigger>
      <ContextMenuContent aria-label="Page menu">
        <ContextMenuItem>Rename</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** A popover that renders inline inside the help window, as the window's own popovers do. */
function HelpPopover() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger>Help trigger</PopoverTrigger>
      <PopoverContent portal={false} aria-label="Help popover">Help popover body</PopoverContent>
    </Popover>
  );
}

/** A context menu portaled into the help window. */
function HelpMenu() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setContainer}>
      <ContextMenu>
        <ContextMenuTrigger asChild><div>Help tile</div></ContextMenuTrigger>
        {container && (
          <ContextMenuContent container={container} aria-label="Help menu">
            <ContextMenuItem>Copy</ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>
    </div>
  );
}

const helpButton = () => screen.getByRole('button', { name: 'Help button' });
const helpField = () => screen.getByRole('textbox', { name: 'Help field' });

const PAGE_POPUPS = [
  { name: 'popover', Popup: PagePopover, open: () => undefined, query: () => screen.queryByRole('dialog', { name: 'Page popover' }) },
  { name: 'select', Popup: PageSelect, open: () => undefined, query: () => screen.queryByRole('listbox') },
  {
    name: 'context menu',
    Popup: PageMenu,
    open: () => fireEvent.contextMenu(screen.getByText('Page tile'), { clientX: 10, clientY: 10 }),
    query: () => screen.queryByRole('menu', { name: 'Page menu' }),
  },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each(PAGE_POPUPS)('a $name below the help window', ({ Popup, open, query }) => {
  function renderOpen() {
    render(<><Popup /><HelpWindow /></>);
    open();
    settle();
    expect(query()).toBeInTheDocument();
  }

  it('stays open on a press in the help window', () => {
    renderOpen();
    press(helpButton());
    expect(query()).toBeInTheDocument();
  });

  it('stays open when focus moves into the help window', () => {
    renderOpen();
    act(() => helpField().focus());
    expect(query()).toBeInTheDocument();
  });

  it('stays open on Escape in the help window', () => {
    renderOpen();
    escape(helpField());
    expect(query()).toBeInTheDocument();
  });

  it('still closes on a press outside the help window', () => {
    renderOpen();
    press(document.body);
    expect(query()).not.toBeInTheDocument();
  });
});

const PAGE_DIALOGS = [
  {
    name: 'dialog',
    Surface: () => (
      <Dialog defaultOpen>
        <DialogContent aria-describedby={undefined}><DialogTitle>Page dialog</DialogTitle></DialogContent>
      </Dialog>
    ),
    role: 'dialog',
  },
  {
    name: 'alert dialog',
    Surface: () => (
      <AlertDialog defaultOpen>
        <AlertDialogContent aria-describedby={undefined}><AlertDialogTitle>Page dialog</AlertDialogTitle></AlertDialogContent>
      </AlertDialog>
    ),
    role: 'alertdialog',
  },
  {
    name: 'drawer',
    Surface: () => (
      <Drawer defaultOpen>
        <DrawerContent aria-describedby={undefined}><DrawerTitle>Page dialog</DrawerTitle></DrawerContent>
      </Drawer>
    ),
    role: 'dialog',
  },
];

describe.each(PAGE_DIALOGS)('a $name below the help window', ({ Surface, role }) => {
  // The drawer stays mounted once closed, so the state attribute tells open from closed.
  const isOpen = () => screen.queryByRole(role, { name: 'Page dialog' })?.getAttribute('data-state') === 'open';

  it('stays open on Escape in the help window', () => {
    render(<><Surface /><HelpWindow /></>);
    settle();
    // A modal dialog hides the rest of the page from the accessibility tree.
    escape(screen.getByRole('textbox', { name: 'Help field', hidden: true }));
    expect(isOpen()).toBe(true);
  });

  it('still closes on Escape outside the help window', () => {
    render(<><Surface /><HelpWindow /></>);
    settle();
    expect(isOpen()).toBe(true);
    fireEvent.keyDown(screen.getByRole(role, { name: 'Page dialog' }), { key: 'Escape' });
    expect(isOpen()).toBe(false);
  });
});

describe('a popup inside the help window', () => {
  it('closes a popover on a press elsewhere in help', () => {
    render(<HelpWindow><HelpPopover /></HelpWindow>);
    settle();
    press(helpButton());
    expect(screen.queryByRole('dialog', { name: 'Help popover' })).not.toBeInTheDocument();
  });

  it('closes a menu on a press elsewhere in help', () => {
    render(<HelpWindow><HelpMenu /></HelpWindow>);
    fireEvent.contextMenu(screen.getByText('Help tile'), { clientX: 10, clientY: 10 });
    settle();
    expect(screen.getByRole('menu', { name: 'Help menu' })).toBeInTheDocument();
    press(helpButton());
    expect(screen.queryByRole('menu', { name: 'Help menu' })).not.toBeInTheDocument();
  });

  it('closes on Escape in help', () => {
    render(<HelpWindow><HelpPopover /></HelpWindow>);
    settle();
    escape(helpField());
    expect(screen.queryByRole('dialog', { name: 'Help popover' })).not.toBeInTheDocument();
  });

  it('closes together with a page popover on a press outside both', () => {
    render(<><PagePopover /><HelpWindow><HelpPopover /></HelpWindow></>);
    settle();
    press(document.body);
    expect(screen.queryByRole('dialog', { name: 'Help popover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Page popover' })).not.toBeInTheDocument();
  });

  // A modal menu on top blocks outside presses to the layers below it, so the press closes the menu first.
  it('closes a help menu, then a page select, on presses outside both', () => {
    render(<><PageSelect /><HelpWindow><HelpMenu /></HelpWindow></>);
    fireEvent.contextMenu(screen.getByText('Help tile'), { clientX: 10, clientY: 10 });
    settle();
    expect(screen.getByRole('menu', { name: 'Help menu' })).toBeInTheDocument();
    // The modal menu hides the rest of the page from the accessibility tree.
    expect(screen.getByRole('listbox', { hidden: true })).toBeInTheDocument();
    press(document.body);
    expect(screen.queryByRole('menu', { name: 'Help menu', hidden: true })).not.toBeInTheDocument();
    settle();
    press(document.body);
    expect(screen.queryByRole('listbox', { hidden: true })).not.toBeInTheDocument();
  });

  it('closes on a press in help while a page popover stays open', () => {
    render(<><PagePopover /><HelpWindow><HelpPopover /></HelpWindow></>);
    settle();
    press(helpButton());
    expect(screen.queryByRole('dialog', { name: 'Help popover' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Page popover' })).toBeInTheDocument();
  });
});
