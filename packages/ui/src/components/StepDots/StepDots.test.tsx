import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StepDots } from './StepDots';

describe('StepDots', () => {
  it('descreve a etapa atual para leitores de tela', () => {
    render(<StepDots total={5} current={2} />);

    expect(
      screen.getByRole('progressbar', { name: 'Etapa 3 de 5' }),
    ).toBeInTheDocument();
  });
});
