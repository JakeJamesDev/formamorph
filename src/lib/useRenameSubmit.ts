import { useState } from 'react';
import AuthService from '@/services/AuthService';
import { USERNAME_RENAME_FAILED_MESSAGE, checkUsername } from '@/lib/usernameRule';
import { useMountedRef } from '@/lib/useMountedRef';
import type { AuthUser } from '@/types';

/**
 * The submit flow of the rename dialog and the rename page: rule check, busy state, rename call, error text.
 *
 * @param onRenamed - Runs with the adopted account after a successful rename
 */
export function useRenameSubmit(onRenamed: (user: AuthUser) => void) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useMountedRef();

  const submit = async (typed: string) => {
    const verdict = checkUsername(typed);
    if (!verdict.ok) {
      setError(verdict.error);
      return;
    }

    setError('');
    setBusy(true);
    try {
      onRenamed(await AuthService.renameUsername(verdict.username));
    } catch (failure: unknown) {
      if (!mounted.current) return;
      setError(failure instanceof Error && failure.message ? failure.message : USERNAME_RENAME_FAILED_MESSAGE);
      setBusy(false);
    }
  };

  return { error, clearError: () => setError(''), busy, submit };
}
