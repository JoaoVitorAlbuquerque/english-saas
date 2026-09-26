import * as RadixPopover from '@radix-ui/react-popover';

import { cn } from '../../lib/cn';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverClose = RadixPopover.Close;

export function PopoverContent({
  className,
  sideOffset = 8,
  ...props
}: RadixPopover.PopoverContentProps) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 rounded-xl border border-line bg-surface p-4 shadow-lg focus:outline-none',
          className,
        )}
        {...props}
      />
    </RadixPopover.Portal>
  );
}
