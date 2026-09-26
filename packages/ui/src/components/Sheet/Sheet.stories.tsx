import type { Story } from '@ladle/react';

import { Button } from '../Button/Button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './Sheet';

export const Basic: Story = () => (
  <Sheet>
    <SheetTrigger asChild>
      <Button>Abrir painel</Button>
    </SheetTrigger>
    <SheetContent>
      <SheetTitle className="font-display text-lg text-ink">
        Escolha uma opção
      </SheetTitle>
    </SheetContent>
  </Sheet>
);
