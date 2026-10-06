import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { EditorMode } from '@/lib/editorMode';
import { EditorSectionsBar } from '@/components/editor/EditorSectionsBar';
import { WORLD_EDITOR_TABS, editorTabGroupsFor } from '@/views/worldEditorTabs';

/** What each tab's body says, so switching tabs shows a real change rather than an empty box. */
const BODY: Record<string, string> = {
  overview: 'The world\'s name, card, and AI-facing text.',
  stats: 'The stat list beside the selected stat\'s details.',
  entities: 'The entity tree beside the selected entity\'s details.',
  locations: 'The location tree or the canvas.',
  traits: 'The trait tree beside the selected trait\'s details.',
  dictionary: 'The dictionaries and their entries.',
  placeholders: 'Every placeholder in the world, by owner.',
};

export function SectionsBarReference() {
  const [mode, setMode] = useState<EditorMode>('advanced');
  const [tab, setTab] = useState('overview');
  const [open, setOpen] = useState(false);
  const groups = editorTabGroupsFor(mode === 'advanced');
  // Simple mode takes Placeholders away; the editor falls back to Overview, and so does the reference.
  const shownTab = groups.some((g) => g.tabs.some((t) => t.value === tab)) ? tab : 'overview';
  return (
    <Card role="region" aria-labelledby="sections-bar-title">
      <CardHeader>
        <CardTitle id="sections-bar-title" className="text-heading">Sections Bar</CardTitle>
        <CardDescription>
          The World Editor&apos;s own tab registry, drawn as the mobile Sections bar. Open the bar to see the
          tabs split into groups by lines, and pick one to close it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => { if (v) setMode(v as EditorMode); }}
          aria-label="Reference Mode"
          className="justify-start"
        >
          <ToggleGroupItem value="simple">Simple</ToggleGroupItem>
          <ToggleGroupItem value="advanced">Advanced</ToggleGroupItem>
        </ToggleGroup>
        <Tabs
          value={shownTab}
          onValueChange={setTab}
          orientation="vertical"
          activationMode="manual"
          className="max-w-sm overflow-hidden rounded-md border border-border"
        >
          <EditorSectionsBar groups={groups} value={shownTab} open={open} onOpenChange={setOpen} />
          {WORLD_EDITOR_TABS.map(({ value }) => (
            <TabsContent key={value} value={value} className="mt-0 p-4">
              <p className="text-body text-muted-foreground">{BODY[value]}</p>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
