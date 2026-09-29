import { Tip } from '@/components/ui/tooltip';

/** One muted chip in an AI Context request header: `label` in the settings' words, `tip` in the wire's. */
export function DebugChip({ label, tip }: { label: string; tip: string }) {
  return (
    <Tip tip={tip} labelsChild={false}>
      <span className="rounded bg-muted px-1.5 py-0.5 text-meta font-normal text-muted-foreground">{label}</span>
    </Tip>
  );
}
