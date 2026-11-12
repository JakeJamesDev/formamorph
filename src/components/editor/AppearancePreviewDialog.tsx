import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, dialogHeaderBar, dialogHeaderBarTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Hint, Meta } from '@/components/ui/typography';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import VRMViewer, { type VRMCapabilities } from '@/views/VRMViewer';
import type { ColorPlan } from '@/lib/avatarLook';
import ModelStorageService from '@/services/ModelStorageService';
import { useHeldModelBlob } from '@/lib/useHeldModelBlob';
import { cleanLabel } from '@/lib/morphLabel';
import { cn } from '@/lib/utils';
import {
  BODY_MORPH_MAX, BODY_MORPH_MIN, BODY_MORPH_STEP, HEAD_MORPH_MAX, HEAD_MORPH_MIN, ColorRow, SliderRow,
} from '@/lib/useVrmCustomization';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  NO_EDITS, avatarsChanged, clearColor, clearSlider, colorChanged, editColor, editSlider, lookWithEdits, modelChannels, shownLook,
  sliderChanged, traitLook, traitRowsOnSaveAcross,
  type LoadedAvatar, type PreviewEdits, type PreviewLook, type PreviewModel, type TraitLookRows,
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

/** An Avatar the dialog loaded: its model, the look it opened with, and the look now. */
interface Draft extends LoadedAvatar<DialogModel> {
  look: PreviewLook;
}

const avatarName = (avatar: RowAvatar, index: number) => avatar.name || `Avatar ${index + 1}`;

/** A stat's range, which the scrubber spans. Max is above Min. */
export interface PreviewStatRange {
  min: number;
  max: number;
}

const STAT_NOTE = "Adds to the player's own slider values in play";

const formatStat = (value: number) => String(Math.round(value * 100) / 100);

/**
 * The Preview of a trait's or a stat's sliders and colors on its Avatars. Mount it only while it is open: the
 * viewer and the edits live as long as it does. The edits are kept across a change of Avatar. Save writes
 * `onSave` once.
 *
 * With `stat`, `rows` are the look at Max and the scrubber shows the path from Min. An edit or an undo moves the
 * scrubber to Max first, so a control always edits the look at Max.
 */
export function AppearancePreviewDialog({ name, avatars, rows, stat, onSave, onClose }: {
  /** The trait's or stat's display name. */
  name: string;
  /** The Avatars the row plays on, at least one; the dialog opens on the first. */
  avatars: readonly RowAvatar[];
  rows: TraitLookRows;
  stat?: PreviewStatRange;
  onSave: (rows: TraitLookRows) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const avatar = avatars[Math.min(index, avatars.length - 1)];
  const load = useMemo(() => avatarLoader(avatar), [avatar]);
  const { url, failed } = useHeldModelBlob(load);
  const [loaded, setLoaded] = useState<Record<number, LoadedAvatar<DialogModel>>>({});
  const [edits, setEdits] = useState<PreviewEdits>(NO_EDITS);
  const [picking, setPicking] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  // The scrubber's share from Min (0) to Max (1). A trait's Preview stays at 1.
  const [progress, setProgress] = useState(1);
  const here = loaded[index];
  const draft: Draft | null = here ? { ...here, look: lookWithEdits(here.base, edits) } : null;
  const opened = Object.values(loaded);
  const changed = avatarsChanged(opened, edits);
  const shown = draft && stat ? shownLook(draft.look, draft.model, progress) : draft?.look;
  const shownBase = draft && stat ? shownLook(draft.base, draft.model, progress) : draft?.base;
  const statSpan = stat ? stat.max - stat.min : 0;
  const statValue = stat ? stat.min + progress * statSpan : 0;

  const onCapabilities = (caps: VRMCapabilities) => {
    const model = previewModel(caps);
    // A second report of the same model keeps what the dialog opened with.
    setLoaded((l) => (l[index] ? l : { ...l, [index]: { model, base: traitLook(rows, model) } }));
  };
  const switchAvatar = (next: number) => {
    setPicking(false);
    setIndex(next);
  };
  const edit = (next: (e: PreviewEdits) => PreviewEdits) => {
    setProgress(1);
    setEdits(next);
  };

  const requestClose = () => {
    if (changed) setConfirmingClose(true);
    else onClose();
  };
  const save = () => {
    onSave(traitRowsOnSaveAcross(rows, opened, edits));
    onClose();
  };

  // A channel's color goes to the viewer only once it differs from the model's own, which keeps an untouched model pristine.
  const shownColor = (channel: ColorChannel) => {
    if (!draft) return undefined;
    const color = draft.look.colors[channel];
    return color !== undefined && colorChanged(draft.look, { ...draft.base, colors: draft.model.colors }, channel) ? color : undefined;
  };
  // A stat blends each material from its own color toward the target, as play does. A channel with no row and no
  // change keeps the model's own.
  const statPlan = (channel: ColorChannel): ColorPlan => {
    const target = shownColor(channel) ?? (rows.colorPins?.some((pin) => pin.channel === channel) ? draft?.look.colors[channel] : undefined);
    return target === undefined ? null : { steps: [{ target, t: progress }] };
  };

  const viewer = failed ? (
    <div className="flex h-full items-center justify-center p-4"><Hint>This Avatar couldn&apos;t be loaded</Hint></div>
  ) : url ? (
    <VRMViewer
      key={url}
      modelUrl={url}
      onCapabilities={onCapabilities}
      bodyMorphValues={shown ? { ...shown.sliders } : undefined}
      hairColor={shownColor('hair')}
      eyeColor={shownColor('eye')}
      skinColor={shownColor('skin')}
      colorPlan={stat && draft ? { hair: statPlan('hair'), eye: statPlan('eye'), skin: statPlan('skin') } : undefined}
      animate={!picking}
    />
  ) : (
    <div className="flex h-full items-center justify-center"><Hint>Loading Avatar…</Hint></div>
  );

  const slider = (key: string, min: number, max: number) => draft && shown && shownBase && (
    <SliderRow
      key={key}
      id={`preview-morph-${key}`}
      label={cleanLabel(key)}
      value={shown.sliders[key]}
      base={shownBase.sliders[key]}
      changed={sliderChanged(draft.look, draft.base, key)}
      min={min}
      max={max}
      step={BODY_MORPH_STEP}
      format={(v) => v.toFixed(2)}
      onChange={(v) => edit((e) => (v === draft.base.sliders[key] ? clearSlider(e, key) : editSlider(e, key, v)))}
      onUndo={() => edit((e) => clearSlider(e, key))}
    />
  );

  const colorRow = (d: Draft, channel: ColorChannel) => {
    const value = shown?.colors[channel];
    const base = d.base.colors[channel];
    return value !== undefined && base !== undefined && (
      <ColorRow
        key={channel}
        label={CHANNEL_LABELS[channel]}
        value={value}
        base={base}
        changed={colorChanged(d.look, d.base, channel)}
        onChange={(hex) => edit((e) => editColor(e, channel, hex))}
        onUndo={() => edit((e) => clearColor(e, channel))}
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
      {stat && (
        <div className="space-y-2">
          <Label>{name}</Label>
          <Slider
            aria-label={name}
            min={stat.min}
            max={stat.max}
            step={statSpan / 100}
            value={[statValue]}
            onValueChange={([v]) => setProgress((v - stat.min) / statSpan)}
          />
          <Meta>{formatStat(statValue)}</Meta>
          <Hint>{STAT_NOTE}</Hint>
        </div>
      )}
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
      <DialogContent surface={stat ? 'statAppearancePreview' : 'appearancePreview'} className="flex h-[85dvh] w-[95vw] max-w-[960px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className={dialogHeaderBar}>
          <DialogTitle className={cn('truncate pr-8', dialogHeaderBarTitle)}>Preview {name}</DialogTitle>
          <DialogDescription className="sr-only">{stat ? <>Set this stat&apos;s sliders and colors at Max on the Avatar</> : <>Set this trait&apos;s sliders and colors on the Avatar</>}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-[40dvh] flex-1 bg-muted/30">{viewer}</div>
          <div className="flex min-h-0 flex-1 flex-col border-t md:w-80 md:flex-none md:border-l md:border-t-0">
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-4 py-3">
                {avatars.length > 1 && (
                  <Select value={String(index)} onValueChange={(v) => switchAvatar(Number(v))}>
                    <SelectTrigger aria-label="Avatar"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {avatars.map((a, i) => <SelectItem key={i} value={String(i)}>{avatarName(a, i)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {controls}
              </div>
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
