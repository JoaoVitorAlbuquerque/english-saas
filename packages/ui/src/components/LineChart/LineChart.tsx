import { cn } from '../../lib/cn';
import { ChartFigure, type ChartLegendEntry } from '../Chart/ChartFigure';
import {
  scaleRatio,
  visibleLabelIndexes,
  type ChartScale,
} from '../Chart/chart-scale';
import { TONE_TEXT_CLASS, type ChartTone } from '../Chart/chart-tones';

export type LineChartPoint = {
  /** Rótulo do eixo X ("15/09"). */
  x: string;
  /** `null` abre uma lacuna na linha — "sem dado" não é zero. */
  y: number | null;
};

export type LineChartSeries = {
  id: string;
  label: string;
  tone?: ChartTone;
  points: readonly LineChartPoint[];
};

export type LineChartProps = {
  title: string;
  description?: string;
  series: readonly LineChartSeries[];
  /** Eixo Y: faixa e marcas (A1…C1). */
  scale: ChartScale;
  /** Linha tracejada de referência, como a meta. */
  referenceLine?: { value: number; label: string };
  /** Como o valor Y é escrito na tabela e na dica do ponto. */
  formatY: (value: number) => string;
  rowHeader?: string;
  emptyLabel?: string;
  className?: string;
};

// Largura de referência pequena de propósito: o gráfico escala com a tela, e
// uma largura grande deixaria o texto minúsculo no celular.
const WIDTH = 360;
const HEIGHT = 210;
const PAD = { top: 14, right: 44, bottom: 28, left: 30 } as const;
const MAX_X_LABELS = 7;

type MarkerShape = 'circle' | 'diamond' | 'square' | 'triangle';
const SHAPES: readonly MarkerShape[] = [
  'circle',
  'diamond',
  'square',
  'triangle',
];
const SHAPE_NAMES = ['círculo', 'losango', 'quadrado', 'triângulo'] as const;
const DEFAULT_TONES: readonly ChartTone[] = ['accent', 'chunk', 'ok', 'error'];

function Marker({
  shape,
  x,
  y,
  size = 5,
}: {
  shape: MarkerShape;
  x: number;
  y: number;
  size?: number;
}) {
  switch (shape) {
    case 'circle':
      return <circle cx={x} cy={y} r={size} />;
    case 'square':
      return (
        <rect x={x - size} y={y - size} width={size * 2} height={size * 2} />
      );
    case 'diamond':
      return (
        <polygon
          points={`${String(x)},${String(y - size - 1)} ${String(x + size + 1)},${String(y)} ${String(x)},${String(y + size + 1)} ${String(x - size - 1)},${String(y)}`}
        />
      );
    case 'triangle':
      return (
        <polygon
          points={`${String(x)},${String(y - size - 1)} ${String(x + size + 1)},${String(y + size)} ${String(x - size - 1)},${String(y + size)}`}
        />
      );
  }
}

/**
 * Linha por série ao longo de um eixo X em rótulos. Cada série tem cor **e**
 * forma de marcador (a legenda mostra as duas), e o valor mais recente vem
 * escrito. Ponto `null` quebra a linha em vez de cair a zero.
 */
export function LineChart({
  title,
  description,
  series,
  scale,
  referenceLine,
  formatY,
  rowHeader = 'Período',
  emptyLabel = 'Sem dados',
  className,
}: LineChartProps) {
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const xLabels = series[0]?.points.map((point) => point.x) ?? [];
  const xAt = (index: number) =>
    PAD.left +
    (xLabels.length <= 1
      ? plotWidth / 2
      : (index / (xLabels.length - 1)) * plotWidth);
  const yAt = (value: number) =>
    PAD.top + (1 - scaleRatio(value, scale)) * plotHeight;
  const shown = new Set(visibleLabelIndexes(xLabels.length, MAX_X_LABELS));

  const legend: ChartLegendEntry[] = series.map((entry, index) => ({
    label: `${entry.label} (${SHAPE_NAMES[index % SHAPES.length] ?? ''})`,
    tone: entry.tone ?? DEFAULT_TONES[index % DEFAULT_TONES.length] ?? 'accent',
  }));
  const hasData = series.some((entry) =>
    entry.points.some((point) => point.y !== null),
  );

  return (
    <ChartFigure
      title={title}
      description={description}
      legend={series.length > 1 ? legend : []}
      className={className}
      table={{
        rowHeader,
        columns: series.map((entry) => entry.label),
        rows: xLabels.map((label, index) => ({
          label,
          cells: series.map((entry) => {
            const y = entry.points[index]?.y ?? null;
            return y === null ? emptyLabel : formatY(y);
          }),
        })),
      }}
    >
      {hasData ? (
        <svg
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          className="h-auto w-full max-w-xl"
          focusable="false"
        >
          {scale.ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yAt(tick.value)}
                y2={yAt(tick.value)}
                className="stroke-line"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={yAt(tick.value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted font-mono text-[10px]"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {referenceLine ? (
            <g>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yAt(referenceLine.value)}
                y2={yAt(referenceLine.value)}
                className="stroke-ink"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              <text
                x={WIDTH - PAD.right + 4}
                y={yAt(referenceLine.value)}
                dominantBaseline="middle"
                className="fill-ink text-[10px] font-medium"
              >
                {referenceLine.label}
              </text>
            </g>
          ) : null}

          {xLabels.map((label, index) =>
            shown.has(index) ? (
              <text
                key={`${label}-${String(index)}`}
                x={xAt(index)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-muted font-mono text-[10px]"
              >
                {label}
              </text>
            ) : null,
          )}

          {series.map((entry, seriesIndex) => {
            const tone =
              entry.tone ??
              DEFAULT_TONES[seriesIndex % DEFAULT_TONES.length] ??
              'accent';
            const shape = SHAPES[seriesIndex % SHAPES.length] ?? 'circle';
            const segments: string[] = [];
            let current = '';

            entry.points.forEach((point, index) => {
              if (point.y === null) {
                if (current) segments.push(current);
                current = '';
                return;
              }
              current += `${current ? 'L' : 'M'}${String(xAt(index))},${String(yAt(point.y))} `;
            });
            if (current) segments.push(current);

            const lastIndex = entry.points.reduce(
              (found, point, index) => (point.y === null ? found : index),
              -1,
            );
            const last = lastIndex >= 0 ? entry.points[lastIndex] : undefined;

            return (
              <g
                key={entry.id}
                className={cn(TONE_TEXT_CLASS[tone])}
                fill="currentColor"
                stroke="currentColor"
              >
                {segments.map((path, index) => (
                  <path
                    key={index}
                    d={path}
                    fill="none"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                ))}
                {entry.points.map((point, index) =>
                  point.y === null ? null : (
                    <g key={index} className="stroke-surface" strokeWidth={1.5}>
                      <Marker shape={shape} x={xAt(index)} y={yAt(point.y)} />
                      <title>{`${point.x}: ${formatY(point.y)}`}</title>
                    </g>
                  ),
                )}
                {last && last.y !== null ? (
                  <text
                    x={xAt(lastIndex) + 9}
                    y={yAt(last.y) - 9}
                    className="fill-ink stroke-none font-mono text-[10px] font-semibold"
                    textAnchor={
                      lastIndex >= xLabels.length - 1 ? 'end' : 'start'
                    }
                  >
                    {formatY(last.y)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {emptyLabel}
        </p>
      )}
    </ChartFigure>
  );
}
