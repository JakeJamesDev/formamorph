import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarkdownPanel } from '@/components/MarkdownPanel';

/**
 * A titled dialog whose body is one `MarkdownPanel` — the shape shared by the world Readme and the help
 * pop-outs, sized to match the changelog popup. `footer` is each caller's own trailing control (Readme's
 * "Don't Show This Again", help's "Learn more" link); omit it for a body-only dialog.
 *
 * Pass `tabs` instead of `text` for a sectioned body: a tab bar over one MarkdownPanel per section
 * (the multi-tab help topics). When both are given, `tabs` wins. A tab's `extra` renders under its
 * markdown — the slot for a live control (e.g. the setting a section describes).
 */
export function MarkdownModal({ open, onOpenChange, title, text, tabs, footer }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text?: string;
  tabs?: { label: string; body: string; extra?: ReactNode }[];
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {tabs?.length ? (
          <Tabs defaultValue={tabs[0].label} className="min-h-0 flex flex-col">
            {/* Centered, not start-aligned: these bars wrap to 2+ rows on a phone, and a left-aligned
                ragged last row reads as broken. `self-center` centers the bar itself, `justify-center`
                centers the triggers within it (which is what tidies the wrapped row). */}
            <TabsList className="flex flex-wrap h-auto justify-center gap-1 self-center">
              {tabs.map((t) => (
                <TabsTrigger key={t.label} value={t.label} className="text-xs">{t.label}</TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((t) => (
              <TabsContent key={t.label} value={t.label} className="min-h-0 mt-2 flex flex-col gap-3">
                <MarkdownPanel text={t.body} className="max-h-[60dvh]" />
                {t.extra}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <MarkdownPanel text={text ?? ''} className="max-h-[70dvh]" />
        )}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
