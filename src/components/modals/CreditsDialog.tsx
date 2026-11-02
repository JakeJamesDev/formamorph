import { useState } from 'react';
import { SUPPORTERS_THANKS, SupportersWall } from '@/components/SupportersWall';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hint } from '@/components/ui/typography';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { useUserProfile } from '@/contexts/userProfileStore';
import { useDevRoute } from '@/lib/devRouter';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { isDesktop } from '@/lib/imageGen/desktop';
import { ITEM_ICON_AUTHORS } from '@/lib/itemIcons';
import { LicensesPanel, useNotices } from './LicensesPanel';

const AUTHORS = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(ITEM_ICON_AUTHORS);

const LINK = 'text-primary hover:underline';
// Every credited name shares one style, so the icon authors are as prominent as the rest.
const NAME = 'text-body font-semibold';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
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
    <Tabs surfaceTabs="credits" value={tab} onValueChange={selectTab} className="w-full min-w-0">
      <TabsList>
        <TabsTrigger value="credits">Credits</TabsTrigger>
        {showSupporters && <TabsTrigger value="supporters">Supporters</TabsTrigger>}
        <TabsTrigger value="licenses">Licenses</TabsTrigger>
      </TabsList>
      <TabsContent value="credits" className="space-y-4">
        <ul className="space-y-3">
          <li>
            <div className={NAME}>Jake James</div>
            <Hint>Made Formamorph.</Hint>
          </li>
          <li>
            <div className={NAME}>FieryLionite</div>
            <Hint>
              Made the original <ExternalLink href="https://github.com/FieryLionite/formamorph">Formamorph</ExternalLink>, which this game grew from.
            </Hint>
          </li>
          <li>
            <div className={NAME}>{AUTHORS}</div>
            <Hint>
              Item icons, from <ExternalLink href="https://game-icons.net">game-icons.net</ExternalLink>. Licensed under CC BY 3.0:{' '}
              <ExternalLink href="https://creativecommons.org/licenses/by/3.0/">creativecommons.org/licenses/by/3.0</ExternalLink>.
              {' '}The game draws them in your theme&apos;s colors.
            </Hint>
          </li>
          {isDesktop() && (
            <li>
              <div className={NAME}>llama.cpp</div>
              <Hint>The engine that runs local models.</Hint>
            </li>
          )}
        </ul>
      </TabsContent>
      {showSupporters && (
        <TabsContent value="supporters">
          <ScrollArea className="max-h-[60dvh]">
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
      <TabsContent value="licenses">
        <LicensesPanel {...notices} />
      </TabsContent>
    </Tabs>
  );
}

/** The credit the Main Menu footer opens. Only the Supporters tab needs a network. */
export function CreditsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="credits" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Credits</DialogTitle>
          <DialogDescription className="sr-only">The people and projects behind Formamorph.</DialogDescription>
        </DialogHeader>
        <CreditsTabs />
      </DialogContent>
    </Dialog>
  );
}
