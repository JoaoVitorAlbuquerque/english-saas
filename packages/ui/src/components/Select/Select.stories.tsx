import type { Story } from '@ladle/react';

import { Select } from './Select';

export const Basic: Story = () => (
  <div className="max-w-sm">
    <Select
      label="Nível declarado"
      placeholder="Selecione"
      options={[
        { value: 'NONE', label: 'Nunca estudei inglês' },
        { value: 'BASIC', label: 'Sei o básico' },
        { value: 'INTERMEDIATE', label: 'Me viro em conversas' },
        { value: 'ADVANCED', label: 'Falo com facilidade' },
      ]}
    />
  </div>
);
