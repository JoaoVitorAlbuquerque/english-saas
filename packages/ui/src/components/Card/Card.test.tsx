import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from './Card';

describe('Card', () => {
  it('renderiza o conteúdo passado', () => {
    render(<Card>Conteúdo</Card>);

    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });
});
