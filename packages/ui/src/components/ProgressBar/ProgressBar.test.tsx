import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('expõe o valor atual para leitores de tela', () => {
    render(<ProgressBar value={3} max={5} label="3 de 5" />);

    const bar = screen.getByRole('progressbar', { name: '3 de 5' });
    expect(bar).toHaveAttribute('aria-valuenow', '60');
  });
});
