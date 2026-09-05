import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AccountFormProps {
  /** Runs on submit; the form has already stopped the browser's own. */
  onSubmit: () => void;
  /** Shown above the button, empty for none. */
  error: string;
  /** Locks the button while the server is answering. */
  busy: boolean;
  submitLabel: string;
  busyLabel: string;
  /** The fields, in order. */
  children: ReactNode;
  /** The line under the panel that points at the other page. */
  footer: ReactNode;
}

/** The shape every account form takes: fields, then the refusal, then one full-width button. */
export function AccountForm({
  onSubmit, error, busy, submitLabel, busyLabel, children, footer,
}: AccountFormProps) {
  const handle = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <>
      <form onSubmit={handle} noValidate className="space-y-4">
        {children}
        {error && <p role="alert" className="text-helper text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
      </form>
      <p className="mt-4 text-helper text-muted-foreground">{footer}</p>
    </>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type?: 'text' | 'password' | 'email';
  autoComplete: string;
  autoFocus?: boolean;
  /** One line under the box, stating the rule before the reader can break it. */
  hint?: string;
  /** A suspended account is refused every write, so its boxes are shown but inert. */
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}

/** One labelled box, with its rule under it. */
export function Field({
  id, label, type = 'text', autoComplete, autoFocus, hint, disabled, value, onChange,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <p className="text-meta text-muted-foreground">{hint}</p>}
    </div>
  );
}
