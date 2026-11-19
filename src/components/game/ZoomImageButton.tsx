import { useState, type CSSProperties, type ReactNode } from 'react';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import { cn } from '@/lib/utils';

/** An image that opens full size on click. `children` draws the image inside the button. */
export function ZoomImageButton({ src, alt, className, style, children }: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Zoom image"
        className={cn('block cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', className)}
        style={style}
        onClick={() => setZoom(true)}
      >
        {children}
      </button>
      <ImageZoomViewer src={src} alt={alt} open={zoom} onOpenChange={setZoom} />
    </>
  );
}
