import type { Story } from '@ladle/react';

import { LineChart } from './LineChart';

const LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1'];

export const EvolucaoDoNivel: Story = () => (
  <div className="max-w-xl">
    <LineChart
      title="Seu nível, semana a semana"
      scale={{
        min: 0.5,
        max: 5.5,
        ticks: LEVELS.slice(1).map((label, index) => ({
          value: index + 1,
          label,
        })),
      }}
      formatY={(value) => LEVELS[value] ?? String(value)}
      referenceLine={{ value: 4, label: 'Meta: B2' }}
      series={[
        {
          id: 'overall',
          label: 'Nível geral',
          points: [
            { x: '01/09', y: null },
            { x: '08/09', y: 1 },
            { x: '15/09', y: 2 },
            { x: '22/09', y: 2 },
            { x: '29/09', y: 3 },
          ],
        },
      ]}
    />
  </div>
);
