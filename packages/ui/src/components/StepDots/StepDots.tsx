import { cn } from '../../lib/cn';

export type StepDotsProps = {
  total: number;
  current: number;
  className?: string;
};

export function StepDots({ total, current, className }: StepDotsProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Etapa ${current + 1} de ${total}`}
      className={cn('flex items-center gap-1.5', className)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            'size-2 rounded-full transition-colors',
            index === current
              ? 'bg-accent'
              : index < current
                ? 'bg-accent/40'
                : 'bg-line',
          )}
        />
      ))}
    </div>
  );
}
