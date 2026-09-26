import * as RadixTooltip from '@radix-ui/react-tooltip';

import { cn } from '../../lib/cn';

export const TooltipProvider = RadixTooltip.Provider;
export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: RadixTooltip.TooltipContentProps) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-xs rounded-lg bg-ink px-3 py-1.5 text-sm text-surface shadow-lg',
          className,
        )}
        {...props}
      />
    </RadixTooltip.Portal>
  );
}
