import type { Story } from '@ladle/react';

import { Button } from '../Button/Button';
import { Toaster } from './Toast';
import { toast } from './toast-store';

export const Basic: Story = () => (
  <div>
    <Button onClick={() => toast.success({ title: 'Lição concluída!' })}>
      Disparar toast
    </Button>
    <Toaster />
  </div>
);
