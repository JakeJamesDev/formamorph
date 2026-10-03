import { Settings } from 'lucide-react';
import { CheckRow, Row, Section } from '@/components/SettingsRows';
import { SETTINGS_DIALOG_SIZE } from '@/components/modals/settingsDialogSize';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HELP_HISTORY_MAX, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { FORMAQUESTION_SETTINGS_TABS, GENERAL_COPY, type FormaquestionSettingsTab } from './formaquestionSettingsTabs';

function GeneralTab({ settings, onChange }: { settings: HelpSettings; onChange: (change: HelpSettingsChange) => void }) {
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
export function FormaquestionSettings({ open, onOpenChange, tab, onTabChange, settings, onChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: FormaquestionSettingsTab;
  onTabChange: (tab: FormaquestionSettingsTab) => void;
  settings: HelpSettings;
  onChange: (change: HelpSettingsChange) => void;
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
              <GeneralTab settings={settings} onChange={onChange} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
