/**
 * Measures one editor's open values and writes their outlines and header places back to the DOM. The
 * geometry itself is `openValueShape`; this module only reads boxes and sets styles.
 */
import { layoutHeaders, lineBoxes, traceOutline, type Box, type HeaderBox } from './openValueShape';

/** How far the outline stands off the text: a pixel inside the value's own end padding. */
const STANDOFF = { padX: 3, padY: 1 };
/** The radius both the header and the outline use, from the value's own token. */
const FALLBACK_RADIUS_PX = 5;

function radiusOf(chip: HTMLElement): number {
  const declared = parseFloat(getComputedStyle(chip).getPropertyValue('--open-value-radius'));
  return Number.isFinite(declared) ? declared : FALLBACK_RADIUS_PX;
}

/** A value's line boxes. An empty value gets a sliver at its start, so it still shows a shape. */
function openValueLines(chip: HTMLElement): Box[] {
  const island = chip.querySelector('[data-lexical-slot]');
  const lines = island ? lineBoxes(island.getClientRects()) : [];
  if (lines.length) return lines;
  const start = chip.querySelector('[data-open-value-text]')?.getClientRects()[0];
  if (!start) return [];
  const x = start.left + (start.right - start.left) / 2;
  return [{ left: x, right: x, top: start.top, bottom: start.bottom }];
}

/** One open value's header, with the box the editor-wide pass places it by. */
interface DrawnHeader { element: HTMLElement; box: HeaderBox }

/** Draws one open value's outline and seats its header on the value's first line. */
function drawOpenValue(chip: HTMLElement): DrawnHeader | null {
  const svg = chip.querySelector<SVGSVGElement>(':scope > [data-open-value-shape]');
  const header = chip.querySelector<HTMLElement>(':scope > [data-open-value-header]');
  // Absolute children of an inline sit against its first fragment.
  const origin = chip.getClientRects()[0];
  const radius = radiusOf(chip);
  const outline = origin ? traceOutline(openValueLines(chip), { ...STANDOFF, radius }) : null;
  if (!svg || !header || !origin || !outline) return null;
  const { bounds, firstLine, path } = outline;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  svg.style.left = `${bounds.left - origin.left}px`;
  svg.style.top = `${bounds.top - origin.top}px`;
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.querySelector('path')?.setAttribute('d', path);
  header.style.transform = '';
  // The header's bottom edge overlaps the outline's top edge by a pixel, so the two read as one tab.
  header.style.top = `${firstLine.top - origin.top - header.offsetHeight + 1}px`;
  header.style.left = `${firstLine.left - origin.left}px`;
  const seated = header.getBoundingClientRect();
  return {
    element: header,
    box: {
      left: seated.left, right: seated.right, top: seated.top, bottom: seated.bottom,
      lineLeft: firstLine.left, lineRight: firstLine.right,
    },
  };
}

/** Lays out every open value in `root`: outlines first, then one pass over all headers. */
export function layoutOpenValues(root: HTMLElement): HTMLElement[] {
  const drawn: DrawnHeader[] = [];
  for (const chip of root.querySelectorAll<HTMLElement>('[data-open-value]')) {
    const header = drawOpenValue(chip);
    if (header) drawn.push(header);
  }
  layoutHeaders(drawn.map((h) => h.box), root.getBoundingClientRect()).forEach(({ dx, roundLeft, roundRight }, i) => {
    const { element } = drawn[i];
    const corner = `${radiusOf(element)}px`;
    element.style.transform = dx ? `translateX(${dx}px)` : '';
    element.style.borderBottomLeftRadius = roundLeft ? corner : '0';
    element.style.borderBottomRightRadius = roundRight ? corner : '0';
  });
  return drawn.map((h) => h.element);
}
