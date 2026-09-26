import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('alterna o estado ao clicar no label', async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Aceito" onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByText('Aceito'));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
