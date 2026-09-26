import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('associa o label ao campo', () => {
    render(<Textarea label="Redação" />);

    expect(screen.getByLabelText('Redação')).toBeInTheDocument();
  });
});
