import { Settings } from 'lucide-react';
import { CheckRow, Row, Section } from '@/components/SettingsRows';
import { SETTINGS_DIALOG_SIZE } from '@/components/modals/settingsDialogSize';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HELP_HISTORY_MAX, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import type { SemanticSearch } from './useSemanticSearch';
import { FORMAQUESTION_SETTINGS_TABS, GENERAL_COPY, type FormaquestionSettingsTab } from './formaquestionSettingsTabs';

const MB = 1048576;

/** The progress bar of the model download, and the failed state with its retry. */
function SemanticStatus({ semantic }: { semantic: SemanticSearch }) {
  const { progress, error, downloading } = semantic;
  const known = progress !== null && progress.total > 0;
  if (downloading) {
    return (
      <Row>
        <div className="flex items-center gap-2">
          <Progress className="h-2 flex-1" aria-label="Model download" value={known ? (progress.loaded / progress.total) * 100 : 0} />
          <span className="text-meta text-muted-foreground whitespace-nowrap">
            {known ? `${Math.round(progress.loaded / MB)} / ${Math.round(progress.total / MB)} MB` : 'Preparing…'}
          </span>
        </div>
      </Row>
    );
  }
  if (error === null) return null;
  return (
    <Row>
      <div className="flex items-center gap-2">
        <span className="text-helper text-destructive">Model download failed: {error}</span>
        <Button variant="outline" size="sm" onClick={() => semantic.setOn(true)}>Retry</Button>
      </div>
    </Row>
  );
}

function GeneralTab({ settings, onChange, semantic }: { settings: HelpSettings; onChange: (change: HelpSettingsChange) => void; semantic: SemanticSearch }) {
  return (
    <div className="grid gap-6 py-4">
      <Section title="Search">
        <CheckRow
          htmlFor="fq-keyword"
          checked={settings.sources.keyword}
          onChange={(keyword) => onChange({ sources: { keyword } })}
          {...GENERAL_COPY.keyword}
        />
        <CheckRow
          htmlFor="fq-ai-picks"
          checked={settings.sources.aiPicks}
          onChange={(aiPicks) => onChange({ sources: { aiPicks } })}
          {...GENERAL_COPY.aiPicks}
        />
        <CheckRow htmlFor="fq-semantic" checked={semantic.on} onChange={semantic.setOn} {...GENERAL_COPY.semantic} />
        <SemanticStatus semantic={semantic} />
      </Section>
      <Section title="Request">
        <CheckRow
          htmlFor="fq-open-screen"
          checked={settings.openScreen}
          onChange={(openScreen) => onChange({ openScreen })}
          {...GENERAL_COPY.openScreen}
        />
        <Row htmlFor="fq-history-length" {...GENERAL_COPY.historyLength}>
          <Input
            id="fq-history-length"
            type="number"
            min={0}
            max={HELP_HISTORY_MAX}
            value={settings.historyLength}
            onChange={(event) => onChange({ historyLength: Math.min(HELP_HISTORY_MAX, Math.max(0, parseInt(event.target.value) || 0)) })}
            className="w-20"
          />
        </Row>
      </Section>
    </div>
  );
}

/**
 * Formaquestion Settings: a dialog the size of Settings, opened from the gear in the Formaquestion header.
 * The help window stays above it.
 */
export function FormaquestionSettings({ open, onOpenChange, tab, onTabChange, settings, onChange, semantic }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: FormaquestionSettingsTab;
  onTabChange: (tab: FormaquestionSettingsTab) => void;
  settings: HelpSettings;
  onChange: (change: HelpSettingsChange) => void;
  semantic: SemanticSearch;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        surface="formaquestionSettings"
        aria-describedby={undefined}
        className={SETTINGS_DIALOG_SIZE}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Formaquestion Settings</DialogTitle>
        </DialogHeader>
        <Tabs
          surfaceTabs="formaquestionSettings"
          value={tab}
          onValueChange={(value) => onTabChange(value as FormaquestionSettingsTab)}
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          <TabsList className="grid w-full flex-shrink-0 grid-cols-4">
            {FORMAQUESTION_SETTINGS_TABS.map((entry) => <TabsTrigger key={entry.value} value={entry.value}>{entry.label}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="general" className="min-h-0 flex-1 px-2 data-[state=active]:flex flex-col">
            <ScrollArea className="min-h-0 flex-1">
              <GeneralTab settings={settings} onChange={onChange} semantic={semantic} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
