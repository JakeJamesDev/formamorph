/**
 * Quick fixes in the code editor. Ctrl+. lists the fixes for the problem at the caret, and in full screen a
 * lightbulb beside a line lists that line's. Both read the lint's own actions, so they apply exactly what the
 * error card's buttons apply.
 */

import { RangeSetBuilder, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import { EditorView, GutterMarker, gutter, keymap, showTooltip, type Tooltip, type TooltipView } from '@codemirror/view';
import { forEachDiagnostic, type Action } from '@codemirror/lint';
import { MENU_ROW } from '@/components/menuRow';

/** One fix on offer, with where its diagnostic stands now. */
interface FixOffer {
  action: Action;
  from: number;
  to: number;
}

interface FixMenu {
  pos: number;
  offers: FixOffer[];
}

const openFixMenu = StateEffect.define<FixMenu>();
const closeFixMenu = StateEffect.define<null>();

/** Every fix whose diagnostic `covers`, in the lint's order. */
function offersWhere(state: EditorState, covers: (from: number, to: number) => boolean): FixOffer[] {
  const offers: FixOffer[] = [];
  forEachDiagnostic(state, (diagnostic, from, to) => {
    if (!covers(from, to)) return;
    for (const action of diagnostic.actions ?? []) offers.push({ action, from, to });
  });
  return offers;
}

/** Opens the list of `offers` at `pos`. False when there is nothing to list. */
function openMenu(view: EditorView, pos: number, offers: FixOffer[]): boolean {
  if (offers.length === 0) return false;
  view.dispatch({ effects: openFixMenu.of({ pos, offers }) });
  return true;
}

/** The list's DOM: one button per fix. It takes focus, so arrows move between fixes and Enter applies one. */
function fixMenuView(view: EditorView, menu: FixMenu): TooltipView {
  const close = (refocus: boolean) => {
    view.dispatch({ effects: closeFixMenu.of(null) });
    if (refocus) view.focus();
  };
  const dom = document.createElement('div');
  dom.className = 'flex min-w-[10rem] flex-col p-1';
  dom.dataset.codeFixes = '';
  dom.setAttribute('role', 'menu');
  dom.setAttribute('aria-label', 'Quick Fixes');
  const buttons = menu.offers.map(({ action, from, to }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${MENU_ROW} text-popover-foreground`;
    button.setAttribute('role', 'menuitem');
    button.textContent = action.name;
    button.addEventListener('click', () => {
      close(true);
      action.apply(view, from, to);
    });
    return button;
  });
  dom.append(...buttons);
  dom.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    buttons[(at + step + buttons.length) % buttons.length].focus();
  });
  dom.addEventListener('focusout', (event) => {
    const to = event.relatedTarget;
    if (!(to instanceof Node) || !dom.contains(to)) close(false);
  });
  // A dialog or full screen takes Escape on the document in the capture phase, so the list takes it first.
  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  };
  return {
    dom,
    mount: () => {
      window.addEventListener('keydown', onEscape, true);
      buttons[0]?.focus();
    },
    destroy: () => window.removeEventListener('keydown', onEscape, true),
  };
}

const fixMenuField = StateField.define<FixMenu | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(openFixMenu)) return effect.value;
      if (effect.is(closeFixMenu)) return null;
    }
    return tr.docChanged || tr.selection ? null : value;
  },
  provide: (self) => showTooltip.compute([self], (state): Tooltip | null => {
    const menu = state.field(self);
    if (!menu) return null;
    return { pos: menu.pos, above: false, create: (view) => fixMenuView(view, menu) };
  }),
});

/** Ctrl+. lists the fixes for every problem that touches the caret. */
const quickFixKeys = keymap.of([{
  key: 'Mod-.',
  run: (view) => {
    const caret = view.state.selection.main.head;
    return openMenu(view, caret, offersWhere(view.state, (from, to) => from <= caret && caret <= to));
  },
}]);

/** Lucide's lightbulb, drawn without React. */
function lightbulbIcon(): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [name, value] of Object.entries({
    viewBox: '0 0 24 24', width: '12', height: '12', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  })) svg.setAttribute(name, value);
  for (const d of [
    'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
    'M9 18h6', 'M10 22h4',
  ]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

class LightbulbMarker extends GutterMarker {
  toDOM() {
    const mark = document.createElement('span');
    mark.className = 'cm-fixLightbulb';
    mark.title = 'Show fixes';
    mark.append(lightbulbIcon());
    return mark;
  }
}

const lightbulb = new LightbulbMarker();

/** The fixes of the diagnostics that start on the line at `lineFrom`. */
function lineOffers(view: EditorView, lineFrom: number): FixOffer[] {
  const line = view.state.doc.lineAt(lineFrom);
  return offersWhere(view.state, (from) => from >= line.from && from <= line.to);
}

/** A lightbulb on each line where a fixable diagnostic starts. A click lists that line's fixes. */
export const quickFixGutter: Extension = gutter({
  class: 'cm-gutter-fixes',
  markers: (view) => {
    const builder = new RangeSetBuilder<GutterMarker>();
    const lines = new Set<number>();
    forEachDiagnostic(view.state, (diagnostic, from) => {
      if (diagnostic.actions?.length) lines.add(view.state.doc.lineAt(from).from);
    });
    for (const at of [...lines].sort((a, b) => a - b)) builder.add(at, at, lightbulb);
    return builder.finish();
  },
  initialSpacer: () => lightbulb,
  domEventHandlers: {
    mousedown: (view, line, event) => {
      const offers = lineOffers(view, line.from);
      if (offers.length === 0) return false;
      event.preventDefault();
      return openMenu(view, offers[0].from, offers);
    },
  },
});

/** Ctrl+. and the list it opens. The lightbulb gutter is separate, for full screen only. */
export const quickFixes: Extension = [fixMenuField, quickFixKeys];
