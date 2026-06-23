import { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DictionaryManager = ({ entry }) => {
  const { updateDictionaryEntry } = useGameData();
  const [editingEntry, setEditingEntry] = useState(entry);
  // Raw text for the keywords box so commas/spaces survive while typing.
  const [keywordsText, setKeywordsText] = useState((entry?.keywords || []).join(', '));

  useEffect(() => {
    setEditingEntry(entry);
    setKeywordsText((entry?.keywords || []).join(', '));
  }, [entry]);

  const handleChange = (field, value) => {
    const updated = { ...editingEntry, [field]: value };
    setEditingEntry(updated);
    updateDictionaryEntry(updated);
  };

  if (!editingEntry) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={editingEntry.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Trigger Keywords (comma-separated)</Label>
        <Input
          value={keywordsText}
          onChange={(e) => {
            setKeywordsText(e.target.value);
            handleChange(
              'keywords',
              e.target.value.split(',').map((k) => k.trim()).filter(Boolean)
            );
          }}
          placeholder="e.g. dragon, wyrm, drake"
        />
        <p className="text-xs text-muted-foreground">
          The description below is injected into the AI prompt only when one of these keywords appears in the story or your actions.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Description (injected on keyword match)</Label>
        <Textarea
          value={editingEntry.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={8}
        />
      </div>
    </div>
  );
};

export default DictionaryManager;
