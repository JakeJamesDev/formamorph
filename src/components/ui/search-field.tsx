import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { FieldWithTrailing } from '@/components/ui/field-with-trailing';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SearchFieldSize = NonNullable<InputProps['size']>;

/** Icon, X, and padding per input height. The X's padding applies only while the X shows. */
const SIZES: Record<SearchFieldSize, { icon: string; iconAt: string; input: string; withClear: string; clear: string }> = {
  default: { icon: 'h-4 w-4', iconAt: 'left-3', input: 'pl-9', withClear: 'pr-9', clear: 'h-8 w-8' },
  sm: { icon: 'h-3.5 w-3.5', iconAt: 'left-2.5', input: 'pl-8', withClear: 'pr-7', clear: 'h-6 w-6' },
};

interface ClearSearchButtonProps extends Omit<ButtonProps, 'size' | 'children'> {
  size?: SearchFieldSize;
}

/** The X that empties a search box. Hosts with their own trailing cells place it innermost, after the text. */
export const ClearSearchButton = React.forwardRef<HTMLButtonElement, ClearSearchButtonProps>(
  ({ size = 'default', className, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Clear Search"
      className={cn(SIZES[size].clear, 'shrink-0 border-transparent text-muted-foreground hover:text-foreground', className)}
      {...props}
    >
      <X aria-hidden className={SIZES[size].icon} />
    </Button>
  ),
);
ClearSearchButton.displayName = 'ClearSearchButton';

export interface SearchFieldProps extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'className'> {
  value: string;
  onChange: (value: string) => void;
  /** Runs instead of `onChange('')` when the X is selected, for hosts that clear side state too. */
  onClear?: () => void;
  /** Classes for the wrapper, which carries the field's width and placement. */
  className?: string;
  inputClassName?: string;
}

/** A search box with a leading search icon and a Clear Search X that shows while it holds text. */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ value, onChange, onClear, onKeyDown, className, inputClassName, size: sizeProp, ...props }, ref) => {
    const inner = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inner.current!);
    const size = sizeProp ?? 'default';
    const sizes = SIZES[size];
    const clearable = value !== '';

    const clear = () => {
      if (onClear) onClear();
      else onChange('');
      inner.current?.focus();
    };

    return (
      <FieldWithTrailing className={className}>
        <Search
          aria-hidden
          className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground', sizes.icon, sizes.iconAt)}
        />
        <Input
          ref={inner}
          type="search"
          size={size}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            // Blocks Chromium's native Escape clear of a search input; host listeners still see the key.
            if (event.key === 'Escape') event.preventDefault();
          }}
          className={cn(
            sizes.input,
            clearable && sizes.withClear,
            'focus-visible:ring-0 [&::-webkit-search-cancel-button]:appearance-none',
            inputClassName,
          )}
          {...props}
        />
        {clearable && (
          <ClearSearchButton
            size={size}
            onClick={clear}
            className="absolute right-1 top-1/2 -translate-y-1/2"
          />
        )}
      </FieldWithTrailing>
    );
  },
);
SearchField.displayName = 'SearchField';
