import type { Story } from '@ladle/react';

import { Button, type ButtonProps } from './Button';

export const Variants: Story = () => (
  <div className="flex flex-wrap gap-3">
    <Button variant="primary">Primário</Button>
    <Button variant="ghost">Fantasma</Button>
    <Button variant="danger">Perigo</Button>
    <Button variant="primary" isLoading>
      Carregando
    </Button>
    <Button variant="primary" disabled>
      Desabilitado
    </Button>
  </div>
);

export const Playground: Story<ButtonProps> = (props) => (
  <Button {...props}>Continuar</Button>
);

Playground.args = {
  variant: 'primary',
  size: 'md',
  isLoading: false,
};
Playground.argTypes = {
  variant: {
    options: ['primary', 'ghost', 'danger'],
    control: { type: 'select' },
  },
  size: { options: ['sm', 'md'], control: { type: 'select' } },
};
