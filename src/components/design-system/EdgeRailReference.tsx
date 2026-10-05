import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Meta } from '@/components/ui/typography';
import type { EditorMode } from '@/lib/editorMode';
import { EdgeRail } from '@/components/editor/EdgeRail';
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

function Panels() {
  return WORLD_EDITOR_TABS.map(({ value }) => (
    <TabsContent key={value} value={value} className="mt-0 p-4">
      <p className="text-body text-muted-foreground">{BODY[value]}</p>
    </TabsContent>
  ));
}

export function EdgeRailReference() {
  const [mode, setMode] = useState<EditorMode>('advanced');
  const [railTab, setRailTab] = useState('overview');
  const [barTab, setBarTab] = useState('overview');
  const [barOpen, setBarOpen] = useState(false);
  const groups = editorTabGroupsFor(mode === 'advanced');
  // Simple mode takes Placeholders away; the editor falls back to Overview, and so does the reference.
  const shownTab = (tab: string) => (groups.some((g) => g.tabs.some((t) => t.value === tab)) ? tab : 'overview');
  const railShown = shownTab(railTab);
  const barShown = shownTab(barTab);
  return (
    <Card role="region" aria-labelledby="edge-rail-title">
      <CardHeader>
        <CardTitle id="edge-rail-title" className="text-heading">Edge Rail</CardTitle>
        <CardDescription>
          The World Editor&apos;s own tab registry, drawn as the desktop rail and as the mobile Sections bar. Point at
          an icon or focus it with the keyboard to see its label.
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
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section aria-labelledby="edge-rail-desktop" className="grid content-start gap-3">
            <div className="space-y-1">
              <h3 id="edge-rail-desktop" className="text-label font-semibold">Desktop Rail</h3>
              <Meta>Icons on the view&apos;s outer edge, grouped, with the active tab marked by the accent bar.</Meta>
            </div>
            <Tabs
              value={railShown}
              onValueChange={setRailTab}
              orientation="vertical"
              className="flex h-80 overflow-hidden rounded-md border border-border"
            >
              <EdgeRail groups={groups} value={railShown} label="Sample Editor Sections" />
              <div className="min-w-0 flex-1"><Panels /></div>
            </Tabs>
          </section>
          <section aria-labelledby="edge-rail-mobile" className="grid content-start gap-3">
            <div className="space-y-1">
              <h3 id="edge-rail-mobile" className="text-label font-semibold">Mobile Sections Bar</h3>
              <Meta>The same groups behind one bar that names the current tab.</Meta>
            </div>
            <Tabs
              value={barShown}
              onValueChange={setBarTab}
              orientation="vertical"
              activationMode="manual"
              className="max-w-sm overflow-hidden rounded-md border border-border"
            >
              <EditorSectionsBar groups={groups} value={barShown} open={barOpen} onOpenChange={setBarOpen} />
              <Panels />
            </Tabs>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
