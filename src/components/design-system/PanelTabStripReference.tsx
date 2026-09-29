import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PanelTabsList, type PanelTab } from '@/components/ui/panel-tabs';
import { Meta } from '@/components/ui/typography';
import { ENTITY_PANEL_TABS } from '@/views/entityPanelTabs';
import { LOCATION_PANEL_TABS } from '@/views/locationPanelTabs';
import { TRAIT_PANEL_TABS } from '@/views/traitPanelTabs';
import { DICTIONARY_PANEL_TABS } from '@/views/dictionaryPanelTabs';

/** What each tab's body says, so switching tabs shows a real change rather than an empty box. One map per
 *  registry: three panels share the value `details`, and each one holds different fields. */
const ENTITY_BODY: Record<string, string> = {
  profile: 'Identity, picture, and where the entity is found.',
  descriptions: 'The prose the player reads and the prose the model reads.',
  traits: 'The entity\'s own traits and groups, each one opening on the editor\'s Traits tab.',
  openings: 'The entity\'s openings, drawn when a player starts at one of its locations.',
  placeholders: 'The entity\'s own placeholder rows.',
};

const LOCATION_BODY: Record<string, string> = {
  details: 'Name, starting location, and the three descriptions.',
  presence: 'The entity roster and the connections list.',
  media: 'Background image, tags, and ambient sound.',
  pins: 'Placeholder pin rows and their conflict notes.',
  openings: 'The location\'s openings, drawn when a game starts at this location.',
};

const TRAIT_BODY: Record<string, string> = {
  details: 'Name and both descriptions.',
  availability: 'The trait\'s two switches and its requirements.',
  stats: 'Stat Changes and Stat Availability, with their conflict notes.',
  pins: 'Placeholder pin rows.',
};

const ENTRY_BODY: Record<string, string> = {
  details: 'Name, Trigger Keywords with their two switches, and the Value.',
  matching: 'Always inject, Regex, Recursive, Scan depth, and Secondary Keywords.',
};

function Strip({ tabs, stripLabel, body }: {
  tabs: readonly PanelTab[];
  stripLabel: string;
  body: Record<string, string>;
}) {
  const [tab, setTab] = useState(tabs[0].value);
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-3">
      <PanelTabsList tabs={tabs} stripLabel={stripLabel} />
      {tabs.map(({ value }) => (
        <TabsContent key={value} value={value}>
          <p className="text-body text-muted-foreground">{body[value]}</p>
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function PanelTabStripReference() {
  return (
    <Card role="region" aria-labelledby="panel-tab-strip-title">
      <CardHeader>
        <CardTitle id="panel-tab-strip-title" className="text-heading">
          Panel Tab Strip
        </CardTitle>
        <CardDescription>
          These are the production strips from the entity, location, trait, and dictionary entry panels,
          reading their own tab registries. Narrow the window to see the labels give way to their icons.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="panel-tab-strip-entity" className="grid content-start gap-3 rounded-md border border-border p-4">
          <div className="space-y-1">
            <h3 id="panel-tab-strip-entity" className="text-label font-semibold">Five Tabs</h3>
            <Meta>The entity panel, in Advanced mode, where each tab has the least room.</Meta>
          </div>
          <Strip tabs={ENTITY_PANEL_TABS} stripLabel="Sample Entity Fields" body={ENTITY_BODY} />
        </section>

        <section aria-labelledby="panel-tab-strip-location" className="grid content-start gap-3 rounded-md border border-border p-4">
          <div className="space-y-1">
            <h3 id="panel-tab-strip-location" className="text-label font-semibold">Five Tabs</h3>
            <Meta>The location panel, in Advanced mode.</Meta>
          </div>
          <Strip tabs={LOCATION_PANEL_TABS} stripLabel="Sample Location Fields" body={LOCATION_BODY} />
        </section>

        <section aria-labelledby="panel-tab-strip-trait" className="grid content-start gap-3 rounded-md border border-border p-4">
          <div className="space-y-1">
            <h3 id="panel-tab-strip-trait" className="text-label font-semibold">A Tab Name the Editor Also Uses</h3>
            <Meta>The trait panel, whose Stats tab shares a name with the editor&apos;s own.</Meta>
          </div>
          <Strip tabs={TRAIT_PANEL_TABS} stripLabel="Sample Trait Fields" body={TRAIT_BODY} />
        </section>

        <section aria-labelledby="panel-tab-strip-entry" className="grid content-start gap-3 rounded-md border border-border p-4">
          <div className="space-y-1">
            <h3 id="panel-tab-strip-entry" className="text-label font-semibold">Two Tabs, Two Hosts</h3>
            <Meta>
              The dictionary entry panel, in Advanced mode. It splits by cadence, not height, and the World
              Editor and the library&apos;s dictionary editor mount the same panel.
            </Meta>
          </div>
          <Strip tabs={DICTIONARY_PANEL_TABS} stripLabel="Sample Entry Fields" body={ENTRY_BODY} />
        </section>
      </CardContent>
    </Card>
  );
}
