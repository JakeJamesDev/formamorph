import { forwardRef } from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';

/** A plain input that writes the world, so the world stack owns its Ctrl+Z (Q30). */
export const WorldInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <Input ref={ref} {...props} data-world-field />
));
WorldInput.displayName = 'WorldInput';

/** A plain textarea that writes the world, so the world stack owns its Ctrl+Z (Q30). */
export const WorldTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => (
  <Textarea ref={ref} {...props} data-world-field />
));
WorldTextarea.displayName = 'WorldTextarea';
