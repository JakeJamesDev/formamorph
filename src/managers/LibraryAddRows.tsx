import { FileUp, Library } from 'lucide-react';
import { ListMenuRow } from '@/components/ListToolbar';

/** The host's two routes into a list that adds from outside the world: the library picker and a file. */
export interface LibraryAddRoutes {
  onAddFromLibrary: () => void;
  onImport: () => void;
}

/** The + menu rows that follow a list's own adds: a divider, Add From Library, then Import. */
export function LibraryAddRows({ noun, routes }: { noun: 'Entity' | 'Dictionary'; routes: LibraryAddRoutes }) {
  return (
    <>
      <div role="separator" className="-mx-1 my-1 h-hairline bg-border" />
      <ListMenuRow icon={<Library className="h-4 w-4" />} label="Add From Library…" onAdd={routes.onAddFromLibrary} />
      <ListMenuRow icon={<FileUp className="h-4 w-4" />} label={`Import ${noun}…`} onAdd={routes.onImport} />
    </>
  );
}
