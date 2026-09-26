import type { Story } from '@ladle/react';

import { Textarea } from './Textarea';

export const Basic: Story = () => (
  <div className="max-w-sm">
    <Textarea label="Redação" hint="Escreva pelo menos 3 frases." />
  </div>
);
