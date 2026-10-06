import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The back control of a surface header: the World Editor and Community Creations, on every layout. */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="shrink-0 border-transparent" onClick={onClick} aria-label="Back">
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}
