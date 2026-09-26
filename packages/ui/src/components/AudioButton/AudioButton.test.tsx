import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AudioButton } from './AudioButton';

describe('AudioButton', () => {
  it('começa pausado, com rótulo acessível', () => {
    render(<AudioButton src="/scene.mp3" label="Ouvir cena" />);

    const button = screen.getByRole('button', { name: 'Ouvir cena' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});
