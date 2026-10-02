import type { Story } from '@ladle/react';

import { GroupedBarChart } from './GroupedBarChart';

export const PlanejadoVezesFeito: Story = () => (
  <div className="max-w-xl">
    <GroupedBarChart
      title="Planejado × feito"
      series={[
        { id: 'planned', label: 'Planejado', tone: 'muted', hatched: true },
        { id: 'done', label: 'Feito', tone: 'accent' },
      ]}
      categories={[
        { id: 'w1', label: '01/09', values: { planned: 120, done: 90 } },
        { id: 'w2', label: '08/09', values: { planned: 120, done: 135 } },
        { id: 'w3', label: '15/09', values: { planned: 120, done: 30 } },
        { id: 'w4', label: '22/09', values: { planned: 120, done: 0 } },
      ]}
      formatValue={(value) => `${String(value)} min`}
      rowHeader="Semana"
    />
  </div>
);
