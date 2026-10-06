import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { NavRail } from '@/components/NavRail';
import { WORLD_EDITOR_TABS, editorTabGroupsFor } from '@/views/worldEditorTabs';

/** The reference's own key, so it never changes a real surface's choice. */
export const NAV_RAIL_REFERENCE_STORAGE_KEY = 'formamorph.designSystem.navRail';

/** What each tab's body says, so switching tabs shows a real change rather than an empty box. */
const BODY: Record<(typeof WORLD_EDITOR_TABS)[number]['value'], string> = {
  overview: 'The world\'s name, card, and AI-facing text.',
  stats: 'The stat list beside the selected stat\'s details.',
  entities: 'The entity tree beside the selected entity\'s details.',
  locations: 'The location tree or the canvas.',
  traits: 'The trait tree beside the selected trait\'s details.',
  dictionary: 'The dictionaries and their entries.',
  placeholders: 'Every placeholder in the world, by owner.',
};

function Option({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-label">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}

export function NavRailReference() {
  const [tab, setTab] = useState('overview');
  const [noRoom, setNoRoom] = useState(false);
  const [disabled, setDisabled] = useState(false);
  return (
    <Card role="region" aria-labelledby="nav-rail-title">
      <CardHeader>
        <CardTitle id="nav-rail-title" className="text-heading">Nav Rail</CardTitle>
        <CardDescription>
          The World Editor&apos;s own tab registry, drawn as the Nav Rail inside its card. Collapse it from the toggle
          at the bottom, then point at an icon or focus it with the keyboard to see its name.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Option id="nav-rail-no-room" label="No Room" checked={noRoom} onChange={setNoRoom} />
          <Option id="nav-rail-disabled" label="Disabled" checked={disabled} onChange={setDisabled} />
        </div>
        <Tabs
          value={tab}
          onValueChange={setTab}
          orientation="vertical"
          className="flex h-96 rounded-md border border-border"
        >
          <NavRail
            groups={editorTabGroupsFor(true)}
            value={tab}
            label="Sample Editor Sections"
            storageKey={NAV_RAIL_REFERENCE_STORAGE_KEY}
            autoCollapsed={noRoom}
            disabled={disabled}
          />
          <div className="min-w-0 flex-1">
            {WORLD_EDITOR_TABS.map(({ value }) => (
              <TabsContent key={value} value={value} className="mt-0 p-4">
                <p className="text-body text-muted-foreground">{BODY[value]}</p>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
