import type { Story } from '@ladle/react';

import { BarChart } from './BarChart';

const SCALE = {
  min: 0,
  max: 5,
  ticks: ['A1', 'A2', 'B1', 'B2', 'C1'].map((label, index) => ({
    value: index + 1,
    label,
  })),
};

export const Competencias: Story = () => (
  <div className="max-w-xl">
    <BarChart
      title="Nível por competência"
      scale={SCALE}
      rowHeader="Competência"
      valueHeader="Nível"
      items={[
        { id: 'g', label: 'Gramática', value: 3, valueLabel: 'B1' },
        {
          id: 'l',
          label: 'Escuta',
          value: 2,
          valueLabel: 'A2',
          note: 'Poucos dados',
          hatched: true,
        },
        { id: 'r', label: 'Leitura', value: 4, valueLabel: 'B2' },
        { id: 's', label: 'Fala', value: null, valueLabel: '' },
      ]}
    />
  </div>
);
