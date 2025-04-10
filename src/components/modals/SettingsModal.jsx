import React from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from '../ConfirmDialog';
import { defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt } from '../game/GamePrompts';

export const SettingsModal = ({ isOpen, onOpenChange, onSave }) => {
  const {
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
    setAutoscroll
  } = useSettings();
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
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="endpointUrl" className="text-right">
                  Endpoint URL
                </label>
                <Input
                  id="endpointUrl"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="apiToken" className="text-right">
                  API Token
                </label>
                <Input
                  id="apiToken"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="modelName" className="text-right">
                  Model Name
                </label>
                <Input
                  id="modelName"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="aiMessageLimit" className="text-right">
                  Max Memory (characters)
                </label>
                <Input
                  id="aiMessageLimit"
                  type="number"
                  value={aiMessageLimit}
                  onChange={(e) => setAiMessageLimit(Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
                <label htmlFor="maxTokens" className="text-right">
                  Max Output Tokens
                </label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
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
                <div className="col-span-3">
                  <Textarea
                    id="choicesPrompt"
                    value={choicesPrompt}
                    onChange={(e) => setChoicesPrompt(e.target.value)}
                    className="w-full"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Write 'DISABLED' to disable</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <label htmlFor="statUpdatesPrompt" className="text-left sm:text-right">
                Stat Updates Prompt
              </label>
              <div className="col-span-3">
                <Textarea
                  id="statUpdatesPrompt"
                  value={statUpdatesPrompt}
                  onChange={(e) => setStatUpdatesPrompt(e.target.value)}
                  className="w-full"
                  rows={6}
                />
                <p className="text-xs text-gray-500 mt-1">Write 'DISABLED' to disable</p>
              </div>
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
