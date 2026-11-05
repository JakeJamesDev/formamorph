import { useId } from 'react';

/** The icon set's Music note with a slash, cut clear of the note in the style of its other off icons. */
export function MusicOffIcon({ className }: { className?: string }) {
  const maskId = useId();
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none" />
        <path d="m3 3 18 18" stroke="black" strokeWidth={5} />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </g>
      <path d="m3 3 18 18" />
    </svg>
  );
}
