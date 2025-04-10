import React, { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TraitManager = ({ trait }) => {
  const { updateTrait, stats } = useGameData();
  const [editingTrait, setEditingTrait] = useState(trait);

  useEffect(() => {
    setEditingTrait(trait);
  }, [trait]);

  const handleChange = (field, value) => {
    const updatedTrait = { ...editingTrait, [field]: value };
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
    };
    setEditingTrait(updatedTrait);
    updateTrait(updatedTrait);
  };

  const handleStatChangeUpdate = (index, field, value) => {
    const updatedStatChanges = [...editingTrait.statChanges];
    updatedStatChanges[index] = { ...updatedStatChanges[index], [field]: value };
    const updatedTrait = { ...editingTrait, statChanges: updatedStatChanges };
    setEditingTrait(updatedTrait);
    updateTrait(updatedTrait);
  };

  const handleStatChangeRemove = (index) => {
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
        <Label>Description</Label>
        <Input
          value={editingTrait.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>
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
