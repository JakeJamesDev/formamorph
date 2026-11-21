import { forwardRef, useState, type CSSProperties, type HTMLAttributes, type ImgHTMLAttributes, type Ref } from 'react';
import { RemoteImg } from '@/lib/useRemoteImage';
import { isLayeredPicture, type LayeredPicture, type Picture } from '@/lib/layeredImages';
import { cn } from '@/lib/utils';

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

/** The canvas box that covers its container top-anchored, at `ratio` (width over height). */
const coverBox = (ratio: number): CSSProperties => ({
  left: '50%', top: 0, transform: 'translateX(-50%)',
  width: `max(100cqw, calc(100cqh * ${ratio}))`, height: `max(100cqh, calc(100cqw / ${ratio}))`,
});

/**
 * A resolved stack, each non-empty Layer stretched to the canvas (Q3) at its opacity. Unbounded, the unseen
 * canvas image sizes the box as a plain image would. Cropped, the caller's class sizes the box and the canvas
 * covers it, top-anchored.
 */
const LayeredImg = forwardRef<HTMLElement, ImgProps & { picture: LayeredPicture; crop?: boolean }>((
  { picture, crop, className, alt, loading, decoding, draggable, width: _width, height: _height, ...rest }, ref,
) => {
  const [ratio, setRatio] = useState<number>();
  const img = { loading, decoding, draggable, alt: '', 'aria-hidden': true } as const;
  const layers = picture.layers.map((shown) => shown.data && (
    <RemoteImg key={shown.id} {...img} src={shown.data} data-layer={shown.id} className="absolute inset-0 h-full w-full object-fill" style={{ opacity: shown.opacity }} />
  ));
  return (
    <span
      {...(rest as HTMLAttributes<HTMLSpanElement>)}
      ref={ref as Ref<HTMLSpanElement>}
      role="img"
      aria-label={alt}
      data-layered-picture={picture.entryId}
      className={crop ? cn('relative inline-block overflow-hidden [container-type:size]', className) : 'relative inline-flex max-h-full max-w-full shrink-0'}
    >
      {crop
        ? (
          <>
            <RemoteImg {...img} src={picture.canvas} className="hidden" onLoad={(e) => setRatio(e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1))} />
            <span className={cn('absolute', !ratio && 'inset-0')} style={ratio ? coverBox(ratio) : undefined}>{layers}</span>
          </>
        )
        : (
          <>
            <RemoteImg {...img} src={picture.canvas} className={cn(className, 'invisible')} />
            <span className="absolute inset-0">{layers}</span>
          </>
        )}
    </span>
  );
});
LayeredImg.displayName = 'LayeredImg';

/**
 * A picture where an `<img>` would go: one image's data as a plain image, or a Layered Image as its stack.
 * `className` sizes it as it would size the image.
 */
export const PictureImg = forwardRef<HTMLElement, ImgProps & {
  src: Picture;
  /** The caller's class fixes the box, as a top-anchored portrait thumbnail. */
  crop?: boolean;
}>(({ src, crop, ...props }, ref) => (isLayeredPicture(src)
  ? <LayeredImg ref={ref} picture={src} crop={crop} {...props} />
  : <RemoteImg ref={ref as Ref<HTMLImageElement>} src={src} {...props} />));
PictureImg.displayName = 'PictureImg';
