import type { Story } from '@ladle/react';

import { Chip } from './Chip';

export const Basic: Story = () => (
  <div className="flex flex-wrap gap-2">
    <Chip>História</Chip>
    <Chip selected>Futebol</Chip>
    <Chip>Tecnologia</Chip>
  </div>
);
