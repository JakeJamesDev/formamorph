import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT_RIG, type MascotImageRef, type MascotRig } from './mascot';
import {
  cancelMascotDraft, editMascotDraft, isMascotDraftDirty, openMascotDraft, resetMascotDraft, saveMascotDraft, touchMascotDraft,
} from './mascotDraft';
import { activeMascotRig, type MascotPresetStore } from './mascotPresets';
import { removeMascotLayer, setMascotBase } from './mascotRigEdits';

const stored = (id: string): MascotImageRef => ({ kind: 'stored', id });
const mine: MascotRig = {
  ...DEFAULT_MASCOT_RIG,
  base: stored('body'),
  layers: [
    { id: 'hi', name: 'Hi', kind: 'state', enabled: true, images: [stored('arm')] },
    { id: 'sad', name: 'Sad', kind: 'expression', enabled: true, images: [stored('tear')] },
  ],
};
const store: MascotPresetStore = { activeId: 'mine', mascots: [{ id: 'mine', name: 'Mine', rig: mine }, { id: 'twin', name: 'Twin', rig: { ...mine, layers: [] } }] };

describe('the mascot draft', () => {
  it('opens clean on the active mascot', () => {
    const draft = openMascotDraft(store);
    expect(draft.rig).toBe(mine);
    expect(isMascotDraftDirty(draft)).toBe(false);
  });

  it('names an upload no rig holds, so Cancel and Save still drop it', () => {
    const draft = touchMascotDraft(openMascotDraft(store), ['late']);
    expect(isMascotDraftDirty(draft)).toBe(false);
    expect(cancelMascotDraft(store, draft)).toEqual(['late']);
    expect(saveMascotDraft(store, draft).orphans).toEqual(['late']);
  });

  it('is clean again when an edit returns to the saved rig', () => {
    const draft = openMascotDraft(store);
    const edited = editMascotDraft(draft, { ...mine, voice: 'Gruff.' });
    expect(isMascotDraftDirty(edited)).toBe(true);
    expect(isMascotDraftDirty(editMascotDraft(edited, { ...mine, voice: mine.voice }))).toBe(false);
  });

  it('saves to the store and only then names the removed images that no mascot references', () => {
    const draft = editMascotDraft(openMascotDraft(store), removeMascotLayer(removeMascotLayer(mine, 'hi'), 'sad'));
    expect(activeMascotRig(store)).toBe(mine);
    const { store: next, orphans } = saveMascotDraft(store, draft);
    expect(activeMascotRig(next).layers).toEqual([]);
    // The twin still holds the body; nothing holds the arm or the tear.
    expect(orphans.sort()).toEqual(['arm', 'tear']);
  });

  it('cancels, naming an upload the draft added and removed, and keeping every saved image', () => {
    const uploaded = editMascotDraft(openMascotDraft(store), setMascotBase(mine, stored('new')));
    const removed = editMascotDraft(uploaded, setMascotBase(mine, stored('newer')));
    expect(cancelMascotDraft(store, removed).sort()).toEqual(['new', 'newer']);
  });

  it('resets to the Default rig, and the old images go only at Save', () => {
    const draft = resetMascotDraft(openMascotDraft(store));
    expect(draft.rig).toBe(DEFAULT_MASCOT_RIG);
    expect(cancelMascotDraft(store, draft)).toEqual([]);
    expect(saveMascotDraft(store, draft).orphans.sort()).toEqual(['arm', 'tear']);
  });
});
