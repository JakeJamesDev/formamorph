import { useIsMobile } from '@/lib/useIsMobile';

/** The `Tabs` root props `SectionTabs` needs: the Sections bar wants a vertical list with manual activation. */
export function useSectionTabsRoot() {
  const isMobile = useIsMobile();
  return {
    isMobile,
    rootProps: {
      orientation: isMobile ? 'vertical' : 'horizontal',
      activationMode: isMobile ? 'manual' : 'automatic',
    } as const,
  };
}
