import { collectDiagnostics, formatDiagnostics } from './bugDiagnostics';
import { describeError } from './errorDetails';

/** The error and component stack as text a user can paste into a report. */
export function crashReportText(error: unknown, componentStack: string): string {
  const { message, details } = describeError(error, 'Formamorph stopped working.');
  const stack = componentStack.trim();
  return [message, details, stack && `Component stack:\n${stack}`, formatDiagnostics(collectDiagnostics())]
    .filter(Boolean)
    .join('\n\n');
}
