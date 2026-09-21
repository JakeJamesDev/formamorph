import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LibraryAuthorField({ value, onChange }: { value?: string; onChange: (author: string) => void }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Author</Label>
      <Input id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
