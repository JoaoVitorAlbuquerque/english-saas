import type { Story } from '@ladle/react';

import { Button } from '../Button/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './Dialog';

export const Basic: Story = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button>Abrir diálogo</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogTitle className="font-display text-lg text-ink">
        Assinatura necessária
      </DialogTitle>
      <DialogDescription className="mt-2 text-sm text-muted">
        Esse recurso é exclusivo do plano Plus.
      </DialogDescription>
    </DialogContent>
  </Dialog>
);
