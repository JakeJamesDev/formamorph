import { useState, type ReactNode } from 'react';
import { Award, Heart, Scale } from 'lucide-react';
import { SUPPORTERS_THANKS, SupportersWall } from '@/components/SupportersWall';
import { CollapsingTabsList } from '@/components/ui/collapsing-tabs-list';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Hint } from '@/components/ui/typography';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { useUserProfile } from '@/contexts/userProfileStore';
import { useDevRoute } from '@/lib/devRouter';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { isDesktop } from '@/lib/imageGen/desktop';
import { ITEM_ICON_AUTHORS } from '@/lib/itemIcons';
import { LicensesPanel, useNotices } from './LicensesPanel';

const AUTHORS = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(ITEM_ICON_AUTHORS);

const TABS = [
  { value: 'credits', label: 'Credits', icon: Award },
  { value: 'supporters', label: 'Supporters', icon: Heart },
  { value: 'licenses', label: 'Licenses', icon: Scale },
];

const LINK = 'text-primary hover:underline';
// Every credited name shares one style, so the icon authors are as prominent as the rest.
const NAME = 'text-body font-semibold';

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>{children}</a>;
}

// DEV: `fixture=supporters` serves a canned wall.
const loadDevSupporters = import.meta.env.DEV
  ? () => import('@/lib/devSupportersSample').then((sample) => sample.DEV_SUPPORTERS)
  : undefined;

/** The tab strip. It mounts with the dialog's content, so every open starts on Credits. */
function CreditsTabs() {
  const { attested } = useAgeGate();
  const { openProfile } = useUserProfile();
  const devRoute = useDevRoute();
  const devSupporters = import.meta.env.DEV && devRoute?.modal === 'credits' && devRoute.tab === 'supporters';
  const devLicenses = import.meta.env.DEV && devRoute?.modal === 'credits' && devRoute.tab === 'licenses';
  const [tab, setTab] = useState(devSupporters ? 'supporters' : devLicenses ? 'licenses' : 'credits');

  // The notices file is read the first time the Licenses tab opens, then kept for this open.
  const [licensesOpened, setLicensesOpened] = useState(devLicenses);
  const notices = useNotices(licensesOpened);
  const selectTab = (next: string) => {
    if (next === 'licenses') setLicensesOpened(true);
    setTab(next);
  };

  // `attested` is always true with community off, so both checks are needed.
  const showSupporters = COMMUNITY_ENABLED && attested;
  if (tab === 'supporters' && !showSupporters) setTab('credits');

  return (
    <Tabs surfaceTabs="credits" value={tab} onValueChange={selectTab} className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      {/* A row, because `hug` sizes the strip by its flex basis. */}
      <div className="flex justify-center sm:justify-start">
        <CollapsingTabsList
          hug
          tabs={showSupporters ? TABS : TABS.filter((option) => option.value !== 'supporters')}
          value={tab}
          aria-label="Credits Sections"
        />
      </div>
      <TabsContent value="credits" className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <ul className="space-y-3">
            <li>
              <div className={NAME}>Jake James</div>
              <Hint>Creator of Formamorph</Hint>
            </li>
            <li>
              <div className={NAME}>FieryLionite</div>
              <Hint>
                Creator of the original <ExternalLink href="https://github.com/FieryLionite/formamorph">Formamorph</ExternalLink>, the base of this game
              </Hint>
            </li>
            <li>
              <div className={NAME}>{AUTHORS}</div>
              <Hint>
                Item icons, from <ExternalLink href="https://game-icons.net">game-icons.net</ExternalLink>. Licensed under CC BY 3.0:{' '}
                <ExternalLink href="https://creativecommons.org/licenses/by/3.0/">creativecommons.org/licenses/by/3.0</ExternalLink>.
                {' '}Your theme sets their colors.
              </Hint>
            </li>
            {isDesktop() && (
              <li>
                <div className={NAME}>llama.cpp</div>
                <Hint>Runs local models</Hint>
              </li>
            )}
          </ul>
        </ScrollArea>
      </TabsContent>
      {showSupporters && (
        <TabsContent value="supporters" className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              <Hint>{SUPPORTERS_THANKS}</Hint>
              <SupportersWall
                load={devSupporters && devRoute?.fixture === 'supporters' ? loadDevSupporters : undefined}
                renderName={(supporter, className) => (
                  <button
                    type="button"
                    className={className}
                    onClick={() => openProfile(supporter.id, supporter.username)}
                  >
                    {supporter.username}
                  </button>
                )}
              />
            </div>
          </ScrollArea>
        </TabsContent>
      )}
      <TabsContent value="licenses" className="min-h-0 flex-1">
        <LicensesPanel {...notices} />
      </TabsContent>
    </Tabs>
  );
}

/** The credit the Main Menu footer opens. Only the Supporters tab needs a network. */
export function CreditsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="credits" className="flex h-[720px] max-h-[85dvh] flex-col sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Credits</DialogTitle>
          <DialogDescription className="sr-only">The people and projects behind Formamorph.</DialogDescription>
        </DialogHeader>
        <CreditsTabs />
      </DialogContent>
    </Dialog>
  );
}
