import { cn } from '../../lib/cn';
import { ChartFigure, type ChartLegendEntry } from '../Chart/ChartFigure';
import { scaleRatio, type ChartScale } from '../Chart/chart-scale';
import {
  HATCH_STYLE,
  TONE_TEXT_CLASS,
  type ChartTone,
} from '../Chart/chart-tones';

export type BarChartItem = {
  id: string;
  label: string;
  /** `null`: ainda sem dado — mostra o texto de vazio, não uma barra zerada. */
  value: number | null;
  /** O que aparece ao lado da barra e na tabela ("B1"). */
  valueLabel: string;
  /** Linha pequena abaixo do nome ("Poucos dados"). */
  note?: string;
  /** Preenchimento listrado: estimativa frágil. */
  hatched?: boolean;
};

export type BarChartProps = {
  title: string;
  description?: string;
  items: readonly BarChartItem[];
  scale: ChartScale;
  tone?: ChartTone;
  /** Legenda do que significa listrado (some se nenhum item é listrado). */
  hatchedLegend?: string;
  solidLegend?: string;
  rowHeader?: string;
  valueHeader?: string;
  emptyLabel?: string;
  className?: string;
};

/**
 * Barras horizontais com uma escala de referência (as faixas A1…C1, por
 * exemplo). Cada barra tem o valor escrito ao lado; o listrado e o texto de
 * "sem dado" fazem o trabalho que a cor sozinha não faz.
 */
export function BarChart({
  title,
  description,
  items,
  scale,
  tone = 'accent',
  hatchedLegend = 'Estimativa com poucos dados',
  solidLegend = 'Estimativa com dados suficientes',
  rowHeader = 'Item',
  valueHeader = 'Valor',
  emptyLabel = 'Sem dados ainda',
  className,
}: BarChartProps) {
  const hasHatched = items.some((item) => item.hatched === true);
  const legend: ChartLegendEntry[] = hasHatched
    ? [
        { label: solidLegend, tone },
        { label: hatchedLegend, tone, hatched: true },
      ]
    : [];

  return (
    <ChartFigure
      title={title}
      description={description}
      legend={legend}
      className={className}
      table={{
        rowHeader,
        columns: [valueHeader],
        rows: items.map((item) => ({
          label: item.label,
          cells: [
            item.value === null
              ? emptyLabel
              : item.note
                ? `${item.valueLabel} (${item.note})`
                : item.valueLabel,
          ],
        })),
      }}
    >
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-x-2 sm:grid-cols-[9rem_1fr_3rem]"
          >
            <div className="flex flex-col">
              <span className="text-sm text-ink">{item.label}</span>
              {item.note ? (
                <span className="text-xs text-muted">{item.note}</span>
              ) : null}
            </div>

            <div className="relative h-6 rounded-md border border-line bg-ground">
              {scale.ticks.map((tick) => (
                <span
                  key={tick.value}
                  className="absolute inset-y-0 w-px bg-line"
                  style={{
                    left: `${String(scaleRatio(tick.value, scale) * 100)}%`,
                  }}
                />
              ))}
              {item.value === null ? (
                <span className="absolute inset-0 flex items-center px-2 text-xs text-muted">
                  {emptyLabel}
                </span>
              ) : (
                <span
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-md border border-current',
                    TONE_TEXT_CLASS[tone],
                    !item.hatched && 'bg-current',
                  )}
                  style={{
                    width: `${String(scaleRatio(item.value, scale) * 100)}%`,
                    ...(item.hatched ? HATCH_STYLE : {}),
                  }}
                />
              )}
            </div>

            <span className="font-mono text-sm text-ink">
              {item.value === null ? '—' : item.valueLabel}
            </span>
          </div>
        ))}

        <div className="grid grid-cols-[6.5rem_1fr_2.5rem] gap-x-2 sm:grid-cols-[9rem_1fr_3rem]">
          <span />
          <div className="relative h-4">
            {scale.ticks.map((tick) => (
              <span
                key={tick.value}
                className="absolute -translate-x-1/2 font-mono text-xs text-muted"
                style={{
                  left: `${String(scaleRatio(tick.value, scale) * 100)}%`,
                }}
              >
                {tick.label}
              </span>
            ))}
          </div>
          <span />
        </div>
      </div>
    </ChartFigure>
  );
}
