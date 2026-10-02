import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { BarChart, type BarChartItem } from './BarChart';

const SCALE = {
  min: 0,
  max: 5,
  ticks: [
    { value: 1, label: 'A1' },
    { value: 2, label: 'A2' },
    { value: 3, label: 'B1' },
    { value: 4, label: 'B2' },
    { value: 5, label: 'C1' },
  ],
};

const ITEMS: BarChartItem[] = [
  { id: 'g', label: 'Gramática', value: 3, valueLabel: 'B1' },
  {
    id: 'l',
    label: 'Escuta',
    value: 2,
    valueLabel: 'A2',
    note: 'Poucos dados',
    hatched: true,
  },
  { id: 's', label: 'Fala', value: null, valueLabel: '' },
];

const FILL = 'span.absolute.inset-y-0.left-0';

/** O desenho (sem a tabela alternativa, que repete os mesmos textos). */
function graphic() {
  return within(
    document.querySelector('figure > div[aria-hidden="true"]') as HTMLElement,
  );
}

function renderChart(items = ITEMS) {
  return render(
    <BarChart
      title="Nível por competência"
      items={items}
      scale={SCALE}
      rowHeader="Competência"
      valueHeader="Nível"
    />,
  );
}

describe('BarChart', () => {
  it('escreve o nome, o valor e a escala de cada barra', () => {
    renderChart();

    expect(graphic().getByText('Gramática')).toBeInTheDocument();
    expect(
      graphic().getByText('B1', { selector: 'span.font-mono.text-sm' }),
    ).toBeInTheDocument();
    for (const tick of ['A1', 'B2', 'C1']) {
      expect(graphic().getByText(tick)).toBeInTheDocument();
    }
  });

  it('a largura da barra segue a escala', () => {
    const { container } = renderChart();
    const fills = container.querySelectorAll<HTMLElement>(FILL);

    expect(fills[0]?.style.width).toBe('60%');
    expect(fills[1]?.style.width).toBe('40%');
  });

  it('estimativa frágil vem listrada, com o texto, e a legenda explica', () => {
    const { container } = renderChart();
    const fills = container.querySelectorAll<HTMLElement>(FILL);

    expect(fills[0]?.style.backgroundImage).toBe('');
    expect(fills[1]?.style.backgroundImage).toContain(
      'repeating-linear-gradient',
    );
    expect(screen.getAllByText('Poucos dados').length).toBeGreaterThan(0);
    expect(screen.getByText('Estimativa com poucos dados')).toBeInTheDocument();
  });

  it('valor null mostra "Sem dados ainda", não uma barra zerada', () => {
    const { container } = renderChart();

    expect(screen.getAllByText('Sem dados ainda').length).toBeGreaterThan(0);
    expect(container.querySelectorAll(FILL)).toHaveLength(2);
  });

  it('sem item listrado, a legenda de listrado nem aparece', () => {
    renderChart([ITEMS[0] as BarChartItem]);

    expect(
      screen.queryByText('Estimativa com poucos dados'),
    ).not.toBeInTheDocument();
  });

  it('a tabela traz os mesmos números', async () => {
    renderChart();

    await userEvent.click(screen.getByText('Ver como tabela'));
    const table = screen.getByRole('table', { name: 'Nível por competência' });

    expect(within(table).getByText('B1')).toBeInTheDocument();
    expect(within(table).getByText('A2 (Poucos dados)')).toBeInTheDocument();
    expect(within(table).getByText('Sem dados ainda')).toBeInTheDocument();
  });
});
