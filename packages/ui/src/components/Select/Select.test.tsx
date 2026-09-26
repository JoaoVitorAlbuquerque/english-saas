import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Select } from './Select';

describe('Select', () => {
  it('lista as opções recebidas', () => {
    render(
      <Select
        label="Nível"
        options={[
          { value: 'A1', label: 'A1' },
          { value: 'A2', label: 'A2' },
        ]}
      />,
    );

    const select = screen.getByLabelText('Nível');
    expect(select).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });
});
