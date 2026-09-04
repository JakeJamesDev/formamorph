import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GameLocation } from "@/types";
import { useBackStop } from "@/hooks/useBackStop";

const RANDOM = "random";

/** Post-traits step: pick which of the world's starting locations to begin in, defaulting to Random
 *  (which matches the pre-existing behavior — a random pick among the starting set). Only shown when the
 *  world has more than one starting location. */
const StartingLocationModal = ({
  locations,
  resolveText,
  onConfirm,
  onAbort,
  onBack,
  confirmLabel = 'Start',
}: {
  locations: GameLocation[];
  /** Resolves a chip to this playthrough's value. Names arrive resolved; descriptions are resolved here. */
  resolveText: (text: string) => string;
  onConfirm: (locationId: string | null) => void;
  onAbort: () => void;
  /** Step back in the enter-world flow. Undefined on the flow's first step (the Back button then fades). */
  onBack?: () => void;
  /** Label for the confirm button — names the next step in the flow (e.g. "Avatar", "Start"). */
  confirmLabel?: string;
}) => {
  // This card is not a Radix layer, so the Android back button cannot see it; it steps back the way the Back
  // button does, and leaves the flow from its first step.
  useBackStop(onBack ?? onAbort);
  const [selected, setSelected] = useState<string>(RANDOM);

  return (
    <Card className="fixed inset-x-0 top-[env(safe-area-inset-top)] bottom-[env(safe-area-inset-bottom)] m-auto w-[95%] max-w-[600px] h-[calc(90dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-h-[800px] z-50">
      <CardContent className="p-3 sm:p-6 h-full flex flex-col">
        <h2 className="text-title sm:text-heading font-semibold mb-3">Choose Starting Location</h2>

        <ScrollArea className="flex-1 mb-4">
          <RadioGroup value={selected} onValueChange={setSelected} className="pr-2">
            <label
              htmlFor="start-loc-random"
              className="flex items-start gap-2 mb-2 sm:mb-4 p-2 border rounded cursor-pointer"
            >
              <RadioGroupItem value={RANDOM} id="start-loc-random" className="mt-1" />
              <div>
                <span className="font-semibold">Random</span>
                <p className="text-meta sm:text-helper text-muted-foreground">
                  Begin somewhere random among the starting locations for this world.
                </p>
              </div>
            </label>

            {locations.map((location) => {
              const raw = location.playerDescription?.trim() || location.description?.trim();
              const description = raw ? resolveText(raw) : raw;
              return (
                <label
                  key={location.id}
                  htmlFor={`start-loc-${location.id}`}
                  className="flex items-start gap-2 mb-2 sm:mb-4 p-2 border rounded cursor-pointer"
                >
                  <RadioGroupItem value={location.id} id={`start-loc-${location.id}`} className="mt-1" />
                  <div>
                    <Label htmlFor={`start-loc-${location.id}`} className="font-semibold cursor-pointer">
                      {location.name}
                    </Label>
                    {description && <p className="text-meta sm:text-label">{description}</p>}
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </ScrollArea>

        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={onAbort} variant="destructive" className="flex-1">Abort</Button>
          <Button onClick={onBack} variant="outline" className="flex-1" disabled={!onBack}>Back</Button>
          <Button onClick={() => onConfirm(selected === RANDOM ? null : selected)} className="flex-1">{confirmLabel}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StartingLocationModal;
