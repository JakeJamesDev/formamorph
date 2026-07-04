/** Patreon logo mark (current single-mark logo) as an inline SVG — lucide-react doesn't ship a Patreon
 *  icon. Mirrors the lucide icon API: pass `className` (e.g. "h-6 w-6") for sizing; fills with currentColor. */
const PatreonIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 512 512" fill="currentColor" className={className} aria-hidden="true">
    <path
      transform="matrix(.47407 0 0 .47407 .383 .422)"
      fillRule="nonzero"
      d="M1033.05 324.45c-.19-137.9-107.59-250.92-233.6-291.7-156.48-50.64-362.86-43.3-512.28 27.2-181.1 85.46-237.99 272.66-240.11 459.36-1.74 153.5 13.58 557.79 241.62 560.67 169.44 2.15 194.67-216.18 273.07-321.33 55.78-74.81 127.6-95.94 216.01-117.82 151.95-37.61 255.51-157.53 255.29-316.38z"
    />
  </svg>
);

export default PatreonIcon;
