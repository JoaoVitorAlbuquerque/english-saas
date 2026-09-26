import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CharacterAvatar } from './CharacterAvatar';

describe('CharacterAvatar', () => {
  it('mostra as iniciais quando não há imagem', () => {
    render(<CharacterAvatar name="Maya Silva" tone="maya" />);

    expect(screen.getByRole('img', { name: 'Maya Silva' })).toHaveTextContent(
      'MS',
    );
  });
});
