import * as RadixTabs from '@radix-ui/react-tabs';

import { cn } from '../../lib/cn';

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: RadixTabs.TabsListProps) {
  return (
    <RadixTabs.List
      className={cn('flex gap-1 border-b border-line', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: RadixTabs.TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'min-h-11 border-b-2 border-transparent px-3 text-sm font-medium text-muted transition-colors',
        'data-[state=active]:border-accent data-[state=active]:text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: RadixTabs.TabsContentProps) {
  return <RadixTabs.Content className={cn('py-4', className)} {...props} />;
}
