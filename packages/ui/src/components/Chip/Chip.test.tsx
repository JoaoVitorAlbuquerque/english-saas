import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Chip } from './Chip';

describe('Chip', () => {
  it('reflete o estado selecionado em aria-pressed', () => {
    render(<Chip selected>Futebol</Chip>);

    expect(screen.getByRole('button', { name: 'Futebol' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
