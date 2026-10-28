import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ImgHTMLAttributes, type Ref } from 'react';
import type { MascotImageElement, MascotImageSource } from './useMascotImageSources';

/** A copy of an unscrambled layer on its own canvas, so one layer can draw in many places at once. */
const LayerCopy = forwardRef<HTMLCanvasElement, { source: HTMLCanvasElement; className?: string }>(({ source, className }, ref) => {
  const own = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => own.current as HTMLCanvasElement);
  useLayoutEffect(() => {
    const canvas = own.current;
    if (!canvas) return;
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext('2d')?.drawImage(source, 0, 0);
  }, [source]);
  return <canvas ref={own} aria-hidden data-fq-layer="supporter" className={className} />;
});
LayerCopy.displayName = 'LayerCopy';

/** One rig image as its source draws it. A layer has its size once drawn, so `onLoad` is the image's alone. */
export const MascotImage = forwardRef<MascotImageElement, { source: MascotImageSource } & Pick<ImgHTMLAttributes<HTMLImageElement>, 'className' | 'onLoad'>>(
  ({ source, className, onLoad }, ref) => (source.kind === 'canvas'
    ? <LayerCopy ref={ref as Ref<HTMLCanvasElement>} source={source.canvas} className={className} />
    : <img ref={ref as Ref<HTMLImageElement>} src={source.url} alt="" draggable={false} onLoad={onLoad} className={className} />),
);
MascotImage.displayName = 'MascotImage';
