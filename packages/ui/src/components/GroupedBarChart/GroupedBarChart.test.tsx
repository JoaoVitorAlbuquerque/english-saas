import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GroupedBarChart } from './GroupedBarChart';

const SERIES = [
  { id: 'planned', label: 'Planejado', tone: 'muted' as const, hatched: true },
  { id: 'done', label: 'Feito', tone: 'accent' as const },
];

const CATEGORIES = [
  { id: 'w1', label: '08/09', values: { planned: 120, done: 90 } },
  { id: 'w2', label: '15/09', values: { planned: 120, done: 0 } },
];

const BAR = 'span.rounded-t-sm';

/** O desenho (sem a tabela alternativa, que repete os mesmos textos). */
function graphic() {
  return within(
    document.querySelector('figure > div[aria-hidden="true"]') as HTMLElement,
  );
}

function renderChart(categories = CATEGORIES) {
  return render(
    <GroupedBarChart
      title="Planejado × feito"
      series={SERIES}
      categories={categories}
      formatValue={(value) => `${String(value)} min`}
      rowHeader="Semana"
    />,
  );
}

describe('GroupedBarChart', () => {
  it('põe o número em cima de cada barra e o rótulo da categoria embaixo', () => {
    renderChart();

    expect(graphic().getAllByText('120')).toHaveLength(2);
    expect(graphic().getByText('90')).toBeInTheDocument();
    expect(graphic().getByText('08/09')).toBeInTheDocument();
    expect(graphic().getByText('15/09')).toBeInTheDocument();
  });

  it('a altura é proporcional ao teto redondo da escala', () => {
    const { container } = renderChart();
    const heights = [...container.querySelectorAll<HTMLElement>(BAR)].map(
      (bar) => Number.parseFloat(bar.style.height),
    );

    // O teto redondo de 120 é 200: planejado = 60% e feito = 45% da área útil.
    expect(heights[0]).toBeCloseTo(0.6 * 8, 5);
    expect(heights[1]).toBeCloseTo(0.45 * 8, 5);
    expect(heights[3]).toBe(0);
  });

  it('planejado vem listrado e feito, sólido — e a legenda mostra os dois', () => {
    const { container } = renderChart();
    const bars = container.querySelectorAll<HTMLElement>(BAR);

    expect(bars[0]?.style.backgroundImage).toContain(
      'repeating-linear-gradient',
    );
    expect(bars[1]?.style.backgroundImage).toBe('');
    const legend = within(screen.getByRole('list'));
    expect(legend.getByText('Planejado')).toBeInTheDocument();
    expect(legend.getByText('Feito')).toBeInTheDocument();
  });

  it('muitas semanas rolam dentro do gráfico, com largura mínima proporcional', () => {
    const many = Array.from({ length: 26 }, (_, index) => ({
      id: `w${String(index)}`,
      label: String(index + 1),
      values: { planned: 60, done: 30 },
    }));
    const { container } = renderChart(many);

    expect(container.querySelector('.overflow-x-auto')).not.toBeNull();
    expect(
      (container.querySelector('[style*="min-width"]') as HTMLElement).style
        .minWidth,
    ).toBe('91rem');
  });

  it('sem nenhum valor, mostra o texto de vazio', () => {
    renderChart([
      { id: 'w1', label: '08/09', values: { planned: 0, done: 0 } },
    ]);

    expect(graphic().getByText('Sem dados')).toBeInTheDocument();
  });

  it('a tabela traz os mesmos números, com a unidade', async () => {
    renderChart();

    await userEvent.click(screen.getByText('Ver como tabela'));
    const table = screen.getByRole('table', { name: 'Planejado × feito' });

    expect(within(table).getByText('90 min')).toBeInTheDocument();
    expect(within(table).getAllByText('120 min')).toHaveLength(2);
    expect(within(table).getByText('0 min')).toBeInTheDocument();
  });
});
