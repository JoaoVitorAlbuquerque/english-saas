import type { Story } from '@ladle/react';

import { Input } from './Input';

export const Basic: Story = () => (
  <div className="flex max-w-sm flex-col gap-4">
    <Input label="E-mail" placeholder="voce@exemplo.com" />
    <Input label="Senha" type="password" hint="Mínimo de 8 caracteres" />
    <Input label="Nome" error="Informe seu nome." defaultValue="" />
  </div>
);
