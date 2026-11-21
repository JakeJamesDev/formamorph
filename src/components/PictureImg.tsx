import { forwardRef, useId, useState, type CSSProperties, type HTMLAttributes, type ImgHTMLAttributes, type Ref } from 'react';
import { RemoteImg } from '@/lib/useRemoteImage';
import { isLayeredPicture, tintChannels, type LayeredPicture, type Picture, type ResolvedLayer } from '@/lib/layeredImages';
import { cn } from '@/lib/utils';
import { thumbFit, type ThumbAspect } from '@/lib/thumbAspect';
import { useLayeredMotion, type LayerLook } from './useLayeredMotion';

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

/** The canvas box that covers its container at `ratio` (width over height), top-anchored or centered. */
const coverBox = (ratio: number, center?: boolean): CSSProperties => ({
  left: '50%', top: center ? '50%' : 0, transform: center ? 'translate(-50%, -50%)' : 'translateX(-50%)',
  width: `max(100cqw, calc(100cqh * ${ratio}))`, height: `max(100cqh, calc(100cqw / ${ratio}))`,
});

const BLEND_CSS = { normal: undefined, multiply: 'multiply', screen: 'screen', add: 'plus-lighter' } as const;

/** A filter that multiplies an image's color by `tint` in sRGB and leaves its alpha as it is. */
function TintFilter({ id, tint }: { id: string; tint: string }) {
  const [r, g, b] = tintChannels(tint);
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={`${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`} />
      </filter>
    </svg>
  );
}

/** One Layer: its image stretched to the canvas, tinted, then drawn at its opacity and blend mode over the Layers below. */
function LayerImg({ shown, looks, lookRef, img }: {
  shown: ResolvedLayer;
  looks: readonly LayerLook[];
  lookRef: (key: number) => (element: HTMLElement | null) => void;
  img: ImgProps;
}) {
  const filterId = useId();
  const fading = looks.length > 1;
  return (
    <span
      data-layer={shown.id}
      data-blend={shown.blend}
      data-tint={shown.tint}
      // While Variants cross-fade they add up to one whole, kept apart from the Layers below. A resting Layer paints plain.
      className={cn('absolute inset-0', fading && 'isolate')}
      style={{ opacity: shown.opacity, mixBlendMode: BLEND_CSS[shown.blend] }}
    >
      {shown.tint && <TintFilter id={filterId} tint={shown.tint} />}
      {looks.map((look) => (
        <span key={look.key} ref={lookRef(look.key)} data-layer-look="" className={cn('absolute inset-0', fading && 'mix-blend-plus-lighter')}>
          <RemoteImg
            {...img} src={look.data} className="absolute inset-0 h-full w-full object-fill"
            style={shown.tint ? { filter: `url(#${filterId})` } : undefined}
          />
        </span>
      ))}
    </span>
  );
}

/** The stack's Layers in the box a Jelly change squashes, from its bottom edge. */
function LayerStack({ picture, img }: { picture: LayeredPicture; img: ImgProps }) {
  const { looksOf, boxRef, lookRef } = useLayeredMotion(picture);
  return (
    <span ref={boxRef} data-layer-stack="" className="absolute inset-0 origin-bottom">
      {picture.layers.map((shown) => {
        const looks = looksOf(shown.id);
        return looks.length ? <LayerImg key={shown.id} shown={shown} looks={looks} lookRef={lookRef} img={img} /> : null;
      })}
    </span>
  );
}

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
  const layers = <LayerStack picture={picture} img={img} />;
  return (
    <span
      {...(rest as HTMLAttributes<HTMLSpanElement>)}
      ref={ref as Ref<HTMLSpanElement>}
      role="img"
      aria-label={alt}
      data-layered-picture={picture.entryId}
      className={crop ? cn('relative inline-block isolate overflow-hidden [container-type:size]', className) : 'relative isolate inline-flex max-h-full max-w-full shrink-0'}
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
            {layers}
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

/** A card or tile thumbnail: the picture covering its box, a portrait top-anchored as `thumbFit` sets it. */
export const ThumbPicture = forwardRef<HTMLElement, ImgProps & { src: Picture; aspect: ThumbAspect }>(({ src, aspect, className, ...props }, ref) => (
  <PictureImg ref={ref} src={src} crop center={aspect !== 'portrait'} className={cn(className, thumbFit(aspect))} {...props} />
));
ThumbPicture.displayName = 'ThumbPicture';
