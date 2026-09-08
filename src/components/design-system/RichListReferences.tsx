import { useState } from 'react';
import { Save } from 'lucide-react';
import { SortableList, type SortableListItem } from '@/components/SortableList';
import { SaveList, type SaveListItem } from '@/components/modals/SaveList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditorSampleItem extends SortableListItem {
  kind: 'Character' | 'Location';
}

const EDITOR_ITEMS: EditorSampleItem[] = [
  { id: 'archivist', name: 'The Clockwork Archivist With a Deliberately Long Name', kind: 'Character' },
  { id: 'harbor', name: 'Moonwake Harbor', kind: 'Location' },
  { id: 'keeper', name: 'Keeper of the Third Lantern', kind: 'Character' },
  { id: 'observatory', name: 'The Old Observatory Above the Salt Marsh', kind: 'Location' },
  { id: 'courier', name: 'Brasswing Courier', kind: 'Character' },
  { id: 'market', name: 'Tidemark Night Market', kind: 'Location' },
  { id: 'cartographer', name: 'The Cartographer Without a Map', kind: 'Character' },
  { id: 'vault', name: 'Flooded Archive Vault', kind: 'Location' },
];

const SAVE_ITEMS: SaveListItem[] = [
  { id: 'dockside', name: 'A Dockside Promise', timestamp: Date.UTC(2026, 8, 6, 21, 14), gameTime: 3.4 },
  { id: 'autosave', name: 'Moonwake Harbor — Before the Storm Reaches the Western Breakwater', timestamp: Date.UTC(2026, 8, 6, 20, 42), gameTime: 3.1, isAutosave: true },
  { id: 'lantern', name: 'The Third Lantern', timestamp: Date.UTC(2026, 8, 5, 2, 8), gameTime: 2.6 },
  { id: 'marsh', name: 'Crossing the Salt Marsh', timestamp: Date.UTC(2026, 8, 4, 23, 51), gameTime: 2.2 },
  { id: 'ledger', name: 'The Keeper’s Ledger', timestamp: Date.UTC(2026, 8, 4, 22, 17), gameTime: 1.8 },
  { id: 'bell', name: 'When the Observatory Bell Rang', timestamp: Date.UTC(2026, 8, 3, 5, 33), gameTime: 1.4 },
  { id: 'key', name: 'A Brass Key in the Rain', timestamp: Date.UTC(2026, 8, 3, 4, 12), gameTime: 0.9 },
  { id: 'arrival', name: 'Arrival at Tidemark', timestamp: Date.UTC(2026, 8, 3, 3, 4), gameTime: 0.3 },
];

function WorldEditorListReference() {
  const [items, setItems] = useState(EDITOR_ITEMS);
  const [selectedId, setSelectedId] = useState<string | null>(EDITOR_ITEMS[0].id);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const remove = (id: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  const duplicate = (id: string) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index < 0) return current;
      const source = current[index];
      const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} Copy` };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  };

  const rename = (name: string) => {
    if (!selected) return;
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, name } : item));
  };

  return (
    <Card role="region" aria-labelledby="world-editor-list-title">
      <CardHeader>
        <CardTitle id="world-editor-list-title" className="text-heading">World Editor List</CardTitle>
        <CardDescription>Rich rows keep sorting, metadata, selection, and item actions.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)]">
        <ScrollArea type="always" className="h-64 rounded-md border p-1">
          <SortableList
            items={items}
            selectedId={selectedId}
            meta={(item) => ({ text: item.kind, title: `${item.kind} item` })}
            onSelect={setSelectedId}
            onRemove={remove}
            onDuplicate={duplicate}
            onReorder={setItems}
          />
        </ScrollArea>
        <div className="min-w-0 space-y-2 rounded-md border bg-muted/20 p-4">
          <Label htmlFor="reference-selected-name">Selected Name</Label>
          <Input
            id="reference-selected-name"
            aria-label="Selected Name"
            value={selected?.name ?? ''}
            onChange={(event) => rename(event.target.value)}
            disabled={!selected}
          />
          <p className="text-helper text-muted-foreground">
            {selected ? `Editing a ${selected.kind.toLowerCase()} sample.` : 'Select an item.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SaveLoadListReference() {
  const [rows, setRows] = useState(SAVE_ITEMS);
  const [saveName, setSaveName] = useState('New Tidemark Save');
  const [status, setStatus] = useState('Select a save to load it.');

  const save = () => {
    const name = saveName.trim();
    if (!name) return;
    setRows((current) => [{ id: crypto.randomUUID(), name, timestamp: Date.now(), gameTime: 3.5 }, ...current]);
    setStatus(`Saved “${name}”.`);
  };

  return (
    <Card role="region" aria-labelledby="save-load-list-title">
      <CardHeader>
        <CardTitle id="save-load-list-title" className="text-heading">Save and Load List</CardTitle>
        <CardDescription>Save rows keep timestamps, game time, ordering, and row actions.</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Save Name"
            value={saveName}
            onChange={(event) => setSaveName(event.target.value)}
            className="min-w-0 flex-1"
          />
          <Button onClick={save} disabled={!saveName.trim()} className="gap-2 sm:shrink-0">
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
        <ScrollArea type="always" className="h-64 rounded-md border">
          <div className="flex flex-col gap-2 p-1">
            <SaveList
              rows={rows}
              onPick={(row) => setStatus(`Loaded “${row.name}”.`)}
              onExport={(row) => setStatus(`Prepared “${row.name}” for export.`)}
              onDelete={(row) => {
                setRows((current) => current.filter((item) => item.id !== row.id));
                setStatus(`Deleted “${row.name}”.`);
              }}
              onReorder={setRows}
            />
          </div>
        </ScrollArea>
        <p aria-live="polite" className="text-helper text-muted-foreground">{status}</p>
      </CardContent>
    </Card>
  );
}

export function RichListReferences() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <WorldEditorListReference />
      <SaveLoadListReference />
    </div>
  );
}
