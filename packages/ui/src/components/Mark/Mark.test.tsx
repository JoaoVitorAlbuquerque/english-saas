import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Mark } from './Mark';

describe('Mark', () => {
  it('descreve o tipo de destaque para leitores de tela', () => {
    render(<Mark kind="CHUNK">catch you later</Mark>);

    expect(
      screen.getByLabelText('expressão: catch you later'),
    ).toBeInTheDocument();
  });
});
