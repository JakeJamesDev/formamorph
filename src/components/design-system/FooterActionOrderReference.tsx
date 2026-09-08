import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Meta } from '@/components/ui/typography';

const SAMPLE_ITEM = 'The Lantern Archive Beneath the Glass Observatory';

export function FooterActionOrderReference() {
  const [groupName, setGroupName] = useState('');
  const [createdGroup, setCreatedGroup] = useState<string>();
  const [deleted, setDeleted] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const trimmedGroupName = groupName.trim();

  return (
    <Card role="region" aria-labelledby="footer-action-order-title">
      <CardHeader>
        <CardTitle id="footer-action-order-title" className="text-heading">
          Footer Action Order
        </CardTitle>
        <CardDescription>
          These production dialogs keep cancellation before confirmation.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-3">
        <section className="grid content-start gap-3 rounded-md border border-border p-4">
          <div className="space-y-1">
            <h3 className="text-label font-semibold">Ordinary Acceptance</h3>
            <Meta>Create Group stays disabled until the sample has a name.</Meta>
          </div>

          <Dialog onOpenChange={(open) => { if (!open) setGroupName(''); }}>
            <DialogTrigger asChild>
              <Button variant="outline">Open Create Group Example</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Group</DialogTitle>
                <DialogDescription>
                  Create a local sample Group for {SAMPLE_ITEM}.
                </DialogDescription>
              </DialogHeader>
              <label className="grid gap-2 text-label" htmlFor="footer-reference-group-name">
                Group Name
                <Input
                  id="footer-reference-group-name"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  autoFocus
                />
              </label>
              <DialogFooter data-footer-example="ordinary">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    disabled={!trimmedGroupName}
                    onClick={() => setCreatedGroup(trimmedGroupName)}
                  >
                    Create Group
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <p className="text-helper text-muted-foreground" aria-live="polite">
            {createdGroup
              ? `Created the local group “${createdGroup}”.`
              : 'No sample group was created.'}
          </p>
        </section>

        <section className="grid content-start gap-3 rounded-md border border-border p-4">
          <div className="space-y-1">
            <h3 className="text-label font-semibold">Destructive Confirmation</h3>
            <Meta>Delete keeps its destructive treatment in the affirmative position.</Meta>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Open Delete Example</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Local Sample?</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete {SAMPLE_ITEM} from this isolated reference.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter data-footer-example="destructive">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: 'destructive' })}
                  onClick={() => setDeleted(true)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-helper text-muted-foreground" aria-live="polite">
              {deleted ? 'Deleted the local sample.' : 'The local sample is available.'}
            </p>
            {deleted && (
              <Button size="sm" variant="ghost" onClick={() => setDeleted(false)}>
                Restore Local Sample
              </Button>
            )}
          </div>
        </section>

        <section className="grid content-start gap-3 rounded-md border border-border p-4">
          <div className="space-y-1">
            <h3 className="text-label font-semibold">Long Action Labels</h3>
            <Meta>A constrained footer wraps before its actions can overflow.</Meta>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open Long Label Example</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export World</DialogTitle>
                <DialogDescription>
                  Choose whether to include the remote images in this local example.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter
                className="w-full max-w-72 justify-self-end sm:flex-wrap-reverse"
                data-footer-example="long-label"
              >
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={() => setEmbedded(true)}>
                    Download and Embed — Works Offline
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <p className="text-helper text-muted-foreground" aria-live="polite">
            {embedded ? 'Embedded the images in the local example.' : 'The local example keeps its image links.'}
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
