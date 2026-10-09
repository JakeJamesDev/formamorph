import { AbsoluteFill, Composition, Folder, Sequence } from 'remotion';
import { CANVAS, type Layout } from './layout';
import { FPS, sceneStarts } from './timeline';
import { Trailer } from './Trailer';

/** Scene frames each row samples: entering, settled, holding, late, and leaving into the join. */
const sampleFrames = (durationInFrames: number) =>
  [10, 40, Math.round(durationInFrames / 2), durationInFrames - 45, durationInFrames - 12].map((frame) => Math.min(frame, durationInFrames - 1)).sort((a, b) => a - b);

const SHEET_WIDTH = 1920;
const COLUMNS = 5;
/** Shots per page: one row each. */
const ROWS_PER_PAGE: Record<Layout, number> = { wide: 4, tall: 2 };

const cellSize = (layout: Layout) => {
  const width = SHEET_WIDTH / COLUMNS;
  return { width, height: (width * CANVAS[layout].height) / CANVAS[layout].width };
};

/** Pages a cut's sheet needs. */
const sheetPages = (layout: Layout) => Math.ceil(sceneStarts(layout).length / ROWS_PER_PAGE[layout]);

/** `pages` rides in the props so `npm run sheet` reads the page count from the composition. */
type SheetProps = { layout: Layout; page: number; pages: number };

/** A contact sheet: each shot of the cut is a row of five frames, so one still shows how every shot enters, holds and leaves. */
const Sheet = ({ layout, page }: SheetProps) => {
  const cell = cellSize(layout);
  const canvas = CANVAS[layout];
  const rows = sceneStarts(layout).slice(page * ROWS_PER_PAGE[layout], (page + 1) * ROWS_PER_PAGE[layout]);
  return (
    <AbsoluteFill style={{ background: '#000', flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start' }}>
      {rows.flatMap((scene) =>
        sampleFrames(scene.durationInFrames).map((offset) => {
          const at = scene.from + offset;
          return (
            <div key={`${scene.id}-${offset}`} style={{ ...cell, position: 'relative', overflow: 'hidden', outline: '1px solid #222' }}>
              <div style={{ ...canvas, position: 'absolute', transform: `scale(${cell.width / canvas.width})`, transformOrigin: '0 0' }}>
                <Sequence from={-at} layout="none">
                  <Trailer layout={layout} reading={[]} camera={[]} />
                </Sequence>
              </div>
              <div style={{ position: 'absolute', left: 6, top: 4, fontFamily: 'monospace', fontSize: 14, color: '#fff', background: 'rgba(0,0,0,.6)', padding: '1px 5px', borderRadius: 4 }}>
                {scene.id} +{offset} · {(at / FPS).toFixed(2)}s
              </div>
            </div>
          );
        }),
      )}
    </AbsoluteFill>
  );
};

/** The studio's "Sheets" folder: one still per cut, with the page as a prop. `npm run sheet` renders every page. */
export const SheetCompositions = () => (
  <Folder name="Sheets">
    {(['wide', 'tall'] as const).map((layout) => (
      <Composition
        key={layout}
        id={`Sheet-${layout}`}
        component={Sheet}
        defaultProps={{ layout, page: 0, pages: sheetPages(layout) }}
        fps={FPS}
        durationInFrames={1}
        width={SHEET_WIDTH}
        height={Math.ceil(cellSize(layout).height * ROWS_PER_PAGE[layout])}
      />
    ))}
  </Folder>
);
