import { useId, useRef, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompactSelectionRow } from '@/components/ui/compact-selection-row';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FieldError } from '@/components/ui/typography';
import type { LibraryGroup } from '@/lib/libraryOrganization';

/** The tile menu's chooser and named creation flow share one focus scope. */
export function LibraryGroupPicker({ name, groups, currentGroupId, initialPanel = 'picker', onSelect, onCreate, onClose, restoreFocus }: {
  name: string;
  groups: LibraryGroup[];
  currentGroupId?: string;
  initialPanel?: 'picker' | 'create';
  onSelect: (groupId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const [panel, setPanel] = useState(initialPanel);
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const trimmedName = groupName.trim();
  const duplicate = groups.some((group) => group.name.trim().toLowerCase() === trimmedName.toLowerCase());
  const error = duplicate ? 'A group has this name.' : submitted && !trimmedName ? 'Write a group name.' : undefined;
  const matches = groups.filter((group) => group.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="block max-h-[calc(var(--app-h,100dvh)-1rem)] w-[calc(100%-1rem)] max-w-lg overflow-hidden rounded-lg p-0"
        onOpenAutoFocus={(event) => { event.preventDefault(); input.current?.focus(); }}
        onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }}
      >
        <ScrollArea className="max-h-[calc(var(--app-h,100dvh)-1rem-2px)]">
        <div className="flex max-h-[calc(var(--app-h,100dvh)-1rem-2px)] flex-col gap-4 p-6">
        <DialogTitle className="shrink-0 pr-6">{panel === 'picker' ? 'Add To Group' : 'Create New Group'}</DialogTitle>
        <DialogDescription className="shrink-0 break-words [overflow-wrap:anywhere]">{name}</DialogDescription>
        {panel === 'picker' ? <>
          <Input ref={input} className="shrink-0" aria-label="Find a Group" placeholder="Find a Group" value={query} onChange={(event) => setQuery(event.target.value)} />
          <ScrollArea className="h-64 min-h-8 shrink rounded-md border border-border p-1" type="always">
            <div aria-label="Groups" role="group">
              {matches.map((group) => (
                <CompactSelectionRow key={group.id} selected={group.id === currentGroupId} onClick={() => {
                  if (group.id !== currentGroupId) onSelect(group.id);
                  onClose();
                }}>{group.name}</CompactSelectionRow>
              ))}
              {!matches.length && <p className="p-3 text-helper text-muted-foreground" role="status">{groups.length ? 'The search found no groups.' : 'There are no groups.'}</p>}
            </div>
          </ScrollArea>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" onClick={() => setPanel('create')}><FolderPlus className="mr-2 h-4 w-4" />Create New Group…</Button>
          </DialogFooter>
        </> : <form className="grid shrink-0 gap-4" onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (!trimmedName || duplicate) return;
          onCreate(trimmedName);
          onClose();
        }}>
          <label className="grid gap-2 text-label">Group Name
            <Input key="name" ref={input} autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value)} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
          </label>
          {error && <FieldError id={errorId} role="alert">{error}</FieldError>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!trimmedName || duplicate}>Create Group</Button>
          </DialogFooter>
        </form>}
        </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
