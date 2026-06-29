import { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Trait, StatChange } from '@/types';

const TraitManager = ({ trait }: { trait: Trait }) => {
  const { updateTrait, stats } = useGameData();
  const [editingTrait, setEditingTrait] = useState<Trait>(trait);

  useEffect(() => {
    setEditingTrait(trait);
  }, [trait]);

  const handleChange = (field: string, value: unknown) => {
    const updatedTrait = { ...editingTrait, [field]: value } as Trait;
    setEditingTrait(updatedTrait);
    updateTrait(updatedTrait);
  };

  const handleStatChangeAdd = () => {
    const updatedTrait = {
      ...editingTrait,
      statChanges: [
        ...editingTrait.statChanges,
        { statId: '', value: 0, type: 'min' }
      ]
    } as Trait;
    setEditingTrait(updatedTrait);
    updateTrait(updatedTrait);
  };

  const handleStatChangeUpdate = (index: number, field: string, value: string | number) => {
    const updatedStatChanges = [...editingTrait.statChanges];
    updatedStatChanges[index] = { ...updatedStatChanges[index], [field]: value } as StatChange;
    const updatedTrait = { ...editingTrait, statChanges: updatedStatChanges };
    setEditingTrait(updatedTrait);
    updateTrait(updatedTrait);
  };

  const handleStatChangeRemove = (index: number) => {
    const updatedStatChanges = [...editingTrait.statChanges];
    updatedStatChanges.splice(index, 1);
    const updatedTrait = { ...editingTrait, statChanges: updatedStatChanges };
    setEditingTrait(updatedTrait);
    updateTrait(updatedTrait);
  };

  if (!editingTrait) return null;

  return (
    <div className="space-y-4">
       <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={editingTrait.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Player-Facing Description</Label>
        <Textarea
          value={editingTrait.playerDescription || ''}
          onChange={(e) => handleChange('playerDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>AI-Facing Description</Label>
        <Textarea
          value={editingTrait.aiDescription || ''}
          onChange={(e) => handleChange('aiDescription', e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={!!editingTrait.isDefault}
          onCheckedChange={(c) => handleChange('isDefault', c === true)}
        />
        <span>Enabled by Default</span>
        <span className="text-xs text-muted-foreground">(pre-checked in the trait-selection screen)</span>
      </label>
      <div className="space-y-2">
        <Label>Stat Changes</Label>
        {editingTrait.statChanges.map((statChange, index) => (
          <div key={index} className="flex space-x-2">
            <Select
              value={statChange.statId}
              onValueChange={(value) => handleStatChangeUpdate(index, 'statId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select stat" />
              </SelectTrigger>
              <SelectContent>
                {stats.map((stat) => (
                  <SelectItem key={stat.id} value={stat.id}>
                    {stat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={statChange.value}
              onChange={(e) => handleStatChangeUpdate(index, 'value', Number(e.target.value))}
            />
            <Select
              value={statChange.type}
              onValueChange={(value) => handleStatChangeUpdate(index, 'type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="min">Min</SelectItem>
                <SelectItem value="max">Max</SelectItem>
                <SelectItem value="starting">Starting Value</SelectItem>
                <SelectItem value="regen">Regen</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleStatChangeRemove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button onClick={handleStatChangeAdd}>Add Stat Change</Button>
      </div>
    </div>
  );
};

export default TraitManager;
