import type { Story } from '@ladle/react';

import { Button } from '../Button/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './Tooltip';

export const Basic: Story = () => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost">Passe o mouse</Button>
      </TooltipTrigger>
      <TooltipContent>
        Registro falado: "gonna" em vez de "going to".
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
