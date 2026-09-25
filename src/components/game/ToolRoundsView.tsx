import type { AiToolRound, AiToolRoundFailure } from '@/lib/aiRequest/toolLoop';
import { prettyToolText } from '@/lib/tools/prettyToolText';
import { HighlightedCode } from '@/components/prompt/HighlightedCode';

const FAILURE_LABELS: Record<AiToolRoundFailure, string> = {
  arguments: 'Bad Arguments',
  handler: 'Tool Error',
  script: 'Script Error',
  timeout: 'Timed Out',
  unknown: 'Unknown Tool',
  limit: 'Limit Reached',
};

const CODE_BOX = 'rounded-md border border-border bg-muted/40 p-2 text-meta';
const PART_TITLE = 'text-helper text-muted-foreground';

/** Tool text, highlighted when it is JSON. */
function ToolText({ text, testId }: { text: string; testId: string }) {
  const { code, json } = prettyToolText(text);
  return json
    ? <div data-testid={testId}><HighlightedCode code={code} language="json" className={CODE_BOX} /></div>
    : <pre data-testid={testId} className={`whitespace-pre-wrap break-words font-mono ${CODE_BOX}`}>{code}</pre>;
}

/** The tool rounds one request ran before its reply, as the AI Context viewer shows them. */
export function ToolRoundsView({ rounds }: { rounds: readonly AiToolRound[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rounds.map((round) => (
        <div key={round.index} role="group" aria-label={`Tool Round ${round.index}`} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <h5 className="text-label font-semibold">Tool Round {round.index}</h5>
          {round.reasoning.trim() && (
            <div>
              <p className={PART_TITLE}>Reasoning</p>
              <p className="whitespace-pre-wrap break-words text-label">{round.reasoning}</p>
            </div>
          )}
          {round.content.trim() && (
            <div>
              <p className={PART_TITLE}>Content</p>
              <p className="whitespace-pre-wrap break-words text-label">{round.content}</p>
            </div>
          )}
          {round.calls.map((call) => (
            <div key={call.id} className="flex flex-col gap-1 min-w-0">
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-label">{call.name}</span>
                {call.failure && (
                  <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-meta text-destructive">{FAILURE_LABELS[call.failure]}</span>
                )}
              </p>
              <p className={PART_TITLE}>Arguments</p>
              <ToolText text={call.arguments} testId="tool-call-arguments" />
              <p className={PART_TITLE}>Result</p>
              <ToolText text={call.result} testId="tool-call-result" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
