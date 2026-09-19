import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { cameraCss, folderCamera } from '@/lib/folderCamera';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

/** How long the camera takes to travel between the tile and the folder board. */
const DURATION_MS = 420;
/** Slow to leave the tile, slow to settle on the board, quick through the middle. */
const EASING = 'cubic-bezier(0.45, 0, 0.15, 1)';
/** The tile's own corner radius, in px. Matches `rounded-lg`, which the folder tile sets in CSS. */
const TILE_RADIUS = 8;

/** The scroll viewport the library board sits in, which the zoom is clipped to. */
const viewportOf = (grid: HTMLElement): HTMLElement | null =>
  grid.closest<HTMLElement>('[data-radix-scroll-area-viewport]');

/** One element's part of the motion, written in the fly-in sense. */
interface Move {
  el: HTMLElement;
  keyframes: Keyframe[];
  /** Set only where the camera's own curve is wrong for what is moving. */
  easing?: string;
}

/** Which way the camera travels. The keyframes are one set; a fly-out plays them reversed. */
type Direction = 'in' | 'out';

/** The board that is leaving, frozen in screen coordinates, plus what the camera still has to measure. */
interface Snapshot {
  groupId: string;
  direction: Direction;
  clone: HTMLElement;
  cloneRect: DOMRect;
  /** The folder tile, on a fly-in. A fly-out has no tile on screen yet, so it measures after the swap. */
  tileRect?: DOMRect;
}

/**
 * Open and leave a folder with a camera zoom between the folder tile and the folder's own board.
 *
 * The library board and the folder board are two layers of one camera: the library zooms toward the
 * tile and fades out while the folder board grows out of the tile to full size, so the tile's miniature
 * becomes the board with no jump. Leaving the folder plays the same keyframes in reverse.
 *
 * The board that is about to leave the screen is frozen as a clone and raised into a fixed overlay
 * clipped to the scroll viewport. The board that is arriving is the real grid. So the clone is the
 * outer (library) layer on a fly-in and the inner (folder) layer on a fly-out.
 *
 * The transition falls back to the instant swap while a drag runs, under `prefers-reduced-motion`, off
 * the grid layout, and whenever the folder tile cannot be measured.
 *
 * @param gridNode - The grid element, which is both the layer to clone and the layer that stays
 * @param tileNodes - The tile elements by id, which is where the folder tile is measured from
 * @param openGroupId - The folder the grid is showing, which is what the motion is keyed on
 * @param setOpenGroupId - The grid's own setter. The disband path keeps calling it directly, so a folder
 *   that vanishes under the player drops back to the library with no motion
 * @param busy - True while a drag runs
 * @param enabled - False in the detailed layout, which keeps the instant swap
 */
export function useFolderZoom({ gridNode, tileNodes, openGroupId, setOpenGroupId, busy, enabled }: {
  gridNode: React.RefObject<HTMLDivElement | null>;
  tileNodes: React.MutableRefObject<Map<string, HTMLDivElement>>;
  openGroupId: string | null;
  setOpenGroupId: (id: string | null) => void;
  busy: boolean;
  enabled: boolean;
}): { openGroup: (groupId: string) => void; closeGroup: () => void } {
  const reduceMotion = usePrefersReducedMotion();
  const pending = useRef<Snapshot | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // Where the library stood when the folder opened, so leaving the folder puts the player back. Null
  // once it has been handed back, and in the detailed layout, which never moves the scroll at all.
  const libraryScroll = useRef<number | null>(null);

  // What the motion needs to know as the click lands, read before React commits the swap. Held in a ref
  // so the handlers never have to change identity for it.
  const latest = useRef({ busy, enabled, reduceMotion, openGroupId });
  latest.current = { busy, enabled, reduceMotion, openGroupId };

  /** Freeze the board on screen, if the guards allow a camera at all. */
  const snapshot = useCallback((groupId: string, direction: Direction, tileRect?: DOMRect) => {
    const { busy: dragging, enabled: on, reduceMotion: reduce } = latest.current;
    const grid = gridNode.current;
    if (!grid || !on || dragging || reduce || typeof grid.animate !== 'function') return;
    // A fly-in has the tile on screen, so it can rule the camera out here. A fly-out cannot: the tile
    // comes back with the swap, so the effect measures it and drops the snapshot when it has no box.
    if (direction === 'in' && !tileRect?.width) return;
    pending.current = {
      groupId,
      direction,
      clone: grid.cloneNode(true) as HTMLElement,
      cloneRect: grid.getBoundingClientRect(),
      tileRect,
    };
  }, [gridNode]);

  const openGroup = useCallback((groupId: string) => {
    // A motion already in flight lands on its end state first, so a fast back-and-forth never leaves
    // two cameras on the same grid. It runs before anything is measured: a running camera holds an
    // inline transform, and a tile read through it is not where it looks.
    cleanupRef.current?.();
    const grid = gridNode.current;
    const viewport = grid && viewportOf(grid);
    if (viewport && latest.current.enabled) libraryScroll.current = viewport.scrollTop;
    snapshot(groupId, 'in', tileNodes.current.get(groupId)?.getBoundingClientRect());
    setOpenGroupId(groupId);
  }, [gridNode, tileNodes, setOpenGroupId, snapshot]);

  const closeGroup = useCallback(() => {
    cleanupRef.current?.();
    const groupId = latest.current.openGroupId;
    if (!groupId) return;
    snapshot(groupId, 'out');
    setOpenGroupId(null);
  }, [setOpenGroupId, snapshot]);

  // A motion still running when the grid goes away would restore styles onto a detached tree and leave
  // the overlay on screen.
  useEffect(() => () => cleanupRef.current?.(), []);

  useLayoutEffect(() => {
    const snap = pending.current;
    pending.current = null;
    const grid = gridNode.current;
    const viewport = grid && viewportOf(grid);
    // The two boards share one scroll viewport, so the swap has to say where each of them stands. The
    // folder opens at its top, whether or not the camera runs, because the miniature the player clicked
    // shows the board's first rows; leaving the folder puts the library back where they left it. The
    // detailed layout never saves an offset, so it keeps the scroll it always had. This runs before the
    // camera measures anything, because a fly-out lands on a tile the restored scroll has just moved.
    if (viewport && latest.current.enabled) {
      if (openGroupId) viewport.scrollTop = 0;
      else if (libraryScroll.current !== null) {
        viewport.scrollTop = libraryScroll.current;
        libraryScroll.current = null;
      }
    }
    if (!snap || !grid || !viewport) return;

    // Measured after the scroll reset, because both layers' corners move with it.
    const arrived = grid.getBoundingClientRect();
    const flyIn = snap.direction === 'in';
    // The clone is always the board that is leaving: the library on the way in, the folder on the way
    // out. So it is the outer layer one way and the inner layer the other.
    const outerEl = flyIn ? snap.clone : grid;
    const innerEl = flyIn ? grid : snap.clone;
    const outer = flyIn ? snap.cloneRect : arrived;
    const inner = flyIn ? arrived : snap.cloneRect;
    // The folder tile: measured before the swap on a fly-in, and after it on a fly-out, so that either
    // way it is read in the same frame as the library layer it belongs to.
    const tile = snap.tileRect ?? tileNodes.current.get(snap.groupId)?.getBoundingClientRect();
    if (!tile?.width) return;

    const viewportRect = viewport.getBoundingClientRect();

    // The frozen board, raised out of the document and clipped to the board area, so a board blown up
    // eight times never reaches the toolbar or the tabs.
    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    Object.assign(overlay.style, {
      position: 'fixed',
      left: `${viewportRect.left}px`,
      top: `${viewportRect.top}px`,
      width: `${viewportRect.width}px`,
      height: `${viewportRect.height}px`,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '40',
    });
    Object.assign(snap.clone.style, {
      position: 'absolute',
      margin: '0',
      left: `${snap.cloneRect.left - viewportRect.left}px`,
      top: `${snap.cloneRect.top - viewportRect.top}px`,
      width: `${snap.cloneRect.width}px`,
      height: `${snap.cloneRect.height}px`,
    });
    overlay.appendChild(snap.clone);
    document.body.appendChild(overlay);

    const camera = folderCamera({ tile, outer, inner });
    const moves: Move[] = [];
    const restore: (() => void)[] = [];
    /** Write inline styles the motion needs, remembering what they were so cleanup can hand them back. */
    const applyStyle = (el: HTMLElement, styles: Partial<CSSStyleDeclaration>) => {
      // Every key here is a plain string property of the style object, which `'opacity'` stands for.
      const before = Object.fromEntries(Object.keys(styles).map((key) => [key, el.style[key as 'opacity']]));
      Object.assign(el.style, styles);
      restore.push(() => Object.assign(el.style, before));
    };

    applyStyle(snap.clone, { transformOrigin: '0 0', willChange: 'transform, opacity' });
    applyStyle(grid, { transformOrigin: '0 0', willChange: 'transform, opacity' });

    // The library board: at rest, then zoomed into the tile. It is gone before the zoom ends, because a
    // board blown up that far is soft long before it reaches full scale.
    moves.push({
      el: outerEl,
      keyframes: [
        { transform: cameraCss(camera.outer.from), opacity: 1 },
        { opacity: 0, offset: 0.75 },
        { transform: cameraCss(camera.outer.to), opacity: 0 },
      ],
    });

    // The folder board: inside the tile at tile scale, clipped to the tile's shape, then at rest.
    moves.push({
      el: innerEl,
      keyframes: [
        {
          transform: cameraCss(camera.inner.from),
          opacity: 0,
          clipPath: `inset(0px 0px ${camera.clipBottom}px 0px round ${TILE_RADIUS * camera.zoom}px)`,
        },
        { opacity: 1, offset: 0.35 },
        { transform: cameraCss(camera.inner.to), opacity: 1, clipPath: 'inset(0px 0px 0px 0px round 0px)' },
      ],
    });

    // The folder tile in the library layer gives way early, so the growing board shows inside its frame
    // rather than through it. Reversed, it is the last thing back on a fly-out.
    const outerTile = outerEl.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(snap.groupId)}"]`);
    if (outerTile) {
      moves.push({ el: outerTile, keyframes: [{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }] });
      // The name bar is not part of the board, so it leaves before the board it would otherwise cover.
      // Linear time, because the camera's easing would hold it at full opacity for a third of the run.
      const title = outerTile.querySelector<HTMLElement>('[data-folder-title]');
      if (title) {
        moves.push({
          el: title,
          keyframes: [{ opacity: 1 }, { opacity: 0, offset: 0.12 }, { opacity: 0 }],
          easing: 'linear',
        });
      }
    }

    // Member names on the shrinking folder board, which reach unreadable sizes long before the board
    // does. Fly-out only: written in the fly-in sense, where they are back by the end, and never added
    // to a fly-in, so a name stays readable while the player flies toward the board it is on.
    //
    // This one keeps the camera's own easing rather than taking linear time, so the offsets below are
    // read against the board's size instead of the clock: a name is gone once the board has receded
    // past a quarter of the camera's range, and it goes on the way out the same way distance takes it.
    if (!flyIn) {
      innerEl.querySelectorAll<HTMLElement>('[data-tile-title]').forEach((title) => {
        moves.push({ el: title, keyframes: [{ opacity: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1 }] });
      });
    }

    // A click on a moving board would start a drag against cells that are not where they look.
    applyStyle(viewport, { pointerEvents: 'none' });

    const animations = moves.map(({ el, keyframes, easing }) => el.animate(keyframes, {
      duration: DURATION_MS,
      easing: easing ?? EASING,
      direction: flyIn ? 'normal' : 'reverse',
      fill: 'both',
    }));

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      cleanupRef.current = null;
      // Land on the end state before dropping it, so a second click cuts a running camera off at the
      // board it was flying to rather than at the tile it started from. `fill: 'both'` holds that end
      // state, so the cancel that releases it has to follow.
      animations.forEach((animation) => { animation.finish(); animation.cancel(); });
      restore.forEach((undo) => undo());
      overlay.remove();
    };
    cleanupRef.current = cleanup;
    Promise.all(animations.map((animation) => animation.finished)).then(cleanup, cleanup);
    // The swap itself is the trigger. Everything else the motion reads is measured inside this effect,
    // so re-running it on any other change would restart a camera mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: the swap is the only trigger
  }, [openGroupId]);

  return { openGroup, closeGroup };
}
