import { cn } from '@/lib/utils';
import { prettyToolText } from '@/lib/tools/prettyToolText';
import { HighlightedCode } from './HighlightedCode';

/** The box Tool text reads in: a Try It result, a schema, a tool round's arguments and result. */
export const TOOL_TEXT_BOX = 'rounded-md border bg-muted/40 p-2 text-meta';

/** Text a Tool takes or returns, indented and highlighted when it is JSON and shown as sent when not. */
export function ToolText({ text, className, testId }: { text: string; className?: string; testId?: string }) {
  const { code, json } = prettyToolText(text);
  return json
    ? <div data-testid={testId}><HighlightedCode code={code} language="json" className={cn(TOOL_TEXT_BOX, className)} /></div>
    : <pre data-testid={testId} className={cn('whitespace-pre-wrap break-words font-mono', TOOL_TEXT_BOX, className)}>{code}</pre>;
}
