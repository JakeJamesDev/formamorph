import React, { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const StatManager = ({ stat }) => {
  const { updateStat } = useGameData();
  const [editingStat, setEditingStat] = useState(stat);
  const [newDescriptor, setNewDescriptor] = useState({ threshold: '', description: '' });
  const [newListItem, setNewListItem] = useState({ name: '', description: '', number: 0 });

  useEffect(() => {
    const initialStat = stat ? { ...stat } : {};
    if (!initialStat.type) {
      initialStat.type = 'number';
    }
    setEditingStat(initialStat);
  }, [stat]);

  const handleChange = (field, value) => {
    const updatedStat = { ...editingStat, [field]: value };
    setEditingStat(updatedStat);
    updateStat(updatedStat);
  };

  const handleTypeChange = (value) => {
    let updatedStat = { ...editingStat, type: value };
    if (value === 'list') {
      updatedStat.value = updatedStat.value || [];
    } else {
      updatedStat.value = typeof updatedStat.value === 'number' ? updatedStat.value : 0;
    }
    setEditingStat(updatedStat);
    updateStat(updatedStat);
  };

  const handleDescriptorChange = (index, field, value) => {
    const updatedDescriptors = [...(editingStat.descriptors || [])];
    updatedDescriptors[index] = { ...updatedDescriptors[index], [field]: value };
    handleChange('descriptors', updatedDescriptors);
  };

  const handleAddDescriptor = () => {
    if (newDescriptor.threshold && newDescriptor.description) {
      const updatedDescriptors = [
        ...(editingStat.descriptors || []),
        { ...newDescriptor, id: Date.now() }
      ];
      handleChange('descriptors', updatedDescriptors);
      setNewDescriptor({ threshold: '', description: '' });
    }
  };

  const handleRemoveDescriptor = (descriptorId) => {
    const updatedDescriptors = (editingStat.descriptors || []).filter(
      desc => desc.id !== descriptorId
    );
    handleChange('descriptors', updatedDescriptors);
  };

  const handleAddListItem = () => {
    if (newListItem.name && editingStat.type === 'list') {
      const updatedValue = [...(editingStat.value || []), { ...newListItem, id: Date.now() }];
      handleChange('value', updatedValue);
      setNewListItem({ name: '', description: '', number: 0 });
    }
  };

  const handleRemoveListItem = (itemId) => {
    if (editingStat.type === 'list') {
      const updatedValue = editingStat.value.filter(item => item.id !== itemId);
      handleChange('value', updatedValue);
    }
  };

  const handleListItemChange = (itemId, field, value) => {
    if (editingStat.type === 'list') {
      const updatedValue = editingStat.value.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      );
      handleChange('value', updatedValue);
    }
  };

  if (!editingStat) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={editingStat.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={editingStat.type || 'number'} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select stat type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">Number</SelectItem>
            {/* <SelectItem value="list">List</SelectItem> */}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={editingStat.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>
      {editingStat.type?.toLowerCase() === 'number' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Min</Label>
            <Input
              type="number"
              value={editingStat.min || 0}
              onChange={(e) => handleChange('min', Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Max</Label>
            <Input
              type="number"
              value={editingStat.max || 100}
              onChange={(e) => handleChange('max', Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Value</Label>
            <Input
              type="number"
              value={editingStat.value || 0}
              onChange={(e) => handleChange('value', Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Regen</Label>
            <Input
              type="number"
              value={editingStat.regen || 0}
              onChange={(e) => handleChange('regen', Number(e.target.value))}
            />
          </div>
        </div>
      )}
      {editingStat.type?.toLowerCase() === 'list' && (
        <div className="space-y-2">
          <Label>Items</Label>
          {editingStat.value && editingStat.value.map((item) => (
            <div key={item.id} className="space-y-2 border p-2 rounded">
              <div className="flex items-center space-x-2">
                <Input 
                  value={item.name} 
                  onChange={(e) => handleListItemChange(item.id, 'name', e.target.value)}
                  placeholder="Item name"
                  className="flex-grow"
                />
                <Input 
                  type="number"
                  value={item.number}
                  onChange={(e) => handleListItemChange(item.id, 'number', Number(e.target.value))}
                  placeholder="Quantity"
                  className="w-24"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveListItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input 
                value={item.description} 
                onChange={(e) => handleListItemChange(item.id, 'description', e.target.value)}
                placeholder="Item description"
              />
            </div>
          ))}
          <div className="space-y-2 border p-2 rounded">
            <div className="flex items-center space-x-2">
              <Input
                value={newListItem.name}
                onChange={(e) => setNewListItem({...newListItem, name: e.target.value})}
                placeholder="New item name"
                className="flex-grow"
              />
              <Input
                type="number"
                value={newListItem.number}
                onChange={(e) => setNewListItem({...newListItem, number: Number(e.target.value)})}
                placeholder="Quantity"
                className="w-24"
              />
            </div>
            <Input
              value={newListItem.description}
              onChange={(e) => setNewListItem({...newListItem, description: e.target.value})}
              placeholder="New item description"
            />
            <Button onClick={handleAddListItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Stat Descriptors</h3>
        {editingStat.descriptors && editingStat.descriptors.map((descriptor, index) => (
          <div key={descriptor.id} className="flex items-center space-x-2">
            <Input
              type="number"
              value={descriptor.threshold}
              onChange={(e) => handleDescriptorChange(index, 'threshold', Number(e.target.value))}
              placeholder="Threshold %"
              className="w-24"
            />
            <Input
              value={descriptor.description}
              onChange={(e) => handleDescriptorChange(index, 'description', e.target.value)}
              placeholder="Description"
              className="flex-grow"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveDescriptor(descriptor.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex items-center space-x-2">
          <Input
            type="number"
            value={newDescriptor.threshold}
            onChange={(e) => setNewDescriptor({ ...newDescriptor, threshold: Number(e.target.value) })}
            placeholder="New Threshold %"
            className="w-24"
          />
          <Input
            value={newDescriptor.description}
            onChange={(e) => setNewDescriptor({ ...newDescriptor, description: e.target.value })}
            placeholder="New Description"
            className="flex-grow"
          />
          <Button onClick={handleAddDescriptor}>Add</Button>
        </div>
      </div>
    </div>
  );
};

export default StatManager;
