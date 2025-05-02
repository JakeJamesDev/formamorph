import React, { useRef, useEffect, useState } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from 'react-toastify';

const WorldOverviewManager = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const fileInputRef = useRef(null);
  const bgmInputRef = useRef(null);
  const thumbnailRef = useRef(null);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (worldOverview.thumbnail && thumbnailRef.current) {
      thumbnailRef.current.src = worldOverview.thumbnail;
    }
  }, [worldOverview.thumbnail]);

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.dark('Please select an image file', { type: 'error' });
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const base64String = e.target.result;
          // Store the base64 string in the world overview
          updateWorldOverview({ thumbnail: base64String });
        } catch (error) {
          console.error('Error processing image:', error);
          toast.dark('Error processing image. Please try again.', { type: 'error' });
        }
      };

      reader.onerror = () => {
        console.error('Error reading file');
        toast.dark('Error reading file. Please try again.', { type: 'error' });
      };

      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailClick = () => {
    fileInputRef.current?.click();
  };

  const handleBGMChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith('audio/')) {
        toast.dark('Please select an audio file', { type: 'error' });
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const base64String = e.target.result;
          updateWorldOverview({ bgm: base64String });
        } catch (error) {
          console.error('Error processing audio:', error);
          toast.dark('Error processing audio. Please try again.', { type: 'error' });
        }
      };

      reader.onerror = () => {
        console.error('Error reading file');
        toast.dark('Error reading file. Please try again.', { type: 'error' });
      };

      reader.readAsDataURL(file);
    }
  };

  const handleBGMClick = () => {
    bgmInputRef.current?.click();
  };

  const handleAddTag = () => {
    if (tagInput.trim()) {
      const newTags = [...(worldOverview.tags || [])];
      if (!newTags.includes(tagInput.trim())) {
        newTags.push(tagInput.trim());
        updateWorldOverview({ tags: newTags });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const newTags = (worldOverview.tags || []).filter(tag => tag !== tagToRemove);
    updateWorldOverview({ tags: newTags });
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="worldName">World Name</Label>
        <Input
          id="worldName"
          value={worldOverview.name}
          onChange={(e) => updateWorldOverview({ name: e.target.value })}
          placeholder="Enter world name..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="worldAuthor">Author</Label>
        <Input
          id="worldAuthor"
          value={worldOverview.author}
          onChange={(e) => updateWorldOverview({ author: e.target.value })}
          placeholder="Enter author name..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="worldDescription">World Description</Label>
        <Textarea
          id="worldDescription"
          value={worldOverview.description}
          onChange={(e) => updateWorldOverview({ description: e.target.value })}
          placeholder="Enter world description..."
          className="min-h-[100px]"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="use3DModel"
          checked={worldOverview.use3DModel}
          onCheckedChange={(checked) => updateWorldOverview({ use3DModel: checked })}
        />
        <Label htmlFor="use3DModel">Enable 3D Character Model (also allow the player to customize it)</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="thumbnail">Thumbnail Image</Label>
        <input
          ref={fileInputRef}
          id="thumbnail"
          type="file"
          accept="image/*"
          onChange={handleThumbnailChange}
          className="hidden"
        />
        <div 
          onClick={handleThumbnailClick}
          className="w-[350px] h-[262.5px] relative bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors mx-auto"
        >
          {worldOverview.thumbnail ? (
            <img
              ref={thumbnailRef}
              src={worldOverview.thumbnail}
              alt="World thumbnail"
              className="absolute inset-0 w-full h-full object-cover rounded-md"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              Click to upload image
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bgm">Background Music</Label>
        <input
          ref={bgmInputRef}
          id="bgm"
          type="file"
          accept="audio/*"
          onChange={handleBGMChange}
          className="hidden"
        />
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleBGMClick}
            className="flex-1"
          >
            {worldOverview.bgm ? "Change BGM" : "Upload BGM"}
          </Button>
          {worldOverview.bgm && (
            <Button
              variant="destructive"
              onClick={() => updateWorldOverview({ bgm: null })}
            >
              Remove
            </Button>
          )}
        </div>
        {worldOverview.bgm && (
          <div className="mt-2">
            <audio controls src={worldOverview.bgm} className="w-full" />
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="worldTags">Tags</Label>
        <div className="flex gap-2">
          <Input
            id="worldTags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add tags (press Enter to add)..."
          />
          <Button onClick={handleAddTag} type="button">Add</Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {(worldOverview.tags || []).map((tag, index) => (
            <div 
              key={index} 
              className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full flex items-center gap-1"
            >
              <span>{tag}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-4 w-4 rounded-full" 
                onClick={() => handleRemoveTag(tag)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="systemPrompt">System Prompt Addition</Label>
        <Textarea
          id="systemPrompt"
          value={worldOverview.systemPrompt}
          onChange={(e) => updateWorldOverview({ systemPrompt: e.target.value })}
          placeholder="Enter an overview of your world that the AI should know, and rules it should follow..."
          className="min-h-[150px]"
        />
      </div>
      
    </div>
  );
};

export default WorldOverviewManager;
