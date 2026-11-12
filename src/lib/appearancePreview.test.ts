import { describe, expect, it } from 'vitest';
import { lookChanged, traitLook, traitRowsOnSave, withColor, withSlider, type PreviewLook, type PreviewModel, type TraitLookRows } from './appearancePreview';

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

  it("shows a color row's Set To, the model's own color elsewhere, and no channel the model lacks", () => {
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
