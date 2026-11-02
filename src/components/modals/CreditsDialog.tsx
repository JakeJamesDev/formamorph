import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hint } from '@/components/ui/typography';
import { isDesktop } from '@/lib/imageGen/desktop';
import { ITEM_ICON_AUTHORS } from '@/lib/itemIcons';

const AUTHORS = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(ITEM_ICON_AUTHORS);

const LINK = 'text-primary hover:underline';
// Every credited name shares one style, so the icon authors are as prominent as the rest.
const NAME = 'text-body font-semibold';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>{children}</a>;
}

/** The credit the Main Menu footer opens. It holds its own text, so it works on every platform and offline. */
export function CreditsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="credits" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Credits</DialogTitle>
          <DialogDescription className="sr-only">The people and projects behind Formamorph.</DialogDescription>
        </DialogHeader>
        <Tabs surfaceTabs="credits" defaultValue="credits" className="w-full min-w-0">
          <TabsList>
            <TabsTrigger value="credits">Credits</TabsTrigger>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
