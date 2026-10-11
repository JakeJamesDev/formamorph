import { Fragment, type ReactNode } from 'react';

/** `A`, `A and B`, `A, B and C`. */
export function joinedList(items: readonly ReactNode[]): ReactNode {
  return items.map((item, i) => (
    <Fragment key={i}>
      {i === 0 ? '' : i === items.length - 1 ? ' and ' : ', '}
      {item}
    </Fragment>
  ));
}
