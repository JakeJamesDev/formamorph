import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDevRoute } from '@/lib/devRouter';
import { MainMenuContextMenuReference } from './MainMenuContextMenuReference';
import { MenuDetailLineReference } from './MenuDetailLineReference';

/** The Context Menu tab's references; `subtab=detail-line` opens the second, `picker` and `create` the first. */
const CONTEXT_MENU_REFERENCE_VIEWS = [
  { value: 'library', label: 'Library Tile' },
  { value: 'detail-line', label: 'Item Detail Line' },
] as const;

type View = (typeof CONTEXT_MENU_REFERENCE_VIEWS)[number]['value'];

export function ContextMenuReferences() {
  const route = useDevRoute();
  const [view, setView] = useState<View>('library');
  useEffect(() => {
    if (route?.modal !== 'designSystem' || route.tab !== 'context-menu' || !route.subtab) return;
    setView(route.subtab === 'detail-line' ? 'detail-line' : 'library');
  }, [route]);

  return (
    <Tabs value={view} onValueChange={(next) => setView(next as View)} className="grid gap-4">
      <TabsList aria-label="Context Menu References" className="w-full sm:w-fit">
        {CONTEXT_MENU_REFERENCE_VIEWS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value} className="flex-1 sm:flex-none">{label}</TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="library"><MainMenuContextMenuReference /></TabsContent>
      <TabsContent value="detail-line"><MenuDetailLineReference /></TabsContent>
    </Tabs>
  );
}
