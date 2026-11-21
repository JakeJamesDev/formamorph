import { forwardRef, useState, type CSSProperties, type HTMLAttributes, type ImgHTMLAttributes, type Ref } from 'react';
import { RemoteImg } from '@/lib/useRemoteImage';
import { isLayeredPicture, type LayeredPicture, type Picture } from '@/lib/layeredImages';
import { cn } from '@/lib/utils';

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

/** The canvas box that covers its container at `ratio` (width over height), top-anchored or centered. */
const coverBox = (ratio: number, center?: boolean): CSSProperties => ({
  left: '50%', top: center ? '50%' : 0, transform: center ? 'translate(-50%, -50%)' : 'translateX(-50%)',
  width: `max(100cqw, calc(100cqh * ${ratio}))`, height: `max(100cqh, calc(100cqw / ${ratio}))`,
});

/**
 * A resolved stack, each non-empty Layer stretched to the canvas (Q3) at its opacity. Unbounded, the unseen
 * canvas image sizes the box as a plain image would. Cropped, the caller's class sizes the box and the canvas
 * covers it, top-anchored or centered. `onLoad` and `onError` report the canvas image.
 */
const LayeredImg = forwardRef<HTMLElement, ImgProps & { picture: LayeredPicture; crop?: boolean; center?: boolean }>((
  { picture, crop, center, className, alt, loading, decoding, draggable, width: _width, height: _height, onLoad, onError, ...rest }, ref,
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
            <RemoteImg
              {...img} src={picture.canvas} className="hidden" onError={onError}
              onLoad={(e) => { setRatio(e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1)); onLoad?.(e); }}
            />
            <span className={cn('absolute', !ratio && 'inset-0')} style={ratio ? coverBox(ratio, center) : undefined}>{layers}</span>
          </>
        )
        : (
          <>
            <RemoteImg {...img} src={picture.canvas} className={cn(className, 'invisible')} onLoad={onLoad} onError={onError} />
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
  /** With `crop`, center the canvas in the box rather than anchoring its top. */
  center?: boolean;
}>(({ src, crop, center, ...props }, ref) => (isLayeredPicture(src)
  ? <LayeredImg ref={ref} picture={src} crop={crop} center={center} {...props} />
  : <RemoteImg ref={ref as Ref<HTMLImageElement>} src={src} {...props} />));
PictureImg.displayName = 'PictureImg';
