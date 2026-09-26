import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from '../Button/Button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './Sheet';

describe('Sheet', () => {
  it('abre o conteúdo ao acionar o gatilho', async () => {
    render(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Abrir</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Opções</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByText('Opções')).toBeVisible();
  });
});
