import type { Story } from '@ladle/react';

import { Button } from '../Button/Button';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

export const Basic: Story = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost">Filtros</Button>
    </PopoverTrigger>
    <PopoverContent>Conteúdo do filtro aqui.</PopoverContent>
  </Popover>
);
