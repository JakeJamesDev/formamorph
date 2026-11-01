import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Hint } from '@/components/ui/typography';
import { ITEM_ICON_AUTHORS } from '@/lib/itemIcons';

const AUTHORS = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(ITEM_ICON_AUTHORS);

/** The Main Menu footer's credit line. */
export const ICON_CREDIT_LINE = `Icons by ${AUTHORS}`;

const LINK = 'text-primary hover:underline';

/** The full credit the footer line opens. It holds its own text, so it works on every platform. */
export function IconCreditsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="iconCredits" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Icon Credits</DialogTitle>
          <DialogDescription>
            Icons made by {AUTHORS}. Available on{' '}
            <a href="https://game-icons.net" target="_blank" rel="noopener noreferrer" className={LINK}>game-icons.net</a>.
          </DialogDescription>
        </DialogHeader>
        <Hint>
          Licensed under CC BY 3.0:{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer" className={LINK}>creativecommons.org/licenses/by/3.0</a>.
          {' '}The game draws them in your theme&apos;s colors.
        </Hint>
      </DialogContent>
    </Dialog>
  );
}
