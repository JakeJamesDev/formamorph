import React, { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ChevronDown, ChevronUp, Code } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { executeStatCode } from '@/lib/statCodeExecutor';

const StatManager = ({ stat }) => {
  const { updateStat, stats } = useGameData();
  const [editingStat, setEditingStat] = useState(stat);
  const [newDescriptor, setNewDescriptor] = useState({ threshold: '', description: '' });
  const [newListItem, setNewListItem] = useState({ name: '', description: '', number: 0 });
  const [codeOpen, setCodeOpen] = useState(stat?.code ? true : false);
  const [codeResult, setCodeResult] = useState(null);
  const [codeError, setCodeError] = useState(null);
  const [isTestingCode, setIsTestingCode] = useState(false);

  useEffect(() => {
    const initialStat = stat ? { ...stat } : {};
    if (!initialStat.type) {
      initialStat.type = 'number';
    }
    if (!initialStat.code) {
      initialStat.code = '';
    }
    setEditingStat(initialStat);
    
    // Set code section to open by default if stat has code
    if (initialStat.code && initialStat.code.trim() !== '') {
      setCodeOpen(true);
    }
  }, [stat]);

  const handleChange = (field, value) => {
    const updatedStat = { ...editingStat, [field]: value };
    setEditingStat(updatedStat);
    updateStat(updatedStat);
    
    // Reset code test results when code changes
    if (field === 'code') {
      setCodeResult(null);
      setCodeError(null);
    }
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
      
      {/* Code Section */}
      {editingStat.type?.toLowerCase() === 'number' && (
        <Collapsible
          open={codeOpen}
          onOpenChange={setCodeOpen}
          className="border p-2 rounded"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Code className="h-4 w-4 mr-2" />
              <h3 className="text-xl font-semibold">Dynamic Value Calculation (Optional)</h3>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {codeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent className="space-y-2 mt-2">
            <p className="text-sm text-muted-foreground">
              Write JavaScript code to dynamically calculate this stat's value based on other stats.
              The code should return a number. You have access to the 'stats' array containing all stats.
            </p>
            
            <Textarea
              value={editingStat.code || ''}
              onChange={(e) => handleChange('code', e.target.value)}
              placeholder="// Example: Return the average of Health and Strength stats
const health = stats.find(s => s.name === 'Health')?.value || 0;
const strength = stats.find(s => s.name === 'Strength')?.value || 0;
return (health + strength) / 2;"
              className="font-mono text-sm"
              rows={6}
            />
            
            <div className="flex justify-between items-center">
              <Button 
                onClick={async () => {
                  setIsTestingCode(true);
                  setCodeResult(null);
                  setCodeError(null);
                  
                  try {
                    const result = await executeStatCode(editingStat.code, stats, editingStat);
                    if (result.error) {
                      setCodeError(result.error);
                    } else if (result.value !== null) {
                      setCodeResult(result.value);
                    }
                  } catch (error) {
                    setCodeError(error.message);
                  } finally {
                    setIsTestingCode(false);
                  }
                }}
                disabled={isTestingCode || !editingStat.code}
                variant="outline"
              >
                {isTestingCode ? 'Testing...' : 'Test Code'}
              </Button>
              
              {codeResult !== null && (
                <div className="text-green-500">
                  Result: {codeResult}
                </div>
              )}
              
              {codeError && (
                <div className="text-red-500 text-sm">
                  Error: {codeError}
                </div>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              Note: When code is provided, it will override the manual value setting.
              Leave empty to use the manual value. AI can't modify stats with code (but it can see the stat value and desc).
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default StatManager;
