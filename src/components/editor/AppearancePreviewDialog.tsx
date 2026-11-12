import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, dialogHeaderBar, dialogHeaderBarTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Hint } from '@/components/ui/typography';
import VRMViewer, { type VRMCapabilities } from '@/views/VRMViewer';
import ModelStorageService from '@/services/ModelStorageService';
import { useHeldModelBlob } from '@/lib/useHeldModelBlob';
import { cleanLabel } from '@/lib/morphLabel';
import { cn } from '@/lib/utils';
import {
  BODY_MORPH_MAX, BODY_MORPH_MIN, BODY_MORPH_STEP, HEAD_MORPH_MAX, HEAD_MORPH_MIN, ColorRow, SliderRow,
} from '@/lib/useVrmCustomization';
import {
  colorChanged, lookChanged, modelChannels, traitLook, traitRowsOnSave, withColor, withSlider,
  type PreviewLook, type PreviewModel, type TraitLookRows,
} from '@/lib/appearancePreview';
import type { RowAvatar } from '@/lib/useSliderPicker';
import type { ColorChannel } from '@/types';

const CHANNEL_LABELS: Record<ColorChannel, string> = { hair: 'Hair Color', eye: 'Eye Color', skin: 'Skin Color' };

const avatarLoader = (avatar: RowAvatar) => (avatar.kind === 'library'
  ? () => ModelStorageService.getModelData(avatar.id)
  : async () => ({ blob: await (await fetch(avatar.data)).blob() }));

/** The previewed model with its sliders split as the dialog lists them. */
interface DialogModel extends PreviewModel {
  head: string[];
  body: string[];
}

/** The model the Preview binds to, from what the viewer detected. */
const previewModel = (caps: VRMCapabilities): DialogModel => ({
  head: caps.headMorphs,
  body: caps.bodyMorphs,
  sliders: [...caps.headMorphs, ...caps.bodyMorphs],
  colors: caps.colors,
});

/** What the dialog holds once the model loads: the model, the look it opened with, and the look now. */
interface Draft {
  model: DialogModel;
  base: PreviewLook;
  look: PreviewLook;
}

/**
 * The Preview of a trait's sliders and colors on its Avatar. Mount it only while it is open: the viewer and
 * the draft live as long as it does. Save writes `onSave` once.
 */
export function AppearancePreviewDialog({ name, avatar, rows, onSave, onClose }: {
  /** The trait's display name. */
  name: string;
  avatar: RowAvatar;
  rows: TraitLookRows;
  onSave: (rows: TraitLookRows) => void;
  onClose: () => void;
}) {
  const load = useMemo(() => avatarLoader(avatar), [avatar]);
  const { url, failed } = useHeldModelBlob(load);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const changed = !!draft && lookChanged(draft.look, draft.base);

  const onCapabilities = (caps: VRMCapabilities) => {
    const model = previewModel(caps);
    const base = traitLook(rows, model);
    // A second report of the same model keeps the author's changes.
    setDraft((d) => d ?? { model, base, look: base });
  };
  const edit = (next: (look: PreviewLook) => PreviewLook) => setDraft((d) => (d ? { ...d, look: next(d.look) } : d));

  const requestClose = () => {
    if (changed) setConfirmingClose(true);
    else onClose();
  };
  const save = () => {
    if (!draft) return;
    onSave(traitRowsOnSave(rows, draft.model, draft.base, draft.look));
    onClose();
  };

  // A channel's color goes to the viewer only once it differs from the model's own, which keeps an untouched model pristine.
  const shownColor = (channel: ColorChannel) => {
    if (!draft) return undefined;
    const color = draft.look.colors[channel];
    return color !== undefined && colorChanged(draft.look, { ...draft.base, colors: draft.model.colors }, channel) ? color : undefined;
  };

  const viewer = failed ? (
    <div className="flex h-full items-center justify-center p-4"><Hint>This Avatar couldn&apos;t be loaded</Hint></div>
  ) : url ? (
    <VRMViewer
      key={url}
      modelUrl={url}
      onCapabilities={onCapabilities}
      bodyMorphValues={draft ? { ...draft.look.sliders } : undefined}
      hairColor={shownColor('hair')}
      eyeColor={shownColor('eye')}
      skinColor={shownColor('skin')}
      animate={!picking}
    />
  ) : (
    <div className="flex h-full items-center justify-center"><Hint>Loading Avatar…</Hint></div>
  );

  const slider = (key: string, min: number, max: number) => draft && (
    <SliderRow
      key={key}
      id={`preview-morph-${key}`}
      label={cleanLabel(key)}
      value={draft.look.sliders[key]}
      base={draft.base.sliders[key]}
      min={min}
      max={max}
      step={BODY_MORPH_STEP}
      format={(v) => v.toFixed(2)}
      onChange={(v) => edit((look) => withSlider(look, key, v))}
    />
  );

  const colorRow = (d: Draft, channel: ColorChannel) => {
    const value = d.look.colors[channel];
    const base = d.base.colors[channel];
    return value !== undefined && base !== undefined && (
      <ColorRow
        key={channel}
        label={CHANNEL_LABELS[channel]}
        value={value}
        base={base}
        onChange={(hex) => edit((look) => withColor(look, channel, hex))}
        onUndo={() => edit((look) => withColor(look, channel, base))}
        onPickStart={() => setPicking(true)}
        onPickEnd={() => setPicking(false)}
      />
    );
  };

  const channels = draft ? modelChannels(draft.model) : [];
  const controls = !draft ? null : !draft.model.sliders.length && !channels.length ? (
    <Hint>This Avatar has no sliders or colors</Hint>
  ) : (
    <>
      {draft.model.head.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-title font-semibold">Head Features</h3>
          {draft.model.head.map((key) => slider(key, HEAD_MORPH_MIN, HEAD_MORPH_MAX))}
        </div>
      )}
      {draft.model.body.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-title font-semibold">Body Sliders</h3>
          {draft.model.body.map((key) => slider(key, BODY_MORPH_MIN, BODY_MORPH_MAX))}
        </div>
      )}
      {channels.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-title font-semibold">Colors</h3>
          {channels.map((channel) => colorRow(draft, channel))}
        </div>
      )}
    </>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}>
      <DialogContent surface="appearancePreview" className="flex h-[85dvh] w-[95vw] max-w-[960px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className={dialogHeaderBar}>
          <DialogTitle className={cn('truncate pr-8', dialogHeaderBarTitle)}>Preview {name}</DialogTitle>
          <DialogDescription className="sr-only">Set this trait&apos;s sliders and colors on the Avatar</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-[40dvh] flex-1 bg-muted/30">{viewer}</div>
          <div className="flex min-h-0 flex-1 flex-col border-t md:w-80 md:flex-none md:border-l md:border-t-0">
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-4 py-3">{controls}</div>
            </ScrollArea>
            <DialogFooter className="shrink-0 border-t p-4">
              <Button variant="outline" onClick={requestClose}>Cancel</Button>
              <Button disabled={!changed} onClick={save}>Save</Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={confirmingClose}
        onOpenChange={setConfirmingClose}
        title="Discard Changes?"
        description="You'll lose the slider and color changes you made in this Preview."
        confirmLabel="Discard"
        destructive
        onConfirm={() => { setConfirmingClose(false); onClose(); }}
        onCancel={() => setConfirmingClose(false)}
      />
    </Dialog>
  );
}
