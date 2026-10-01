import { useRef } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';

/** The button that opens the file picker for image attachments. It spins while `attaching`. */
export function AttachImagesButton({ attaching, disabled, onFiles, variant, className }: {
  attaching: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  variant?: ButtonProps['variant'];
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="attach-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Cleared so picking the same file again still fires a change.
          e.target.value = '';
          onFiles(files);
        }}
      />
      <Tip tip="Attach images">
        <Button
          size="icon"
          variant={variant}
          className={className}
          aria-label="Attach images"
          disabled={disabled || attaching}
          onClick={() => input.current?.click()}
        >
          {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </Button>
      </Tip>
    </>
  );
}
