import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ValueSlider } from '@/components/SettingsRows';
import { Tip } from '@/components/ui/tooltip';
import { IMAGE_CAPS } from '@/lib/imageSlots';
import { ImageUpload } from '@/lib/UtilityComponents';

/** What the canvas's Map Background card is open for: picking slot 0's image, or adjusting the frame. */
export type MapBackgroundPanelMode = 'set' | 'adjust';

/**
 * The canvas card for the Map Background. Set takes a file or a link for slot 0; Adjust shows the Opacity
 * slider and Remove Image while the image sits in front for dragging.
 */
export function MapBackgroundPanel({ mode, replacing, opacity, onPick, onOpacity, onRemove, onClose }: {
  mode: MapBackgroundPanelMode;
  /** Slot 0 already holds an image. */
  replacing: boolean;
  opacity: number;
  onPick: (data: string) => void;
  onOpacity: (opacity: number) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const percent = Math.round(opacity * 100);
  return (
    <div className="space-y-3 rounded-md border bg-card p-3 shadow-md" data-map-background-panel={mode}>
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-grow truncate text-label">
          {mode === 'adjust' ? 'Adjust Background' : replacing ? 'Replace Background Image' : 'Set Background Image'}
        </span>
        <Tip tip={mode === 'adjust' ? 'Stop Adjusting' : 'Close'}>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </Tip>
      </div>
      {mode === 'set'
        ? (
          <ImageUpload
            id="map-background"
            cap={IMAGE_CAPS.map}
            onChange={(data) => { if (data) onPick(data); }}
          />
        )
        : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="map-background-opacity">Opacity</Label>
              <ValueSlider
                id="map-background-opacity"
                ariaLabel="Opacity"
                min={0}
                max={100}
                step={1}
                value={percent}
                format={(v) => `${v}%`}
                valueClassName="w-12"
                onChange={(value) => onOpacity(value / 100)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={onRemove}>
              <Trash2 className="mr-1 h-4 w-4" />Remove Image
            </Button>
          </>
        )}
    </div>
  );
}
