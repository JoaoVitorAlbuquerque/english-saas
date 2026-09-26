import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from '../Button/Button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './Tooltip';

describe('Tooltip', () => {
  it('mostra o conteúdo ao focar no gatilho', async () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Ajuda</Button>
          </TooltipTrigger>
          <TooltipContent>Dica de registro falado.</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    await userEvent.tab();

    expect(await screen.findByText('Dica de registro falado.')).toBeVisible();
  });
});
