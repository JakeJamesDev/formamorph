/** One stat change in a trait or Option list: "Gold: +100 (regen)". A starting change shows no type. */
export function StatChangeItem({ label, value, type }: { label: string; value: number; type?: string }) {
  return (
    <li>
      {label}:{' '}
      <span className={value > 0 ? 'text-success' : 'text-destructive'}>
        {value > 0 ? '+' : ''}{value}
      </span>
      {type && type !== 'starting' ? ` (${type})` : ''}
    </li>
  );
}
