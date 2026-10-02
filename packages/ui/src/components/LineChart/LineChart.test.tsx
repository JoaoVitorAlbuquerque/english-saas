import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';

import { LineChart, type LineChartSeries } from './LineChart';

const SCALE = {
  min: 0,
  max: 5,
  ticks: [
    { value: 1, label: 'A1' },
    { value: 2, label: 'A2' },
    { value: 3, label: 'B1' },
  ],
};
const LEVELS = ['', 'A1', 'A2', 'B1'];
const formatY = (value: number) => LEVELS[value] ?? String(value);

/** O desenho (sem a tabela alternativa, que repete os mesmos textos). */
function graphic() {
  return within(
    document.querySelector('figure > div[aria-hidden="true"]') as HTMLElement,
  );
}

const OVERALL: LineChartSeries = {
  id: 'overall',
  label: 'Nível geral',
  points: [
    { x: '01/09', y: null },
    { x: '08/09', y: 1 },
    { x: '15/09', y: 2 },
    { x: '22/09', y: 3 },
  ],
};

function renderChart(props: Partial<ComponentProps<typeof LineChart>> = {}) {
  return render(
    <LineChart
      title="Nível por semana"
      series={[OVERALL]}
      scale={SCALE}
      formatY={formatY}
      {...props}
    />,
  );
}

describe('LineChart', () => {
  it('escreve os rótulos dos dois eixos e o valor mais recente', () => {
    renderChart();

    expect(screen.getByText('A1', { selector: 'text' })).toBeInTheDocument();
    expect(screen.getByText('22/09', { selector: 'text' })).toBeInTheDocument();
    expect(
      screen.getByText('B1', { selector: 'text.font-semibold' }),
    ).toBeInTheDocument();
  });

  it('ponto null abre uma lacuna: a linha começa no primeiro valor', () => {
    const { container } = renderChart();
    const paths = container.querySelectorAll('path');

    expect(paths).toHaveLength(1);
    expect(paths[0]?.getAttribute('d')?.startsWith('M')).toBe(true);
    // 3 pontos com marcador: o null não ganha.
    expect(container.querySelectorAll('title')).toHaveLength(3);
  });

  it('lacuna no meio quebra a linha em dois trechos', () => {
    const { container } = renderChart({
      series: [
        {
          ...OVERALL,
          points: [
            { x: 'a', y: 1 },
            { x: 'b', y: null },
            { x: 'c', y: 3 },
          ],
        },
      ],
    });

    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('desenha a linha de referência (a meta) com o rótulo', () => {
    renderChart({ referenceLine: { value: 3, label: 'Meta: B1' } });

    expect(screen.getByText('Meta: B1')).toBeInTheDocument();
  });

  it('várias séries ganham marcadores de formas diferentes e legenda com o nome da forma', () => {
    const { container } = renderChart({
      series: [OVERALL, { ...OVERALL, id: 'g', label: 'Gramática' }],
    });

    expect(screen.getByText('Nível geral (círculo)')).toBeInTheDocument();
    expect(screen.getByText('Gramática (losango)')).toBeInTheDocument();
    expect(container.querySelector('circle')).not.toBeNull();
    expect(container.querySelector('polygon')).not.toBeNull();
  });

  it('sem nenhum valor, mostra o texto de vazio no lugar do gráfico', () => {
    const { container } = renderChart({
      series: [
        {
          ...OVERALL,
          points: OVERALL.points.map((point) => ({ ...point, y: null })),
        },
      ],
      emptyLabel: 'Ainda sem histórico',
    });

    expect(container.querySelector('svg')).toBeNull();
    expect(graphic().getByText('Ainda sem histórico')).toBeInTheDocument();
  });

  it('a tabela traz os mesmos números e "Sem dados" onde não há valor', async () => {
    renderChart();

    await userEvent.click(screen.getByText('Ver como tabela'));
    const table = screen.getByRole('table', { name: 'Nível por semana' });

    expect(within(table).getByText('Sem dados')).toBeInTheDocument();
    expect(within(table).getByText('A2')).toBeInTheDocument();
    expect(within(table).getByText('B1')).toBeInTheDocument();
  });
});
