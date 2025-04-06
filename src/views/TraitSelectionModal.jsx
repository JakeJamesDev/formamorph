import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const TraitSelectionModal = ({ 
  traits,
  stats,
  selectedTraits,
  onTraitSelect,
  onClose,
  onConfirm
}) => {
  const getStatName = (statId) => {
    const stat = stats.find(s => s.id === statId);
    return stat ? stat.name : statId;
  };

  return (
    <Card className="fixed inset-0 m-auto w-[95%] max-w-[600px] h-[90vh] max-h-[800px] z-50">
      <CardContent className="p-3 sm:p-6 h-full flex flex-col">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Select Starting Traits</h2>
        <ScrollArea className="flex-1 mb-4">
          {traits.map(trait => (
            <div key={trait.id} className="mb-2 sm:mb-4 p-2 border rounded">
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id={`trait-${trait.id}`}
                  checked={selectedTraits.includes(trait.id)}
                  onCheckedChange={() => onTraitSelect(trait.id)}
                />
                <label htmlFor={`trait-${trait.id}`} className="font-semibold">{trait.name}</label>
              </div>
              <p className="text-xs sm:text-sm mb-2">{trait.description}</p>
              <div className="text-xs sm:text-sm">
                <strong>Stat Changes:</strong>
                <ul className="list-disc list-inside">
                  {trait.statChanges.map((change, index) => (
                    <li key={index}>
                      {getStatName(change.statId)}: {change.value > 0 ? '+' : ''}{change.value} ({change.type})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </ScrollArea>
        <div className="flex gap-2">
          <Button 
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Close
          </Button>
          <Button 
            onClick={onConfirm}
            className="flex-1"
          >
            Confirm
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TraitSelectionModal;
