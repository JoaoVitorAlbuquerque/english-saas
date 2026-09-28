import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SpokenStandardToggle } from './SpokenStandardToggle';

describe('SpokenStandardToggle', () => {
  it('começa mostrando a forma falada e alterna para a estrutura gramatical', async () => {
    render(
      <SpokenStandardToggle
        spoken="I'm gonna call you."
        standard="I am going to call you."
      />,
    );

    expect(screen.getByText("I'm gonna call you.")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Estrutura gramatical' }),
    );

    expect(screen.getByText('I am going to call you.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Estrutura gramatical' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
