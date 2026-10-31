import { Hint } from '@/components/ui/typography';
import SlotsSection from './SlotsSection';
import BodiesSection from './BodiesSection';
import PlacementsSection from './PlacementsSection';

/** The Items tab's Equipment Settings entry: the world's slots, its Bodies and the player's starting items. */
const EquipmentEditor = () => (
  <div className="space-y-6" data-testid="equipment-editor">
    <div className="space-y-2">
      <h2 className="font-medium">Equipment Settings</h2>
      <Hint>Sets slots, Bodies and the player&apos;s starting items</Hint>
    </div>
    <SlotsSection />
    <BodiesSection />
    <PlacementsSection
      where={{ kind: 'you' }}
      label="Persona Items"
      hint="Gives the player items when a game starts, whoever they play"
    />
  </div>
);

export default EquipmentEditor;
