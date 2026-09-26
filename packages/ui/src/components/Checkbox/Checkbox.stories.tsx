import type { Story } from '@ladle/react';

import { Checkbox } from './Checkbox';

export const Basic: Story = () => (
  <div className="flex flex-col gap-3">
    <Checkbox label="Aceito os termos de uso" />
    <Checkbox label="Quero receber novidades" defaultChecked />
    <Checkbox
      label="Campo obrigatório"
      error="Você precisa aceitar para continuar."
    />
  </div>
);
