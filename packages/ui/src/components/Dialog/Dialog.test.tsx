import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from '../Button/Button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './Dialog';

describe('Dialog', () => {
  it('abre o conteúdo ao acionar o gatilho', async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByText('Título')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(screen.getByText('Título')).toBeVisible();
  });
});
