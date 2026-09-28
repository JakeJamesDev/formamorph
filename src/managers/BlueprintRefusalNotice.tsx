import { Fragment, type ReactNode } from 'react';
import { DropRefusalNotice } from '@/components/editor/DropRefusalNotice';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import type { BlueprintRefusal, BlueprintUse } from '@/lib/placeholderBlueprints';
import type { Placeholder } from '@/types';

const KIND_LABEL: Record<BlueprintUse['kind'], string> = {
  trait: 'Trait', blueprint: 'Blueprint', copy: 'Copy', entity: 'Entity', location: 'Location', stat: 'Stat',
  'stat-update': 'Stat Update', entry: 'Entry', overview: 'Overview', placeholder: 'Placeholder',
};

/** `A`, `A and B`, `A, B and C`. */
function joined(items: ReactNode[]): ReactNode {
  return items.map((item, i) => (
    <Fragment key={i}>
      {i === 0 ? '' : i === items.length - 1 ? ' and ' : ', '}
      {item}
    </Fragment>
  ));
}

/** The line after a move across the Blueprints edge was refused, naming what holds each placeholder on
 *  its side. `removing` words it for the group's own removal. */
export function BlueprintRefusalNotice({ refusal, removing = false, placeholders, onDismiss }: {
  refusal: BlueprintRefusal;
  removing?: boolean;
  placeholders: Placeholder[];
  onDismiss: () => void;
}) {
  const text = (t: string) => <PlaceholderText text={t} placeholders={placeholders} />;
  const bold = (t: string) => <strong>{text(t)}</strong>;
  const names = joined(refusal.names.map(bold));
  const uses = joined(refusal.uses.map((u) => <>{KIND_LABEL[u.kind]}: {text(u.name)}</>));
  const one = refusal.names.length === 1;
  if (refusal.reason === 'into') {
    return (
      <DropRefusalNotice onDismiss={onDismiss}>
        {names} {one ? 'stays' : 'stay'} out of Blueprints, because {uses} {refusal.uses.length === 1 ? 'uses' : 'use'}{' '}
        {one ? 'it' : 'them'}. A
        blueprint works only in trait text and blueprint values.
      </DropRefusalNotice>
    );
  }
  const subject = removing ? <strong>Blueprints</strong> : <>{names} {one ? 'stays' : 'stay'} in Blueprints</>;
  const it = removing ? 'its blueprints' : one ? 'it' : 'them';
  return (
    <DropRefusalNotice onDismiss={onDismiss}>
      {subject}{removing ? ' stays' : ''}, because{' '}
      {refusal.uses.length > 0 && <>{uses} {refusal.uses.length === 1 ? 'uses' : 'use'} {it}</>}
      {refusal.uses.length > 0 && refusal.reaches && ' and '}
      {refusal.reaches && <>{one ? 'its values use' : 'their values use'} {joined(refusal.reaches.map(bold))}</>}.
      {' '}Remove those uses first.
    </DropRefusalNotice>
  );
}
