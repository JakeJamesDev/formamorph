import React, { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, X } from "lucide-react";

const StatUpdatesManager = ({ statUpdate }) => {
  const { stats, updateStatUpdate } = useGameData();
  const [editingStatUpdate, setEditingStatUpdate] = useState(statUpdate);

  useEffect(() => {
    setEditingStatUpdate(statUpdate);
  }, [statUpdate]);

  const handleChange = (field, value) => {
    const updatedStatUpdate = { ...editingStatUpdate, [field]: value };
    setEditingStatUpdate(updatedStatUpdate);
    updateStatUpdate(updatedStatUpdate);
  };

  const handleStatToggle = (statName) => {
    const updatedStats = editingStatUpdate.stats.includes(statName)
      ? editingStatUpdate.stats.filter(s => s !== statName)
      : [...editingStatUpdate.stats, statName];
    handleChange('stats', updatedStats);
  };

  const handleAddMessage = () => {
    const newMessageRole = (editingStatUpdate.messageHistory?.length || 0) % 2 === 0 ? 'user' : 'assistant';
    const newMessage = { role: newMessageRole, content: '' };
    handleChange('messageHistory', [...(editingStatUpdate.messageHistory || []), newMessage]);
  };

  const handleUpdateMessage = (index, content) => {
    const updatedMessages = [...(editingStatUpdate.messageHistory || [])];
    updatedMessages[index] = { ...updatedMessages[index], content };
    handleChange('messageHistory', updatedMessages);
  };

  const handleRemoveMessage = (index) => {
    const updatedMessages = (editingStatUpdate.messageHistory || []).filter((_, i) => i !== index);
    handleChange('messageHistory', updatedMessages);
  };

  if (!editingStatUpdate) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Update Name</Label>
        <Input
          value={editingStatUpdate.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Distance Traveled Update"
        />
      </div>
      <div className="space-y-2">
        <Label>AI Prompt</Label>
        <Textarea
          value={editingStatUpdate.prompt || ''}
          onChange={(e) => handleChange('prompt', e.target.value)}
          placeholder="Enter the AI prompt for this update..."
          rows={4}
        />
      </div>
      <div className="space-y-2">
        <Label>Select Stats to Update</Label>
        <ScrollArea className="h-40 border rounded-md p-2">
          {stats.map(stat => (
            <div key={stat.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`stat-${stat.id}`}
                checked={editingStatUpdate.stats.includes(stat.name)}
                onChange={() => handleStatToggle(stat.name)}
              />
              <label htmlFor={`stat-${stat.id}`}>{stat.name}</label>
            </div>
          ))}
        </ScrollArea>
      </div>
      
      <div className="space-y-2">
        <Label>Message History</Label>
        <Button onClick={handleAddMessage} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Add Message
        </Button>
        <div className="border rounded-md p-2 space-y-2">
          {(editingStatUpdate.messageHistory || []).map((message, index) => (
            <div key={index} className="p-2 border rounded">
              <div className="flex justify-between mb-1">
                <span className="font-semibold capitalize">{message.role}</span>
                <Button onClick={() => handleRemoveMessage(index)} size="sm" variant="ghost">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={message.content}
                onChange={(e) => handleUpdateMessage(index, e.target.value)}
                placeholder={`${message.role.charAt(0).toUpperCase() + message.role.slice(1)} message`}
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatUpdatesManager;