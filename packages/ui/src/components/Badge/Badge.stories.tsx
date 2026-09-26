import type { Story } from '@ladle/react';

import { Badge } from './Badge';

export const Tones: Story = () => (
  <div className="flex flex-wrap gap-2">
    <Badge tone="accent">B1</Badge>
    <Badge tone="ok">Aprovado</Badge>
    <Badge tone="error">Bloqueador</Badge>
    <Badge tone="muted">Rascunho</Badge>
  </div>
);
