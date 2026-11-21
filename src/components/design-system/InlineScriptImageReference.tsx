import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hint, Meta } from '@/components/ui/typography';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { ScriptImage } from '@/components/game/ScriptImage';
import { SHOW_SIZES, SHOW_WRAPS, type ShowSize, type ShowWrap } from '@/lib/scriptPrompts';
import type { MediaFileEntry } from '@/types';

const ART: MediaFileEntry = {
  id: 'reference-lamp',
  name: 'Lamp on the sill',
  kind: 'image',
  data: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#33507a"/><circle cx="232" cy="82" r="34" fill="#f4e3b1"/><path d="M0 164h320v76H0z" fill="#1f2f48"/><path d="M142 164V76l18-22 18 22v88z" fill="#1d2433"/></svg>',
  )}`,
};

const TEXT = `The keeper sets the lamp on the sill and turns to you. "You came by the marsh road," she says. "Nobody takes the marsh road after dark." Below the window, the tide pulls at the eastern stair. Gulls wheel over the pier, and the boards groan under the swell. A bell rings once from the far shore, and neither of you moves.`;

/** Every wrap and size of a During AI Output image, in the narration column. */
export function InlineScriptImageReference() {
  return (
    <Card role="region" aria-labelledby="inline-script-image-title">
      <CardHeader>
        <CardTitle id="inline-script-image-title" className="text-heading">Inline Script Image</CardTitle>
        <CardDescription>
          A During AI Output image sits in the narration after its sentence. Small, medium and large take a third,
          three fifths and all of the column.
        </CardDescription>
        <Hint as="ul" className="list-disc space-y-1 pl-5">
          <li>Left and right images float and the text wraps them. A large image is always a block.</li>
          <li>Below the mobile breakpoint, every float becomes a centered block.</li>
        </Hint>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {SHOW_WRAPS.flatMap((wrap) => SHOW_SIZES.map((size) => ({ wrap, size }))).map(({ wrap, size }) => (
          <Variant key={`${wrap}-${size}`} wrap={wrap} size={size} />
        ))}
      </CardContent>
    </Card>
  );
}

function Variant({ wrap, size }: { wrap: ShowWrap; size: ShowSize }) {
  return (
    <section className="space-y-2" aria-label={`${wrap}, ${size}`}>
      <Meta>{`${wrap}, ${size}`}</Meta>
      <div className="flow-root rounded-lg border border-border p-3">
        <ScriptImage entry={ART} size={size} wrap={wrap} className="my-3" />
        <MarkdownRenderer text={TEXT} dialogue />
      </div>
    </section>
  );
}
