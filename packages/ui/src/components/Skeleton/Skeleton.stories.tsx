import type { Story } from '@ladle/react';

import { Skeleton } from './Skeleton';

export const Basic: Story = () => (
  <div className="flex max-w-sm flex-col gap-2">
    <Skeleton className="h-5 w-2/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
);
