import { useId } from 'react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { ChartTable, type ChartTableData } from './ChartTable';
import { HATCH_STYLE, TONE_TEXT_CLASS, type ChartTone } from './chart-tones';

export type ChartLegendEntry = {
  label: string;
  tone: ChartTone;
  hatched?: boolean;
};

export type ChartFigureProps = {
  title: string;
  description?: string;
  legend?: readonly ChartLegendEntry[];
  /** Os números do gráfico, em tabela ("Ver como tabela"). */
  table: ChartTableData;
  tableSummary?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Moldura comum dos gráficos: título, legenda com amostra de cor **e** de
 * padrão, o desenho e a tabela com os mesmos números. O desenho em si fica
 * escondido de leitor de tela (`aria-hidden`) — a tabela é o equivalente.
 */
export function ChartFigure({
  title,
  description,
  legend,
  table,
  tableSummary = 'Ver como tabela',
  className,
  children,
}: ChartFigureProps) {
  const titleId = useId();

  return (
    <figure
      aria-labelledby={titleId}
      className={cn('flex flex-col gap-3', className)}
    >
      <figcaption className="flex flex-col gap-0.5">
        <span id={titleId} className="font-display text-lg text-ink">
          {title}
        </span>
        {description ? (
          <span className="text-sm text-muted">{description}</span>
        ) : null}
      </figcaption>

      {legend && legend.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
          {legend.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                style={entry.hatched ? HATCH_STYLE : undefined}
                className={cn(
                  'inline-block size-3.5 rounded-sm border border-current',
                  TONE_TEXT_CLASS[entry.tone],
                  !entry.hatched && 'bg-current',
                )}
              />
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div aria-hidden="true">{children}</div>

      <details className="text-sm">
        <summary className="cursor-pointer text-accent underline">
          {tableSummary}
        </summary>
        <div className="mt-2 overflow-x-auto">
          <ChartTable caption={title} data={table} />
        </div>
      </details>
    </figure>
  );
}
