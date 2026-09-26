import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';

describe('Input', () => {
  it('associa o label ao campo', () => {
    render(<Input label="E-mail" />);

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });

  it('marca aria-invalid e liga a mensagem de erro', () => {
    render(<Input label="Nome" error="Campo obrigatório." />);

    const input = screen.getByLabelText('Nome');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Campo obrigatório.')).toBeInTheDocument();
  });
});
