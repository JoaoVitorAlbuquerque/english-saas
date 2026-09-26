import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from '../Button/Button';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

describe('Popover', () => {
  it('abre o conteúdo ao clicar no gatilho', async () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button>Abrir</Button>
        </PopoverTrigger>
        <PopoverContent>Conteúdo</PopoverContent>
      </Popover>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(await screen.findByText('Conteúdo')).toBeVisible();
  });
});
