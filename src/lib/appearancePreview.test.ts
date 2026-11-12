import { describe, expect, it } from 'vitest';
import {
  NO_EDITS, avatarsChanged, clearSlider, editColor, editSlider, lookChanged, lookWithEdits, shownLook, statLookRows, statRowsFromLook, traitLook,
  traitRowsOnSave, traitRowsOnSaveAcross, withColor, withSlider, type PreviewLook, type PreviewModel, type StatLookRows, type TraitLookRows,
} from './appearancePreview';
import { blendColor } from './oklab';

const MODEL: PreviewModel = { sliders: ['Ear Shape', 'Fat'], colors: { skin: '#e8c8b0', hair: '#402010' } };

/** Opens the Preview on `rows`, applies `edit` to the look, and returns the rows Save writes. */
const save = (rows: TraitLookRows, edit: (look: PreviewLook) => PreviewLook = (l) => l) => {
  const base = traitLook(rows, MODEL);
  return traitRowsOnSave(rows, MODEL, base, edit(base));
};

describe('traitLook', () => {
  it.each([
    ['a row sets its slider', { morphPins: [{ name: 'Ear Shape', value: 0.8 }] }, { 'Ear Shape': 0.8, Fat: 0 }],
    ['no row shows the model’s own', {}, { 'Ear Shape': 0, Fat: 0 }],
    ['a row the Avatar lacks shows nothing', { morphPins: [{ name: 'Tail', value: 1 }] }, { 'Ear Shape': 0, Fat: 0 }],
    ['the first of two rows on a slider wins', { morphPins: [{ name: 'Fat', value: 0.3 }, { name: 'Fat', value: 0.9 }] }, { 'Ear Shape': 0, Fat: 0.3 }],
  ])('%s', (_, rows, sliders) => {
    expect(traitLook(rows, MODEL).sliders).toEqual(sliders);
  });

  it("shows a color row's Set To, the model’s own color elsewhere, and no channel the model lacks", () => {
    const look = traitLook({ colorPins: [{ channel: 'hair', color: '#ffffff' }, { channel: 'eye', color: '#00ff00' }] }, MODEL);
    expect(look.colors).toEqual({ skin: '#e8c8b0', hair: '#ffffff' });
  });
});

describe('traitRowsOnSave', () => {
  const ears = { morphPins: [{ name: 'Fat', value: 0.2 }, { name: 'Ear Shape', value: 0.5 }] };

  it.each<[string, TraitLookRows, (l: PreviewLook) => PreviewLook, TraitLookRows]>([
    ['an existing row keeps its place and takes the drag', ears, (l) => withSlider(l, 'Ear Shape', 1.1),
      { morphPins: [{ name: 'Fat', value: 0.2 }, { name: 'Ear Shape', value: 1.1 }], colorPins: undefined }],
    ['a dragged control with no row adds one', {}, (l) => withSlider(l, 'Fat', 0.4),
      { morphPins: [{ name: 'Fat', value: 0.4 }], colorPins: undefined }],
    ['an untouched control adds no row', { morphPins: [{ name: 'Ear Shape', value: 0.5 }] }, (l) => withSlider(l, 'Ear Shape', 0.7),
      { morphPins: [{ name: 'Ear Shape', value: 0.7 }], colorPins: undefined }],
    ['a control dragged and put back adds no row', {}, (l) => withSlider(withSlider(l, 'Fat', 0.4), 'Fat', 0),
      { morphPins: undefined, colorPins: undefined }],
    ['a row whose slider the Avatar lacks stays as it is', { morphPins: [{ name: 'Tail', value: 3 }] }, (l) => withSlider(l, 'Fat', 0.4),
      { morphPins: [{ name: 'Tail', value: 3 }, { name: 'Fat', value: 0.4 }], colorPins: undefined }],
    ['a picked color writes its row', { colorPins: [{ channel: 'hair', color: '#402010' }] }, (l) => withColor(l, 'hair', '#aa00aa'),
      { morphPins: undefined, colorPins: [{ channel: 'hair', color: '#aa00aa' }] }],
    ['a picked color with no row adds one', {}, (l) => withColor(l, 'skin', '#112233'),
      { morphPins: undefined, colorPins: [{ channel: 'skin', color: '#112233' }] }],
    ['a color row for a channel the Avatar lacks stays as it is', { colorPins: [{ channel: 'eye', color: '#00ff00' }] }, (l) => l,
      { morphPins: undefined, colorPins: [{ channel: 'eye', color: '#00ff00' }] }],
    ['a value past the slider range survives an untouched Save', { morphPins: [{ name: 'Fat', value: 2.5 }] }, (l) => l,
      { morphPins: [{ name: 'Fat', value: 2.5 }], colorPins: undefined }],
  ])('%s', (_, rows, edit, expected) => {
    expect(save(rows, edit)).toEqual(expected);
  });

  it('leaves a second row on the same slider as it is', () => {
    const rows = { morphPins: [{ name: 'Fat', value: 0.3 }, { name: 'Fat', value: 0.9 }] };
    expect(save(rows, (l) => withSlider(l, 'Fat', 0.6)).morphPins).toEqual([{ name: 'Fat', value: 0.6 }, { name: 'Fat', value: 0.9 }]);
  });

  it('leaves a second row on the same color as it is', () => {
    const rows: TraitLookRows = { colorPins: [{ channel: 'hair', color: '#111111' }, { channel: 'hair', color: '#222222' }] };
    expect(save(rows, (l) => withColor(l, 'hair', '#333333')).colorPins)
      .toEqual([{ channel: 'hair', color: '#333333' }, { channel: 'hair', color: '#222222' }]);
  });

  it('keeps a change to a slider the look holds beyond the model', () => {
    // A drag on another Avatar's slider, as a dialog that switches Avatars carries it.
    const base = traitLook({}, MODEL);
    expect(traitRowsOnSave({}, MODEL, base, withSlider(base, 'Tail', 0.5)).morphPins).toEqual([{ name: 'Tail', value: 0.5 }]);
  });
});

describe('edits across Avatars', () => {
  const OTHER: PreviewModel = { sliders: ['Fat', 'Tail'], colors: { hair: '#111111' } };
  const opened = (rows: TraitLookRows) => [MODEL, OTHER].map((model) => ({ model, base: traitLook(rows, model) }));

  it('shows an edit only on the controls an Avatar has', () => {
    const edits = editSlider(editColor(NO_EDITS, 'skin', '#112233'), 'Ear Shape', 0.9);
    const look = lookWithEdits(traitLook({}, OTHER), edits);
    expect(look).toEqual({ sliders: { Fat: 0, Tail: 0 }, colors: { hair: '#111111' } });
  });

  it('saves an edit made on one Avatar once both are opened', () => {
    const edits = editSlider(editSlider(NO_EDITS, 'Ear Shape', 0.4), 'Tail', 0.2);
    expect(traitRowsOnSaveAcross({}, opened({}), edits).morphPins).toEqual([{ name: 'Ear Shape', value: 0.4 }, { name: 'Tail', value: 0.2 }]);
  });

  it('leaves a row the second Avatar lacks as it is', () => {
    const rows = { morphPins: [{ name: 'Ear Shape', value: 0.5 }] };
    expect(traitRowsOnSaveAcross(rows, opened(rows), editSlider(NO_EDITS, 'Tail', 0.2)).morphPins)
      .toEqual([{ name: 'Ear Shape', value: 0.5 }, { name: 'Tail', value: 0.2 }]);
  });

  describe('two Avatars that name one slider by different aliases', () => {
    const WEIGHT: PreviewModel = { sliders: ['Weight'], colors: {} };
    const FAT: PreviewModel = { sliders: ['Fat'], colors: {} };
    const both = (rows: TraitLookRows) => [WEIGHT, FAT].map((model) => ({ model, base: traitLook(rows, model) }));

    it.each<[string, TraitLookRows]>([
      ['with a row', { morphPins: [{ name: 'Fat', value: 0.3 }] }],
      ['with no row', {}],
    ])('saves a drag on the first Avatar %s', (_, rows) => {
      const rowName = rows.morphPins?.[0].name ?? 'Weight';
      expect(traitRowsOnSaveAcross(rows, both(rows), editSlider(NO_EDITS, 'Weight', 0.8)).morphPins)
        .toEqual([{ name: rowName, value: 0.8 }]);
    });

    it.each<[string, TraitLookRows]>([
      ['with a row', { morphPins: [{ name: 'Weight', value: 0.3 }] }],
      ['with no row', {}],
    ])('saves a drag on the second Avatar %s', (_, rows) => {
      const rowName = rows.morphPins?.[0].name ?? 'Weight'; // A new row takes the first opened Avatar's name.
      expect(traitRowsOnSaveAcross(rows, both(rows), editSlider(NO_EDITS, 'Fat', 0.6)).morphPins)
        .toEqual([{ name: rowName, value: 0.6 }]);
    });

    it('shows a drag on the first Avatar on the second, and undo there clears it on both', () => {
      const edits = editSlider(NO_EDITS, 'Weight', 0.8);
      expect(lookWithEdits(traitLook({}, FAT), edits).sliders).toEqual({ Fat: 0.8 });
      const cleared = clearSlider(edits, 'Fat');
      expect(both({}).map(({ base }) => lookWithEdits(base, cleared).sliders)).toEqual([{ Weight: 0 }, { Fat: 0 }]);
    });

    it.each<[string, TraitLookRows]>([
      ['with a row', { morphPins: [{ name: 'Fat', value: 0.3 }] }],
      ['with no row', {}],
    ])('saves the most recent drag when both Avatars are dragged %s', (_, rows) => {
      const rowName = rows.morphPins?.[0].name ?? 'Weight';
      const aThenB = editSlider(editSlider(NO_EDITS, 'Weight', 0.8), 'Fat', 0.6);
      expect(traitRowsOnSaveAcross(rows, both(rows), aThenB).morphPins).toEqual([{ name: rowName, value: 0.6 }]);
      const bThenA = editSlider(editSlider(NO_EDITS, 'Fat', 0.6), 'Weight', 0.8);
      expect(traitRowsOnSaveAcross(rows, both(rows), bThenA).morphPins).toEqual([{ name: rowName, value: 0.8 }]);
    });
  });

  it('counts an edit put back to its base as no change', () => {
    expect(avatarsChanged(opened({}), editSlider(NO_EDITS, 'Fat', 0))).toBe(false);
    expect(avatarsChanged(opened({}), editSlider(NO_EDITS, 'Fat', 0.1))).toBe(true);
  });
});

describe("a stat's Preview", () => {
  /** Opens a stat's Preview on `rows`, applies `edit` to the look at Max, and returns the stat rows Save writes. */
  const saveStat = (rows: StatLookRows, edit: (look: PreviewLook) => PreviewLook = (l) => l) => {
    const lookRows = statLookRows(rows);
    const base = traitLook(lookRows, MODEL);
    return statRowsFromLook(traitRowsOnSave(lookRows, MODEL, base, edit(base)));
  };
  const atMax = (rows: StatLookRows) => traitLook(statLookRows(rows), MODEL);

  it("opens at Max with each slider at the model’s own value plus its Change By", () => {
    expect(atMax({ morphBindings: [{ name: 'Fat', by: 0.4 }, { name: 'Ear Shape' }] }).sliders).toEqual({ 'Ear Shape': 1, Fat: 0.4 });
  });

  // The walkthroughs of the stat-preview-reading prototype, as scrub positions and drags on an untouched Avatar.
  it('simple case: a drag to 1.0 at Max shows 0.5 at half and the model’s own at Min', () => {
    const look = withSlider(atMax({}), 'Fat', 1);
    expect(shownLook(look, MODEL, 0.5).sliders.Fat).toBe(0.5);
    expect(shownLook(look, MODEL, 0).sliders).toEqual({ 'Ear Shape': 0, Fat: 0 });
    expect(saveStat({}, (l) => withSlider(l, 'Fat', 1))).toEqual({ morphBindings: [{ name: 'Fat' }], colorBindings: undefined });
  });

  it.each<[string, StatLookRows, (l: PreviewLook) => PreviewLook, StatLookRows]>([
    ['a drag to 0.8 on a slider with no row writes Change By 0.8', {}, (l) => withSlider(l, 'Fat', 0.8),
      { morphBindings: [{ name: 'Fat', by: 0.8 }], colorBindings: undefined }],
    ['editing halfway: a drag to 0.5 writes Change By 0.5, not 0.5 ÷ progress', {}, (l) => withSlider(l, 'Fat', 0.5),
      { morphBindings: [{ name: 'Fat', by: 0.5 }], colorBindings: undefined }],
    ['shrinking: a drag below the model’s own writes a negative Change By', {}, (l) => withSlider(l, 'Fat', -0.25),
      { morphBindings: [{ name: 'Fat', by: -0.25 }], colorBindings: undefined }],
    ['undo and Save: a drag put back to the saved 0.6 leaves 0.6', { morphBindings: [{ name: 'Fat', by: 0.6 }] },
      (l) => withSlider(withSlider(l, 'Fat', 1), 'Fat', 0.6), { morphBindings: [{ name: 'Fat', by: 0.6 }], colorBindings: undefined }],
    ['a Change By of 5 survives an untouched Save', { morphBindings: [{ name: 'Fat', by: 5 }] }, (l) => l,
      { morphBindings: [{ name: 'Fat', by: 5 }], colorBindings: undefined }],
    ['only the dragged one of two sliders with no row adds a row', {}, (l) => withSlider(l, 'Ear Shape', 0.3),
      { morphBindings: [{ name: 'Ear Shape', by: 0.3 }], colorBindings: undefined }],
    ['a row the Avatar lacks stays as it is', { morphBindings: [{ name: 'Tail', by: 2 }] }, (l) => l,
      { morphBindings: [{ name: 'Tail', by: 2 }], colorBindings: undefined }],
    ['a pick writes the Target Color', { colorBindings: [{ channel: 'hair', color: '#ffffff' }] }, (l) => withColor(l, 'hair', '#aa00aa'),
      { morphBindings: undefined, colorBindings: [{ channel: 'hair', color: '#aa00aa' }] }],
  ])('%s', (_, rows, edit, expected) => {
    expect(saveStat(rows, edit)).toEqual(expected);
  });

  it("shows each color as the game's blend from the model’s own toward the Target Color", () => {
    const look = atMax({ colorBindings: [{ channel: 'hair', color: '#ffffff' }] });
    expect(shownLook(look, MODEL, 0.5).colors.hair).toBe(blendColor('#402010', [{ target: '#ffffff', t: 0.5 }]));
    expect(shownLook(look, MODEL, 0).colors).toEqual(MODEL.colors);
    expect(shownLook(look, MODEL, 1).colors.hair).toBe('#ffffff');
  });
});

describe('lookChanged', () => {
  const base = traitLook({ colorPins: [{ channel: 'hair', color: '#AABBCC' }] }, MODEL);

  it.each([
    ['no change', base, false],
    ['a drag', withSlider(base, 'Fat', 0.1), true],
    ['a pick', withColor(base, 'skin', '#000000'), true],
    ['the same color in other case', withColor(base, 'hair', '#aabbcc'), false],
  ])('%s', (_, look, changed) => {
    expect(lookChanged(look, base)).toBe(changed);
  });
});
