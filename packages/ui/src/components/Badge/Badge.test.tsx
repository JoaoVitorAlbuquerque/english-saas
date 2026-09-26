import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';

describe('Badge', () => {
  it('renderiza o texto passado', () => {
    render(<Badge>B1</Badge>);

    expect(screen.getByText('B1')).toBeInTheDocument();
  });
});
