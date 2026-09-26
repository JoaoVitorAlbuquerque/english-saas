import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { dismissToast, getToasts, toast } from './toast-store';
import { Toaster } from './Toast';

afterEach(() => {
  getToasts().forEach((item) => dismissToast(item.id));
});

describe('Toaster', () => {
  it('mostra um toast disparado pela função toast()', () => {
    render(<Toaster />);

    act(() => {
      toast.success({ title: 'Lição concluída!' });
    });

    expect(screen.getByText('Lição concluída!')).toBeInTheDocument();
  });
});
