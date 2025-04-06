import * as React from 'react';
import { Save, Download, Upload, Trash2 } from "lucide-react";
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt } from './GamePrompts';
import { 
  initDB, 
  saveToDB, 
  loadFromDB, 
  getAllSaves, 
  deleteFromDB,
  DB_NAME,
  STORE_NAME,
  DB_VERSION
} from '../modals/dbUtils';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getModelType } from '../../lib/UtilityComponents';
import ModelViewer from '@/views/ModelViewer';
import { ConfirmDialog } from '../ConfirmDialog';




export const EntityModal = ({ entity, isOpen, onOpenChange }) => {
  if (!entity) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{entity.name}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow overflow-y-auto">
          <div className="grid gap-4 p-4">
            {entity.image && (
              <img src={entity.image} alt={entity.name} className="w-full h-auto" />
            )}
            <p>{entity.inGameDescription}</p>
            {entity.sound && (
              <audio controls>
                <source src={entity.sound.data} type={entity.sound.type} />
                Your browser does not support the audio element.
              </audio>
            )}
            {entity.model && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button>View 3D Model</Button>
                </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>3D Model Viewer</DialogTitle>
                  </DialogHeader>
                  <ModelViewer modelData={entity.model.data} modelType={getModelType(entity.model.type)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export const LocationModal = ({ isOpen, onOpenChange, locations, changeLocation }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Change Location</DialogTitle>
        </DialogHeader>
        <Select onValueChange={(value) => {
          const selectedLocation = locations.find(location => location.id === value);
          if (selectedLocation) {
            changeLocation(selectedLocation);
            onOpenChange(false);
          }
        }}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogContent>
    </Dialog>
  );
};



export const EditTextModal = ({
  isOpen,
  onOpenChange,
  text,
  onSave
}) => {
  const [editedText, setEditedText] = React.useState(text);

  // Reset edited text when modal opens
  React.useEffect(() => {
    setEditedText(text);
  }, [text]);

  const handleSave = () => {
    onSave(editedText);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Text</DialogTitle>
        </DialogHeader>
        <div className="flex-grow min-h-0 my-4">
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="w-full h-[300px] resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const SettingsModal = ({ 
  isOpen, 
  onOpenChange, 
  bgmEnabled,
  setBgmEnabled,
  language,
  setLanguage,
  endpointUrl,
  setEndpointUrl,
  apiToken,
  setApiToken,
  modelName,
  setModelName,
  aiMessageLimit,
  setAiMessageLimit,
  maxTokens,
  setMaxTokens,
  systemPrompt,
  setSystemPrompt,
  choicesPrompt,
  setChoicesPrompt,
  statUpdatesPrompt,
  setStatUpdatesPrompt,
  shortform,
  setShortform,
  autoscroll,
  setAutoscroll,
  onSave
}) => {
  const handleResetEndpointSettings = () => {
    setEndpointUrl('https://mistral.lyonade.net/v1/chat/completions');
    setModelName('shuyuej/Mistral-Nemo-Instruct-2407-GPTQ');
    setApiToken('');
    setAiMessageLimit(2000);
    setMaxTokens(1024);
  };

  const handleResetPrompts = () => {
    setSystemPrompt(defaultSystemPrompt);
    setChoicesPrompt(defaultChoicesPrompt);
    setStatUpdatesPrompt(defaultStatUpdatesPrompt);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="gameplay" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gameplay">Gameplay</TabsTrigger>
            <TabsTrigger value="endpoint">Endpoint</TabsTrigger>
            <TabsTrigger value="prompts">System Prompts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="gameplay" className="py-4 px-2">
            <div className="grid gap-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="language" className="text-left sm:text-right">
                  Language
                </label>
                <Input
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter language"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="bgmEnabled" className="text-left sm:text-right">
                  Background Music
                </label>
                <input
                  id="bgmEnabled"
                  type="checkbox"
                  checked={bgmEnabled}
                  onChange={(e) => setBgmEnabled(e.target.checked)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="shortform" className="text-left sm:text-right">
                  Single-Paragraph Event
                </label>
                <input
                    id="shortform"
                    type="checkbox"
                    checked={shortform}
                    onChange={(e) => setShortform(e.target.checked)}
                    className="col-span-3"
                  />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="autoscroll" className="text-left sm:text-right">
                  Auto-scroll Messages
                </label>
                <input
                  id="autoscroll"
                  type="checkbox"
                  checked={autoscroll}
                  onChange={(e) => setAutoscroll(e.target.checked)}
                  className="col-span-3"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="endpoint" className="py-4 px-2">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="endpointUrl" className="text-left sm:text-right">
                  Endpoint URL
                </label>
                <Input
                  id="endpointUrl"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="apiToken" className="text-left sm:text-right">
                  API Token
                </label>
                <Input
                  id="apiToken"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="modelName" className="text-left sm:text-right">
                  Model Name
                </label>
                <Input
                  id="modelName"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="aiMessageLimit" className="text-left sm:text-right">
                  Max Memory (characters)
                </label>
                <Input
                  id="aiMessageLimit"
                  type="number"
                  value={aiMessageLimit}
                  onChange={(e) => setAiMessageLimit(Number(e.target.value))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="maxTokens" className="text-left sm:text-right">
                  Max Output Tokens
                </label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="col-span-3"
                />
              </div>
              <div className="flex justify-end">
                <ConfirmDialog
                  title="Reset AI Endpoint"
                  description="Are you sure you want to reset the endpoint URL, model name, API token, and limits to their default values?"
                  onConfirm={handleResetEndpointSettings}
                >
                  <Button variant="outline" className="flex items-center gap-2">
                    Reset AI Endpoint
                  </Button>
                </ConfirmDialog>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="prompts" className="py-4 px-2">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="systemPrompt" className="text-left sm:text-right">
                  Game Text Prompt
                </label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="col-span-3"
                  rows={6}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="choicesPrompt" className="text-left sm:text-right">
                  Choices Prompt
                </label>
                <Textarea
                  id="choicesPrompt"
                  value={choicesPrompt}
                  onChange={(e) => setChoicesPrompt(e.target.value)}
                  className="col-span-3"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                <label htmlFor="statUpdatesPrompt" className="text-left sm:text-right">
                  Stat Updates Prompt
                </label>
                <Textarea
                  id="statUpdatesPrompt"
                  value={statUpdatesPrompt}
                  onChange={(e) => setStatUpdatesPrompt(e.target.value)}
                  className="col-span-3"
                  rows={6}
                />
              </div>
              <div className="flex justify-end">
                <ConfirmDialog
                  title="Reset AI Prompts"
                  description="Are you sure you want to reset all AI prompts to their default values?"
                  onConfirm={handleResetPrompts}
                >
                  <Button variant="outline" className="flex items-center gap-2">
                    Reset AI Prompts
                  </Button>
                </ConfirmDialog>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
