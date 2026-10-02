import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ChartFigure } from './ChartFigure';

describe('ChartFigure', () => {
  function renderFigure() {
    return render(
      <ChartFigure
        title="Nível por competência"
        description="Faixa CEFR de cada uma."
        legend={[
          { label: 'Dados suficientes', tone: 'accent' },
          { label: 'Poucos dados', tone: 'accent', hatched: true },
        ]}
        table={{
          rowHeader: 'Competência',
          columns: ['Nível'],
          rows: [{ label: 'Gramática', cells: ['B1'] }],
        }}
      >
        <div>desenho</div>
      </ChartFigure>,
    );
  }

  it('dá nome à figura pelo título e mostra a legenda', () => {
    renderFigure();

    expect(
      screen.getByRole('figure', { name: 'Nível por competência' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Faixa CEFR de cada uma.')).toBeInTheDocument();
    expect(screen.getByText('Dados suficientes')).toBeInTheDocument();
    expect(screen.getByText('Poucos dados')).toBeInTheDocument();
  });

  it('a amostra listrada da legenda não é só cor', () => {
    renderFigure();

    const hatched = screen
      .getByText('Poucos dados')
      .querySelector('span[aria-hidden="true"]') as HTMLElement;
    const solid = screen
      .getByText('Dados suficientes')
      .querySelector('span[aria-hidden="true"]') as HTMLElement;

    expect(hatched.style.backgroundImage).toContain(
      'repeating-linear-gradient',
    );
    expect(solid.style.backgroundImage).toBe('');
  });

  it('esconde o desenho do leitor de tela e oferece os números em tabela', async () => {
    renderFigure();

    expect(screen.getByText('desenho').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    await userEvent.click(screen.getByText('Ver como tabela'));
    const table = screen.getByRole('table', { name: 'Nível por competência' });
    expect(within(table).getByText('Gramática')).toBeInTheDocument();
    expect(within(table).getByText('B1')).toBeInTheDocument();
  });
});
