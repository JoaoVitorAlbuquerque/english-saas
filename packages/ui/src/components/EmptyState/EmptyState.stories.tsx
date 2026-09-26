import type { Story } from '@ladle/react';

import { Button } from '../Button/Button';
import { EmptyState } from './EmptyState';

export const Basic: Story = () => (
  <EmptyState
    title="Nada por aqui ainda"
    description="Quando você tiver revisões pendentes, elas aparecem nesta tela."
    action={<Button variant="ghost">Ver catálogo</Button>}
  />
);
