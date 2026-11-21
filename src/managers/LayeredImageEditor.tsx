// The Layered Image editor in the Media tab: on desktop a pane summary with a full-screen, canvas-first editor;
// on mobile a master–detail pane (Q25).

import { useState, type ReactNode } from 'react';
import { Layers, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, dialogFullHeight, dialogHeaderBar, dialogHeaderBarTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hint, Meta } from '@/components/ui/typography';
import { useIsMobile } from '@/lib/useIsMobile';
import { shownVariant } from '@/lib/layeredImages';
import { cn } from '@/lib/utils';
import type { MediaLayer } from '@/types';
import {
  AddLayerButton, BlendField, DeleteLayerButton, EyeToggle, LayerList, LayerNameField, LayerThumb, OpacityField, PreviewAs, RigPreview, TintField,
  VariantStrip, VariantSummary,
} from './LayeredImageParts';
import { draftOpacity, layerMismatched, layerNames, shownName, useRig, type Rig } from './layeredRig';

/** The selected Variant: the one picked in the strip, else the one the Layer shows now. */
function useVariantPick(rig: Rig, layer: MediaLayer | undefined) {
  const [pick, setPick] = useState<{ layerId: string; index: number } | null>(null);
  const index = layer
    ? (pick?.layerId === layer.id && pick.index < layer.variants.length ? pick.index : Math.max(0, shownVariant(layer, rig.list, rig.reads)))
    : 0;
  return { index, set: (i: number) => layer && setPick({ layerId: layer.id, index: i }) };
}

/** The Layers' empty state, with Add Layer. */
function NoLayers({ rig }: { rig: Rig }) {
  return (
    <div className="space-y-2 rounded-md border border-dashed p-3 text-center" data-layered-empty="">
      <Hint>No Layers yet</Hint>
      <AddLayerButton rig={rig} />
    </div>
  );
}

/**
 * A Layered Image's editor inside its Media tab panel: the desktop summary and full-screen editor, or the
 * mobile master–detail. `openOnMount` opens the desktop editor at once.
 */
export function LayeredImageEditor({ entryId, openOnMount = false }: { entryId: string; openOnMount?: boolean }) {
  const rig = useRig(entryId);
  const mobile = useIsMobile();
  const [open, setOpen] = useState(openOnMount);
  if (!rig) return null;
  if (mobile) return <MobileRigEditor rig={rig} />;
  return (
    <div className="space-y-3" data-layered-summary={rig.entry.id}>
      <RigPreview rig={rig} className="h-64 p-2" />
      {rig.entry.layers.length ? <Hint>{layerNames(rig.entry)}</Hint> : <Hint>No Layers yet</Hint>}
      <Button type="button" onClick={() => setOpen(true)}>
        <Layers className="mr-1 h-4 w-4" />Edit Layers
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent surface="layeredEditor" className={cn('flex max-w-none flex-col gap-0 p-0 sm:w-[96vw]', dialogFullHeight)}>
          <DesktopRigEditor rig={rig} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The full-screen editor: a large canvas, the selected Layer's Variants under it, and the Layer panel beside it. */
function DesktopRigEditor({ rig }: { rig: Rig }) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const { layer } = rig;
  const variant = useVariantPick(rig, layer);
  const toggle = (id: string) => setHidden((h) => {
    const next = new Set(h);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <>
      <div className={cn(dialogHeaderBar, 'flex items-center gap-3 pr-14')}>
        <DialogTitle className={cn(dialogHeaderBarTitle, 'min-w-0 flex-1 truncate')}>{rig.entry.name}</DialogTitle>
        <PreviewAs rig={rig} />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <RigPreview rig={rig} hidden={hidden} className="min-h-0 flex-1 rounded-none p-4" />
          <div className="border-t p-3" data-variant-panel="">
            {layer
              ? (
                <div className="space-y-2">
                  <Meta>{layer.name} Variants</Meta>
                  <VariantStrip rig={rig} layer={layer} selected={variant.index} onSelect={variant.set} />
                  <VariantSummary rig={rig} layer={layer} index={variant.index} />
                </div>
              )
              : <Hint>Add a Layer to give it Variants</Hint>}
          </div>
        </div>
        <div className="flex w-80 shrink-0 flex-col border-l">
          <div className="flex items-center justify-between px-3 pt-3">
            <Label>Layers</Label>
            {!!rig.entry.layers.length && <AddLayerButton rig={rig} />}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-2 py-2">
            {rig.entry.layers.length
              ? (
                <LayerList
                  rig={rig}
                  row={(l, handle) => (
                    <LayerRow rig={rig} layer={l} selected={l.id === layer?.id} handle={handle}>
                      <EyeToggle layer={l} hidden={hidden.has(l.id)} onToggle={() => toggle(l.id)} />
                    </LayerRow>
                  )}
                />
              )
              : <NoLayers rig={rig} />}
            {rig.entry.layers.length > 1 && <Hint className="px-1 pt-2">The top of the list draws on top</Hint>}
            </div>
          </ScrollArea>
          {layer && (
            <div className="space-y-3 border-t p-3" data-layer-settings={layer.id}>
              <LayerNameField key={layer.id} rig={rig} layer={layer} />
              <OpacityField rig={rig} layer={layer} />
              <BlendField rig={rig} layer={layer} />
              <TintField rig={rig} layer={layer} />
              <DeleteLayerButton rig={rig} layer={layer} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** One Layer row: its controls, handle, current thumbnail and name. Selecting it shows its Variants and settings. */
function LayerRow({ rig, layer, selected, handle, children, detail }: {
  rig: Rig;
  layer: MediaLayer;
  selected: boolean;
  handle: ReactNode;
  children?: ReactNode;
  /** The line under the name; the opacity shows when none is given. */
  detail?: ReactNode;
}) {
  const mismatched = layerMismatched(rig, layer);
  const opacity = draftOpacity(rig, layer.id) ?? layer.opacity ?? 1;
  return (
    <div className={cn('flex items-center gap-1.5 rounded-md px-1.5 py-1', selected ? 'bg-primary/10' : 'hover:bg-muted/50')}>
      {children}
      {handle}
      <button type="button" aria-pressed={selected} onClick={() => rig.select(layer.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <LayerThumb rig={rig} layer={layer} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body">{layer.name}</span>
          {detail && <Meta className="block truncate">{detail}</Meta>}
        </span>
        {mismatched && <TriangleAlert className="h-4 w-4 shrink-0 text-warning" aria-label="A Variant's size differs from the picture's" />}
        {!detail && <Meta className="shrink-0 tabular-nums">{Math.round(opacity * 100)}%</Meta>}
      </button>
    </div>
  );
}

/** Mobile: the preview beside a compact Layer list, and the selected Layer below with Variants and Look tabs. */
function MobileRigEditor({ rig }: { rig: Rig }) {
  const { layer } = rig;
  const variant = useVariantPick(rig, layer);
  return (
    <div className="space-y-3" data-layered-mobile={rig.entry.id}>
      <PreviewAs rig={rig} />
      <div className="flex gap-3">
        <RigPreview rig={rig} fit="width" className="w-32 shrink-0 self-start" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <Label>Layers</Label>
            {!!rig.entry.layers.length && <AddLayerButton rig={rig} />}
          </div>
          {rig.entry.layers.length
            ? (
              <LayerList
                rig={rig}
                row={(l, handle) => <LayerRow rig={rig} layer={l} selected={l.id === layer?.id} handle={handle} detail={shownName(rig, l)} />}
              />
            )
            : <NoLayers rig={rig} />}
        </div>
      </div>
      {layer && (
        <div className="space-y-2 rounded-md border p-3" data-layer-settings={layer.id}>
          <div className="flex items-center gap-2">
            <LayerNameField key={layer.id} rig={rig} layer={layer} className="h-8 flex-1" />
          </div>
          <Tabs defaultValue="variants">
            <TabsList>
              <TabsTrigger value="variants">Variants</TabsTrigger>
              <TabsTrigger value="look">Look</TabsTrigger>
            </TabsList>
            <TabsContent value="variants" className="space-y-2">
              <VariantStrip rig={rig} layer={layer} selected={variant.index} onSelect={variant.set} />
              <VariantSummary rig={rig} layer={layer} index={variant.index} />
            </TabsContent>
            <TabsContent value="look" className="space-y-3">
              <OpacityField rig={rig} layer={layer} />
              <BlendField rig={rig} layer={layer} />
              <TintField rig={rig} layer={layer} />
            </TabsContent>
          </Tabs>
          <DeleteLayerButton rig={rig} layer={layer} />
        </div>
      )}
    </div>
  );
}
