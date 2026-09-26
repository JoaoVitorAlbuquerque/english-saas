import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { forwardRef, useId } from 'react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export type CheckboxProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label: ReactNode;
  error?: string;
  name?: string;
  id?: string;
};

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox(
    {
      label,
      error,
      id,
      className,
      ...props
    }: CheckboxProps & { className?: string },
    ref,
  ) {
    const generatedId = useId();
    const checkboxId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={checkboxId}
          className="flex min-h-11 cursor-pointer items-center gap-2.5 text-base text-ink"
        >
          <RadixCheckbox.Root
            ref={ref}
            id={checkboxId}
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded border border-line bg-surface',
              'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
              className,
            )}
            {...props}
          >
            <RadixCheckbox.Indicator>
              <Check className="size-3.5 text-white" aria-hidden="true" />
            </RadixCheckbox.Indicator>
          </RadixCheckbox.Root>
          {label}
        </label>
        {error ? <p className="text-sm text-error">{error}</p> : null}
      </div>
    );
  },
);
