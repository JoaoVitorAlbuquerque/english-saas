import { cn } from '../../lib/cn';
import { ChartFigure } from '../Chart/ChartFigure';
import { niceMax } from '../Chart/chart-scale';
import {
  HATCH_STYLE,
  TONE_TEXT_CLASS,
  type ChartTone,
} from '../Chart/chart-tones';

export type GroupedBarSeries = {
  id: string;
  label: string;
  tone?: ChartTone;
  /** Listrado: a série "planejado" se distingue da "feito" sem depender de cor. */
  hatched?: boolean;
};

export type GroupedBarCategory = {
  id: string;
  label: string;
  /** Valor por `series.id`. */
  values: Readonly<Record<string, number>>;
};

export type GroupedBarChartProps = {
  title: string;
  description?: string;
  series: readonly GroupedBarSeries[];
  categories: readonly GroupedBarCategory[];
  /** Como o valor aparece na tabela e na dica (`${n} min`). */
  formatValue?: (value: number) => string;
  rowHeader?: string;
  emptyLabel?: string;
  className?: string;
};

const DEFAULT_TONES: readonly ChartTone[] = ['accent', 'chunk', 'ok', 'error'];
const BAR_AREA_REM = 9;

/**
 * Colunas agrupadas (planejado × feito por semana). Toda barra traz o número
 * em cima, a série tem cor **e** padrão na legenda, e a área rola na
 * horizontal quando há muitas categorias — a página nunca ganha barra de
 * rolagem.
 */
export function GroupedBarChart({
  title,
  description,
  series,
  categories,
  formatValue = String,
  rowHeader = 'Período',
  emptyLabel = 'Sem dados',
  className,
}: GroupedBarChartProps) {
  const toneOf = (index: number, entry: GroupedBarSeries): ChartTone =>
    entry.tone ?? DEFAULT_TONES[index % DEFAULT_TONES.length] ?? 'accent';
  const max = niceMax(
    Math.max(
      0,
      ...categories.flatMap((category) => Object.values(category.values)),
    ),
  );
  const hasData = categories.some((category) =>
    Object.values(category.values).some((value) => value > 0),
  );

  return (
    <ChartFigure
      title={title}
      description={description}
      className={className}
      legend={series.map((entry, index) => ({
        label: entry.label,
        tone: toneOf(index, entry),
        hatched: entry.hatched === true,
      }))}
      table={{
        rowHeader,
        columns: series.map((entry) => entry.label),
        rows: categories.map((category) => ({
          label: category.label,
          cells: series.map((entry) =>
            formatValue(category.values[entry.id] ?? 0),
          ),
        })),
      }}
    >
      {hasData ? (
        <div className="overflow-x-auto pb-1">
          <div
            className="flex gap-3"
            style={{ minWidth: `${String(categories.length * 3.5)}rem` }}
          >
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex min-w-12 flex-1 flex-col items-center gap-1"
              >
                <div
                  className="flex w-full items-end justify-center gap-1 border-b border-line"
                  style={{ height: `${String(BAR_AREA_REM)}rem` }}
                >
                  {series.map((entry, index) => {
                    const value = category.values[entry.id] ?? 0;
                    const ratio = Math.min(1, value / max);

                    return (
                      <div
                        key={entry.id}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5"
                        title={`${category.label} — ${entry.label}: ${formatValue(value)}`}
                      >
                        <span className="font-mono text-[10px] leading-none text-ink">
                          {value}
                        </span>
                        <span
                          className={cn(
                            'w-full max-w-5 rounded-t-sm border border-current',
                            TONE_TEXT_CLASS[toneOf(index, entry)],
                            entry.hatched !== true && 'bg-current',
                          )}
                          style={{
                            height: `${String(ratio * (BAR_AREA_REM - 1))}rem`,
                            minHeight: value > 0 ? '2px' : '0',
                            ...(entry.hatched === true ? HATCH_STYLE : {}),
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <span className="font-mono text-[11px] text-muted">
                  {category.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {emptyLabel}
        </p>
      )}
    </ChartFigure>
  );
}
